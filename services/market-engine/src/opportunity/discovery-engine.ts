import {Opportunity, OpportunityCandidate, EvidenceRef, DiscoveryAuditRecord, LiquidityAssessment, CostComponents, RiskProfile} from './types';
import {NormalizedMarketState} from './market-state';
import {buildMarketState} from './market-state';
import {detectCrossVenueArbitrage} from './afis/cross-venue';
import {detectTriangularArbitrage} from './afis/triangular';
import {detectFundingArbitrage} from './afis/funding';
import {detectBasisOpportunity} from './afis/basis';
import {detectMarketMakingOpportunity} from './afis/market-making';
import {detectLiquidityImbalance} from './afis/liquidity-imbalance';
import {detectSurebet} from './abl/surebet';
import {detectBackLayDiscrepancy} from './abl/back-lay';
import {detectValueOpportunity} from './abl/value';
import {detectHedgeMiddle} from './abl/hedge';
import {opportunityFingerprint, opportunityId, discoveryId, auditId} from './ids';
import {computeCostModel, DEFAULT_COST_MODEL_CONFIG, CostModelConfig} from './cost-model';
import {evaluateLiquidity, DEFAULT_LIQUIDITY_EVALUATOR_CONFIG, LiquidityEvaluatorConfig} from './liquidity-evaluator';
import {validateFreshness} from './freshness-validator';
import {detectEvidenceConflict} from './evidence-binding';
import {validateOpportunity} from './lifecycle';
import {rankOpportunities, DEFAULT_RANKING_POLICY, RankingPolicy} from './ranking';
import {OpportunityDeduplicator} from './deduplication';
import {OiinEvent} from '../oiin';
import {sha256} from '../oiin';

/**
 * Unified Multi-Venue Opportunity Discovery Engine.
 *
 * It runs all AFIS + ABL detectors over a normalized market/odds state, then
 * applies the unified cost model, liquidity evaluation, freshness/evidence
 * validation, lifecycle, deduplication and cross-domain ranking. It never
 * mutates Strategy / Risk / Allocation / AEGIS / Treasury / Execution; it only
 * produces ranked candidate opportunities + structured audit records.
 */
export interface DiscoveryConfig {
  readonly configVersion: string;
  readonly cost: CostModelConfig;
  readonly liquidity: LiquidityEvaluatorConfig;
  readonly ranking: RankingPolicy;
  readonly edgeThreshold: number;
  readonly minConfidence: number;
  readonly conflictTolerance: number;
  readonly freshnessWindowMs: number;
  readonly maxLiquidityRatio: number;
  readonly capitalCostRate: number;
  readonly defaultHorizonMs: number;
}

export const DEFAULT_DISCOVERY_CONFIG: DiscoveryConfig = {
  configVersion: 'opportunity.v1',
  cost: DEFAULT_COST_MODEL_CONFIG,
  liquidity: DEFAULT_LIQUIDITY_EVALUATOR_CONFIG,
  ranking: DEFAULT_RANKING_POLICY,
  edgeThreshold: 0.0,
  minConfidence: 0.2,
  conflictTolerance: 0.02,
  freshnessWindowMs: 60_000,
  maxLiquidityRatio: 0.8,
  capitalCostRate: 0.05,
  defaultHorizonMs: 60_000,
};

export interface DiscoverOptions {
  readonly now: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly availableCapital: number;
  readonly config?: DiscoveryConfig;
}

export interface DiscoveryResult {
  readonly opportunities: readonly Opportunity[];
  readonly auditRecords: readonly DiscoveryAuditRecord[];
  readonly batchId: string;
}

export class OpportunityDiscoveryEngine {
  private readonly dedup = new OpportunityDeduplicator();
  private readonly audit: DiscoveryAuditRecord[] = [];

  /** Discover from a batch of raw OIIN events. */
  discoverFromEvents(events: readonly OiinEvent[], options: DiscoverOptions): DiscoveryResult {
    const state = buildMarketState(events);
    return this.discover(state, options);
  }

  /** Discover from a pre-built normalized market/odds state. */
  discover(state: NormalizedMarketState, options: DiscoverOptions): DiscoveryResult {
    const config = options.config ?? DEFAULT_DISCOVERY_CONFIG;
    const now = options.now;

    const candidates = this.collectCandidates(state, now, config);

    let opportunities: Opportunity[] = [];
    for (const candidate of candidates) {
      const opportunity = this.ingestCandidate(candidate, state, options, config);
      if (!opportunity) continue;
      opportunities.push(this.dedup.add(opportunity));
    }

    opportunities = [...this.dedup.all()].filter((o) => o.observedAt + o.freshnessWindowMs >= now);
    // Rank only VALIDATED/RANKED/ELIGIBLE; everything else is terminal.
    const ranked = rankOpportunities(opportunities, config.ranking);

    // Merge ranking back (rankOpportunities returns copies); keep non-ranked as-is.
    const final = opportunities.map((o) => {
      const rankedMatch = ranked.find((r) => r.opportunityId === o.opportunityId);
      return rankedMatch ?? o;
    });

    for (const o of final) {
      this.auditRecord(o, options, config, now);
    }

    const batchId = discoveryId(options.correlationId, options.traceId, shaOf(final.map((f) => f.opportunityId).join(',')), final.length);

    return Object.freeze({
      opportunities: final,
      auditRecords: [...this.audit],
      batchId,
    });
  }

  private collectCandidates(state: NormalizedMarketState, now: number, config: DiscoveryConfig): OpportunityCandidate[] {
    const candidates: OpportunityCandidate[] = [];

    // AFIS cross-venue for every instrument present.
    for (const instrument of state.quotes.keys()) {
      candidates.push(...detectCrossVenueArbitrage(state, instrument));
    }

    // AFIS triangular over the union of instruments (base = first/stable).
    const allInstruments = [...state.quotes.keys()];
    if (allInstruments.length >= 2) {
      const base = pickBase(allInstruments);
      const others = allInstruments.filter((x) => x !== base);
      candidates.push(...detectTriangularArbitrage(state, others, base));
    }

    // AFIS funding + basis + market-making + imbalance per quote.
    for (const [instrument, venueMap] of state.quotes) {
      let spot: import('./market-state').QuoteState | undefined;
      let perp: import('./market-state').QuoteState | undefined;
      for (const [venue, q] of venueMap) {
        if (venue.toLowerCase().includes('perp')) perp = q;
        else spot = q;

        const mm = detectMarketMakingOpportunity({
          instrument,
          venue,
          quote: q,
          volatility: q.volatility ?? 0.02,
          inventoryRisk: 0.1,
          fillProbability: q.reliability,
          makerRebate: q.makerRebate ?? 0,
          observedAt: q.observedAt,
        });
        if (mm) candidates.push(cloneCandidateAfter(mm, q.evidence, q.sourceEvents, now, config));

        const imb = detectLiquidityImbalance({
          instrument,
          venue,
          quote: q,
          bidDepth: bidDepthOf(q),
          askDepth: askDepthOf(q),
          observedAt: q.observedAt,
        });
        if (imb) candidates.push(cloneCandidateAfter(imb, q.evidence, q.sourceEvents, now, config));
      }
      if (spot && perp) {
        const funding = detectFundingArbitrage({
          base: instrument, spotPrice: spot.mid, perpPrice: perp.mid,
          fundingRate: 0.0001, fundingIntervalMs: 28_800_000, horizonMs: config.defaultHorizonMs,
          takerFee: spot.fees + perp.fees, slippage: 0.001, hedgeRatio: 1, depth: Math.min(spot.depth, perp.depth),
          liquidationRisk: 0.1, observedAt: Math.max(spot.observedAt, perp.observedAt), venue: `${spot.venue}|${perp.venue}`,
        });
        if (funding) candidates.push(cloneCandidateAfter(funding, [...spot.evidence, ...perp.evidence], [...spot.sourceEvents, ...perp.sourceEvents], now, config));

        const basis = detectBasisOpportunity({
          base: instrument, spotPrice: spot.mid, perpPrice: perp.mid,
          takerFee: spot.fees + perp.fees, slippage: 0.001, hedgeCost: 0.0002,
          observedAt: Math.max(spot.observedAt, perp.observedAt), horizonMs: config.defaultHorizonMs,
          convergenceUncertainty: 0.2, depth: Math.min(spot.depth, perp.depth),
        });
        if (basis) candidates.push(cloneCandidateAfter(basis, [...spot.evidence, ...perp.evidence], [...spot.sourceEvents, ...perp.sourceEvents], now, config));
      }
    }

    // ABL surebets per (market, category|selection) grouping.
    for (const [, bookmakerMap] of state.odds) {
      for (const group of groupOddsBySelection(bookmakerMap)) {
        const surebet = detectSurebet(group.market, group.legs);
        if (surebet) candidates.push(cloneCandidateAfter(surebet, group.evidence, group.events, now, config));
      }
    }

    // ABL back/lay + value + hedge from odds.
    for (const [, bookmakerMap] of state.odds) {
      const entries = [...bookmakerMap.values()];
      for (const a of entries) {
        for (const b of entries) {
          if (a.bookmaker === b.bookmaker) continue;
          if (a.back > 0 && b.lay && b.lay > a.back) {
            const bl = detectBackLayDiscrepancy({
              market: categoryOf(a), selection: a.selection, backVenue: a.bookmaker, backOdds: a.back,
              layVenue: b.bookmaker, layOdds: b.lay, commission: a.commission, stake: 1, observedAt: Math.max(a.observedAt, b.observedAt),
            });
            if (bl) candidates.push(cloneCandidateAfter(bl, [...a.evidence, ...b.evidence], [...a.sourceEvents, ...b.sourceEvents], now, config));
          }
          if (b.back > 0 && a.lay && a.lay > b.back) {
            const bl = detectBackLayDiscrepancy({
              market: categoryOf(a), selection: a.selection, backVenue: b.bookmaker, backOdds: b.back,
              layVenue: a.bookmaker, layOdds: a.lay, commission: a.commission, stake: 1, observedAt: Math.max(a.observedAt, b.observedAt),
            });
            if (bl) candidates.push(cloneCandidateAfter(bl, [...a.evidence, ...b.evidence], [...a.sourceEvents, ...b.sourceEvents], now, config));
          }
        }
        if (a.modelProbability && a.fairValue) {
          const value = detectValueOpportunity({
            market: categoryOf(a), selection: a.selection, bookmaker: a.bookmaker, odds: a.back,
            modelProbability: a.modelProbability, modelConfidence: a.modelProbability > 0.5 ? 0.7 : 0.5, observedAt: a.observedAt,
          });
          if (value) candidates.push(cloneCandidateAfter(value, a.evidence, a.sourceEvents, now, config));
        }
      }
      // Hedge/middle from a 2-3 outcome group.
      const hedgeGroup = groupOddsBySelection(bookmakerMap);
      for (const group of hedgeGroup) {
        if (group.legs.length >= 2 && group.legs.every((l) => l.odds > 1)) {
          const hedge = detectHedgeMiddle({
            market: group.market,
            outcomes: group.legs.map((l) => ({selection: l.selection, probability: 1 / l.odds, payoutIfWins: 0, odds: l.odds, bookmaker: l.bookmaker})),
            stakePool: 10, observedAt: Math.max(...group.evidence.map((e) => e.observedAt).concat([0])),
          });
          if (hedge) candidates.push(cloneCandidateAfter(hedge, group.evidence, group.events, now, config));
        }
      }
    }

    return candidates;
  }

  private ingestCandidate(candidate: OpportunityCandidate, state: NormalizedMarketState, options: DiscoverOptions, config: DiscoveryConfig): Opportunity | undefined {
    const now = options.now;
    const observedAt = candidate.observedAt > 0 ? candidate.observedAt : (maxEvidence(candidate.evidence) ?? now);
    const freshnessWindowMs = candidate.freshnessWindowMs > 0 ? candidate.freshnessWindowMs : config.freshnessWindowMs;
    const freshness = validateFreshness({observedAt, now, freshnessWindowMs});
    const liquidity = evaluateLiquidity({
      availableDepth: depthOf(candidate),
      requestedSize: candidate.requiredCapital > 0 ? candidate.requiredCapital : 1,
      spread: spreadOf(candidate),
      venueReliability: reliabilityOf(candidate),
      freshness: freshness.freshness,
      referencePrice: referencePriceOf(candidate),
      config: config.liquidity,
    });
    const conflict = detectEvidenceConflict(candidate.evidence, config.conflictTolerance);
    const cost = computeCostModel({
      grossEdge: candidate.grossEdge,
      requiredCapital: candidate.requiredCapital,
      notional: candidate.requiredCapital > 0 ? candidate.requiredCapital : 1,
      fees: feesOf(candidate),
      slippage: slippageOf(candidate),
      latencyMs: latencyOf(candidate),
      latencyPenaltyPerMs: 1e-6,
      adverseSelection: adverseOf(candidate),
      liquidityPenalty: liquidityPenaltyOf(candidate),
      risk: candidate.risk,
      horizonMs: freshnessWindowMs,
      config: config.cost,
    });

    const marketStatePresent = candidate.market.length > 0;
    const liquiditySufficient = liquidity.deployableCapital >= candidate.requiredCapital * config.maxLiquidityRatio;
    const edgeAbove = cost.riskAdjustedNetEdge >= config.edgeThreshold;
    const costValid = Number.isFinite(cost.riskAdjustedNetEdge);
    const capitalSufficient = options.availableCapital >= candidate.requiredCapital;
    const correlationAcceptable = candidate.risk.correlationRisk <= 0.8;
    const aegisReject = false;

    const validation = validateOpportunity({
      freshness: freshness.freshness,
      fresh: freshness.fresh,
      marketStatePresent,
      liquiditySufficient,
      edgeAboveThreshold: edgeAbove,
      costValid,
      capitalSufficient,
      correlationAcceptable,
      evidenceConflict: conflict.conflicted,
      aegisReject,
    });

    const fingerprint = opportunityFingerprint(candidate);
    const id = opportunityId(fingerprint);

    const status = validation.valid ? 'VALIDATED' : validation.reason;

    return Object.freeze({
      opportunityId: id,
      discoveryId: discoveryId(options.correlationId, options.traceId, fingerprint, 1),
      domain: candidate.domain,
      type: candidate.type,
      instruments: [...candidate.instruments],
      venues: [...candidate.venues],
      market: candidate.market,
      direction: candidate.direction,
      observedAt,
      expiresAt: observedAt + freshnessWindowMs,
      freshnessWindowMs,
      freshness: freshness.freshness,
      sourceEvents: candidate.sourceEvents,
      evidence: candidate.evidence,
      requiredCapital: candidate.requiredCapital,
      grossEdge: candidate.grossEdge,
      estimatedCosts: cost.costs,
      estimatedTotalCost: cost.totalCost,
      netEdge: cost.riskAdjustedNetEdge,
      confidence: candidate.confidence,
      liquidity,
      executionRisk: candidate.executionRisk,
      risk: candidate.risk,
      status: status as Opportunity['status'],
      strategyCompatibility: candidate.strategyCompatibility,
      lifecycleReason: validation.detail,
      costModelVersion: cost.costModelVersion,
      fingerprint,
      calculation: candidate.calculation,
    });
  }

  private auditRecord(o: Opportunity, options: DiscoverOptions, config: DiscoveryConfig, now: number): void {
    this.audit.push(Object.freeze({
      discoveryId: o.discoveryId,
      opportunityId: o.opportunityId,
      sourceEvents: [...o.sourceEvents],
      evidenceIds: o.evidence.map((e) => e.evidenceId),
      calculationVersion: o.costModelVersion,
      configurationVersion: config.configVersion,
      rankingVersion: o.rank?.configVersion ?? 'unranked',
      decision: o.status,
      reason: o.lifecycleReason ?? 'none',
      timestamp: now,
      correlationId: options.correlationId,
      traceId: options.traceId,
      schemaVersion: 'oship.opportunity.audit.v1',
    }));
  }
}

// ---------------------------------------------------------------------------
// Cost-input extraction helpers (map detector calc keys to the unified model).
// ---------------------------------------------------------------------------

function cloneCandidateAfter(c: OpportunityCandidate, evidence: readonly EvidenceRef[], sourceEvents: readonly string[], now: number, config: DiscoveryConfig): OpportunityCandidate {
  const observedAt = c.observedAt > 0 ? c.observedAt : maxEvidence(evidence) ?? now;
  return Object.freeze({
    ...c,
    evidence: [...evidence],
    sourceEvents: [...new Set([...c.sourceEvents, ...sourceEvents])],
    observedAt,
    expiresAt: observedAt + c.freshnessWindowMs,
  });
}

function maxEvidence(evidence: readonly EvidenceRef[]): number | undefined {
  return evidence.length ? Math.max(...evidence.map((e) => e.observedAt)) : undefined;
}

function depthOf(c: OpportunityCandidate): number {
  return num(c.calculation.availableDepth) ?? num(c.calculation.minDepth) ?? 1;
}
function spreadOf(c: OpportunityCandidate): number {
  return num(c.calculation.spread) ?? 0;
}
function reliabilityOf(c: OpportunityCandidate): number {
  return Math.max(0, Math.min(1, c.confidence));
}
function referencePriceOf(c: OpportunityCandidate): number {
  return num(c.calculation.buyPrice) ?? num(c.calculation.spotPrice) ?? num(c.calculation.backOdds) ?? 1;
}
function feesOf(c: OpportunityCandidate): number {
  return num(c.calculation.fees) ?? num(c.calculation.cumulativeFees) ?? num(c.calculation.commission) ?? 0;
}
function slippageOf(c: OpportunityCandidate): number {
  return num(c.calculation.slippage) ?? num(c.calculation.slippageCost) ?? num(c.calculation.cumulativeSlippage) ?? 0;
}
function latencyOf(c: OpportunityCandidate): number {
  return num(c.calculation.latencyMs) ?? 0;
}
function adverseOf(c: OpportunityCandidate): number {
  return num(c.calculation.adverseSelection) ?? num(c.calculation.adverseSelectionRisk) ?? 0;
}
function liquidityPenaltyOf(c: OpportunityCandidate): number {
  return num(c.calculation.liquidityPenalty) ?? 0;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function bidDepthOf(q: import('./market-state').QuoteState): number {
  return Math.max(0, q.depth * (1 - (q.orderBookImbalance ?? 0)) / 2);
}
function askDepthOf(q: import('./market-state').QuoteState): number {
  return Math.max(0, q.depth * (1 + (q.orderBookImbalance ?? 0)) / 2);
}
function pickBase(instruments: string[]): string {
  return instruments.reduce((a, b) => (a.length <= b.length ? a : b));
}
function categoryOf(o: import('./market-state').OddsState): string {
  return o.category;
}

interface SurebetGroup {
  readonly market: string;
  readonly legs: readonly {bookmaker: string; selection: string; odds: number; commission: number}[];
  readonly evidence: readonly EvidenceRef[];
  readonly events: readonly string[];
}
function groupOddsBySelection(bookmakerMap: ReadonlyMap<string, import('./market-state').OddsState>): SurebetGroup[] {
  const bySel = new Map<string, import('./market-state').OddsState[]>();
  for (const o of bookmakerMap.values()) {
    const key = `${o.category}|${o.selection}`;
    const list = bySel.get(key) ?? [];
    list.push(o);
    bySel.set(key, list);
  }
  const out: SurebetGroup[] = [];
  for (const entries of bySel.values()) {
    if (entries.length < 1) continue;
    const market = `${entries[0].category}|${entries[0].selection}`;
    out.push(Object.freeze({
      market,
      legs: entries.map((e) => Object.freeze({bookmaker: e.bookmaker, selection: e.selection, odds: e.back, commission: e.commission})),
      evidence: entries.flatMap((e) => e.evidence),
      events: entries.flatMap((e) => e.sourceEvents),
    }));
  }
  return out;
}

function shaOf(s: string): string {
  return sha256({s}).slice(0, 20);
}
