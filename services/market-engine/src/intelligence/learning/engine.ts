import type {
  LearningInput, LearningResult, LearningConfigSpec, LearningConfigInput,
  LearningObservation, LearningSignal, StabilityAssessment, DriftMetric,
  LearningSubject, FeatureVector, LearningBaseline,
} from './types';
import {
  mergeLearningConfig, validateLearningConfig,
} from './config';
import {learningAnalysisIdOf, analysisFingerprintOf, canonicalJson} from './ids';
import {buildLearningObservations, groupObservations, contradictedStrategiesOf} from './sample';
import {buildFeatureSets} from './feature';
import {buildFeatureVectors} from './feature-vector';
import {buildCohorts, rawCrossDomainCohort} from './cohort';
import {historicalBaseline, domainNormalizedBaseline, subjectBaseline} from './baseline';
import {classifyRegimes, regimeSummary} from './regime';
import {assessDrift} from './drift';
import {assessStability} from './stability';
import {assessConfidence, freshnessOf} from './confidence';
import {learnStrategy, domainBaselineFor, meanTheoreticalOf} from './strategy-learning';
import {learnOpportunityClass} from './opportunity-learning';
import {learnVenue} from './venue-learning';
import {learnPolicy} from './policy-learning';
import {learnLeakage} from './leakage-learning';
import {buildSignal} from './learning-signal';
import {buildPriorities, isPriorityWorthy} from './priority';
import {
  monitorRecommendation, collectEvidenceRecommendation,
  researchInvestigationRecommendation, comparabilityRecommendation,
} from './recommendation';
import {
  researchQueryFeedback, evidenceGapFeedback, priorityUpdateFeedback,
} from './feedback';
import {buildLearningLineage} from './lineage';
import {compareLearningResults} from './replay';
import {LearningAuditLog} from './audit';
import {checkLearningInvariants, LearningInvariantError} from './invariants';

/**
 * SPRINT 037 — Unified Intelligence Learning & Research Feedback Engine.
 *
 * One engine serves AFIS and ABL. It consumes a validated Sprint 036
 * ResearchResult and produces deterministic, immutable, informational
 * learning artifacts. The full pipeline runs twice per analysis and must be
 * byte-identical; invariants (48) are enforced on every analysis. The engine
 * is NOT an authority: nothing it produces authorizes or mutates anything.
 */

export class LearningEngine {
  private readonly config: LearningConfigSpec;

  constructor(configInput?: LearningConfigInput) {
    const config = mergeLearningConfig(configInput);
    validateLearningConfig(config);
    this.config = config;
  }

  get configurationFingerprint(): string {
    return canonicalJson(this.config);
  }

  analyze(input: LearningInput): LearningResult {
    if (!input || !input.research || typeof input.research.analysisId !== 'string'
      || input.research.analysisId.length === 0) {
      throw new Error('learning: missing validated research result — fail closed');
    }
    if (!input.research.invariants || input.research.invariants.passed !== true) {
      throw new Error(
        `learning: research result ${input.research.analysisId} failed its own invariants — fail closed`);
    }
    if (input.research.replay.identical !== true) {
      throw new Error('learning: research result is not replay-verified — fail closed');
    }
    if (input.research.memory.records.length === 0) {
      throw new Error('learning: research result carries no memory records — fail closed');
    }
    if (!Number.isFinite(input.timestamp) || input.timestamp <= 0) {
      throw new Error('learning: invalid analysis timestamp — fail closed');
    }
    if (typeof input.correlationId !== 'string' || input.correlationId.length === 0) {
      throw new Error('learning: correlationId required — fail closed');
    }
    if (typeof input.traceId !== 'string' || input.traceId.length === 0) {
      throw new Error('learning: traceId required — fail closed');
    }
    const first = this.runCore(input);
    const second = this.runCore(input);
    const comparison = compareLearningResults(first.core, second.core);
    if (!comparison.identical) {
      throw new Error(
        `learning: internal replay is not byte-identical (${comparison.differences.join(', ')}) — fail closed`);
    }
    second.audit.append('replay-completed', {
      identical: true, fingerprint: first.core.analysisFingerprint,
    });
    const result: LearningResult = Object.freeze({
      ...second.core,
      auditEvents: second.audit.snapshot(),
      replay: Object.freeze({identical: true, fingerprint: second.core.analysisFingerprint}),
      invariants: Object.freeze({passed: true, checks: [], failedCount: 0}),
    });
    const invariants = checkLearningInvariants(result,
      {research: input.research, config: this.config});
    if (!invariants.passed) {
      throw new LearningInvariantError(invariants);
    }
    return Object.freeze({...result, invariants});
  }

  private runCore(input: LearningInput): {core: LearningResult; audit: LearningAuditLog} {
    const config = this.config;
    const research = input.research;
    const timestamp = input.timestamp;

    // Canonical observation order — replay must not depend on how the
    // upstream research result happened to order its memory.
    const observations = buildLearningObservations(research, config);
    const analysisId = learningAnalysisIdOf({
      researchAnalysisId: research.analysisId,
      observations: observations.map((o) => o.observationId),
      timestamp, config: config.schemaVersion,
    });
    const audit = new LearningAuditLog(analysisId, timestamp);
    audit.append('learning-started', {
      researchAnalysisId: research.analysisId, observations: observations.length,
      correlationId: input.correlationId, traceId: input.traceId,
    });
    for (const observation of observations) {
      audit.append('observation-created', {
        observationId: observation.observationId,
        sourceMemoryId: observation.sourceMemoryId, domain: observation.domain,
      });
    }

    const features = buildFeatureSets(observations, config);
    for (const feature of features) {
      audit.append('feature-created', {
        featureId: feature.featureId, observationId: feature.observationId,
      });
    }
    const featureVectors = buildFeatureVectors(observations, config);

    const cohortDimensions = ['DOMAIN', 'OPPORTUNITY_CLASS', 'STRATEGY', 'VENUE',
      'POLICY', 'EXECUTION_MODE', 'TIME_PERIOD', 'REGIME', 'EVIDENCE_QUALITY'] as const;
    const cohorts = [
      ...cohortDimensions.flatMap((dim) =>
        [...buildCohorts(observations, dim, config, dim === 'DOMAIN')]),
      rawCrossDomainCohort(observations, config),
    ];
    for (const cohort of cohorts) {
      audit.append('cohort-created', {
        cohortId: cohort.cohortId, dimension: cohort.dimension,
        sampleSize: cohort.sampleSize, comparable: cohort.comparable,
      });
    }

    const domains = [...new Set(observations.map((o) => o.domain))].sort();
    const baselines: LearningBaseline[] = [];
    for (const domain of domains) {
      const population = observations.filter((o) => o.domain === domain);
      for (const metric of ['preservation', 'executionQuality', 'realizedNet',
        'leakage', 'completion'] as const) {
        baselines.push(historicalBaseline(population, metric, config));
      }
    }
    baselines.push(domainNormalizedBaseline(observations, 'preservation', config));
    for (const baseline of baselines) {
      audit.append('baseline-created', {
        baselineId: baseline.baselineId, kind: baseline.kind, metric: baseline.metric,
        meanValue: baseline.meanValue, sampleSize: baseline.sampleSize,
      });
    }

    const regimes = classifyRegimes(observations, config);
    for (const regime of regimes) {
      audit.append('regime-detected', {
        regimeId: regime.regimeId, timeBucket: regime.timeBucket,
        dimensions: regime.dimensions.map((d) => `${d.dimension}=${d.classification}`),
      });
    }

    // Stability per feature-vector subject (era means drive the assessment).
    const contradictedStrategies = contradictedStrategiesOf(research);
    const stabilityBySubject = new Map<string, StabilityAssessment>();
    for (const vector of featureVectors) {
      const population = observations.filter((o) =>
        (vector.subject.kind === 'STRATEGY' && o.strategyId === vector.subject.key)
        || (vector.subject.kind === 'OPPORTUNITY_CLASS' && o.opportunityClass === vector.subject.key)
        || (vector.subject.kind === 'POLICY'
          && `${o.domain}:${o.policyId}@${o.policyVersion}` === vector.subject.key)
        || (vector.subject.kind === 'VENUE' && o.venues.includes(vector.subject.key))
        || (vector.subject.kind === 'DOMAIN' && o.domain === vector.subject.key));
      const contradicted = vector.subject.kind === 'STRATEGY'
        && contradictedStrategies.has(vector.subject.key);
      const assessment = assessStability({
        subject: vector.subject,
        metric: 'preservation',
        observations: population,
        contradicted,
        eraMeans: vector.eraBreakdown.map((e) => e.meanPreservation),
      }, config);
      stabilityBySubject.set(`${vector.subject.kind}:${vector.subject.key}`, assessment);
      audit.append('stability-evaluated', {
        stabilityId: assessment.stabilityId, subject: vector.subject.key,
        classification: assessment.classification,
      });
    }

    const strategyLearning = featureVectors
      .filter((v) => v.subject.kind === 'STRATEGY')
      .map((vector) => {
        const population = observations.filter((o) => o.strategyId === vector.subject.key);
        return learnStrategy({
          vector,
          observations: population,
          domainBaseline: domainBaselineFor(
            vector.domain === 'MIXED' ? observations[0].domain : vector.domain,
            observations, config),
          stability: stabilityBySubject.get(`STRATEGY:${vector.subject.key}`)!,
          contradicted: vector.subject.kind === 'STRATEGY'
            && contradictedStrategies.has(vector.subject.key),
        }, config);
      });
    for (const learning of strategyLearning) {
      audit.append('strategy-learned', {
        learningId: learning.learningId, strategyId: learning.strategyId,
        classification: learning.classification, sampleSize: learning.sampleSize,
      });
    }

    const opportunityLearning = featureVectors
      .filter((v) => v.subject.kind === 'OPPORTUNITY_CLASS')
      .map((vector) => learnOpportunityClass({
        vector,
        observations: observations.filter(
          (o) => o.domain === vector.domain && o.opportunityClass === vector.subject.key),
      }, config));
    for (const learning of opportunityLearning) {
      audit.append('opportunity-learned', {
        learningId: learning.learningId, opportunityClass: learning.opportunityClass,
        classification: learning.classification, sampleSize: learning.sampleSize,
      });
    }

    const venueNames = [...new Set(observations.flatMap((o) => o.venues))].sort();
    const venueLearning = venueNames.map((venue) => learnVenue({
      venue,
      observations,
      stability: stabilityBySubject.get(`VENUE:${venue}`)!,
    }, config));
    for (const learning of venueLearning) {
      audit.append('venue-learned', {
        learningId: learning.learningId, venue: learning.venue,
        classification: learning.classification, sampleSize: learning.sampleSize,
      });
    }

    const policyGroups = groupObservations(observations,
      (o) => `${o.domain}:${o.policyId}@${o.policyVersion}`);
    const policyPairs = Object.entries(policyGroups)
      .map(([key, population]) => {
        const [domain, policy] = key.split(':');
        const [policyId, policyVersion] = policy.split('@');
        return {
          key, population,
          learning: learnPolicy({
            policyId, policyVersion, population, all: observations,
            stability: stabilityBySubject.get(`POLICY:${key}`)
              ?? assessStability({
                subject: {kind: 'POLICY', key},
                metric: 'preservation', observations: population, contradicted: false,
                eraMeans: [],
              }, config),
          }, config),
        };
      })
      .sort((a, b) => (a.learning.learningId < b.learning.learningId ? -1 : 1));
    const policyLearning = policyPairs.map((pair) => pair.learning);
    for (const learning of policyLearning) {
      audit.append('policy-learned', {
        learningId: learning.learningId, policy: `${learning.policyId}@${learning.policyVersion}`,
        role: learning.role, classification: learning.classification,
      });
    }

    const leakageLearning = learnLeakage(observations, config);

    // Drift: strategies, venues, policies and opportunity classes.
    const driftSubjects: {subject: LearningSubject; population: readonly LearningObservation[];
      metrics: readonly DriftMetric[]}[] = [];
    for (const vector of featureVectors.filter((v) => v.subject.kind === 'STRATEGY')) {
      driftSubjects.push({
        subject: vector.subject,
        population: observations.filter((o) => o.strategyId === vector.subject.key),
        metrics: ['STRATEGY_PRESERVATION', 'LEAKAGE'],
      });
    }
    for (const venue of venueNames) {
      driftSubjects.push({
        subject: {kind: 'VENUE', key: venue},
        population: observations.filter((o) => o.venues.includes(venue)),
        metrics: ['VENUE_QUALITY', 'LEAKAGE'],
      });
    }
    for (const key of Object.keys(policyGroups).sort()) {
      driftSubjects.push({
        subject: {kind: 'POLICY', key},
        population: policyGroups[key],
        metrics: ['POLICY_IMPACT'],
      });
    }
    for (const vector of featureVectors.filter((v) => v.subject.kind === 'OPPORTUNITY_CLASS')) {
      driftSubjects.push({
        subject: vector.subject,
        population: observations.filter(
          (o) => o.domain === vector.domain && o.opportunityClass === vector.subject.key),
        metrics: ['OPPORTUNITY_QUALITY'],
      });
    }
    const drift = driftSubjects.flatMap((entry) =>
      entry.metrics.map((metric) => assessDrift(entry.subject, metric, entry.population, config)))
      .sort((a, b) => (a.driftId < b.driftId ? -1 : 1));
    for (const assessment of drift) {
      audit.append('drift-detected', {
        driftId: assessment.driftId, subject: assessment.subject.key,
        metric: assessment.metric, classification: assessment.classification,
        delta: assessment.observedDelta,
      });
    }

    // Confidence per subject.
    const confidence = [
      ...strategyLearning.map((s) => ({subject: `STRATEGY:${s.strategyId}`,
        observations: observations.filter((o) => o.strategyId === s.strategyId),
        consistency: s.metrics.consistency, comparable: s.domain !== 'MIXED',
        contradicting: contradictedStrategies.has(s.strategyId) ? 1 : 0,
        stability: s.stability})),
      ...venueLearning.map((v) => ({subject: `VENUE:${v.venue}`,
        observations: observations.filter((o) => o.venues.includes(v.venue)),
        consistency: v.metrics.fillEfficiency, comparable: true,
        contradicting: 0, stability: v.metrics.stability})),
      ...policyLearning.map((p) => ({subject: `POLICY:${p.policyId}@${p.policyVersion}`,
        observations: observations.filter(
          (o) => o.policyId === p.policyId && o.policyVersion === p.policyVersion),
        consistency: p.executionQuality, comparable: true,
        contradicting: 0, stability: p.stability})),
    ].map((entry) => {
      const assessment = assessConfidence({
        subject: entry.subject,
        observations: entry.observations,
        consistency: entry.consistency,
        comparable: entry.comparable,
        contradicting: entry.contradicting,
        stability: entry.stability,
        freshness: freshnessOf(entry.observations, config.freshnessReferenceMs, timestamp),
      }, config);
      audit.append('evidence-evaluated', {
        confidenceId: assessment.confidenceId, subject: assessment.subject,
        state: assessment.state, score: assessment.score,
      });
      return assessment;
    });

    // Signals — informational, causal-safe, evidence-backed.
    const signals: LearningSignal[] = [];
    const batchIds = [...new Set(observations.map((o) => o.lineage.batchId))].sort();
    const lineageOf = (population: readonly LearningObservation[]) => ({
      researchAnalysisId: research.analysisId,
      batchIds,
      findingIds: [...new Set(population.flatMap((o) => o.lineage.findingIds))].sort(),
      patternIds: [...new Set(population.flatMap((o) => o.lineage.patternIds))].sort(),
      hypothesisIds: [...new Set(population.flatMap((o) => o.lineage.hypothesisIds))].sort(),
      observationIds: population.map((o) => o.observationId).sort(),
    });

    for (const learning of strategyLearning) {
      const population = observations.filter((o) => o.strategyId === learning.strategyId);
      signals.push(buildSignal({
        subject: {kind: 'STRATEGY', key: learning.strategyId},
        kind: 'STRATEGY_SIGNAL',
        scope: `domain=${learning.domain}`,
        statement: `strategy ${learning.strategyId} is historically classified ${learning.classification} (mean preservation ${learning.metrics.preservation === null ? 'unavailable' : learning.metrics.preservation.toFixed(3)}; ${learning.metrics.sampleSize} observations)`,
        classification: learning.classification,
        supportingEvidenceIds: population.map((o) => o.observationId),
        contradictingEvidenceIds: contradictedStrategies.has(learning.strategyId)
          ? population.map((o) => o.observationId).slice(0, Math.max(1, Math.floor(population.length / 2)))
          : [],
        baseline: learning.baseline,
        measuredDelta: learning.baselineDelta,
        confidenceState: learning.evidenceState,
        stability: learning.stability,
        regime: null,
        provenance: learning.provenance,
        lineage: lineageOf(population),
      }, config));
    }
    for (const learning of opportunityLearning) {
      const population = observations.filter(
        (o) => o.domain === learning.domain && o.opportunityClass === learning.opportunityClass);
      signals.push(buildSignal({
        subject: {kind: 'OPPORTUNITY_CLASS', key: learning.opportunityClass},
        kind: 'OPPORTUNITY_SIGNAL',
        scope: `domain=${learning.domain}`,
        statement: `opportunity class ${learning.opportunityClass} historically preserves ${learning.meanPreservation === null ? 'an unmeasurable share' : learning.meanPreservation.toFixed(3)} of theoretical value (classification ${learning.classification})`,
        classification: learning.classification,
        supportingEvidenceIds: population.map((o) => o.observationId),
        contradictingEvidenceIds: [],
        baseline: null,
        measuredDelta: null,
        confidenceState: learning.evidenceState,
        stability: stabilityBySubject.get(`OPPORTUNITY_CLASS:${learning.opportunityClass}`)?.classification ?? 'INSUFFICIENT_EVIDENCE',
        regime: null,
        provenance: learning.provenance,
        lineage: lineageOf(population),
      }, config));
    }
    for (const learning of venueLearning) {
      const population = observations.filter((o) => o.venues.includes(learning.venue));
      signals.push(buildSignal({
        subject: {kind: 'VENUE', key: learning.venue},
        kind: 'VENUE_SIGNAL',
        scope: `domains=${learning.domains.join('+')}`,
        statement: `venue ${learning.venue} is historically ${learning.classification} (mean fill efficiency ${learning.metrics.fillEfficiency === null ? 'unavailable' : learning.metrics.fillEfficiency.toFixed(3)}, mean leg leakage ${learning.metrics.leakage === null ? 'unavailable' : learning.metrics.leakage.toFixed(3)})`,
        classification: learning.classification,
        supportingEvidenceIds: population.map((o) => o.observationId),
        contradictingEvidenceIds: [],
        baseline: learning.baseline,
        measuredDelta: learning.baselineDelta,
        confidenceState: learning.evidenceState,
        stability: learning.metrics.stability,
        regime: null,
        provenance: learning.provenance,
        lineage: lineageOf(population),
      }, config));
    }
    for (const {learning, population} of policyPairs) {
      signals.push(buildSignal({
        subject: {kind: 'POLICY', key: `${population[0].domain}:${learning.policyId}@${learning.policyVersion}`},
        kind: 'POLICY_SIGNAL',
        scope: `role=${learning.role}`,
        statement: `policy ${learning.policyId}@${learning.policyVersion} is historically classified ${learning.classification}${learning.deltaVsBaseline ? ` (execution-quality delta ${learning.deltaVsBaseline.executionQuality === null ? 'unavailable' : learning.deltaVsBaseline.executionQuality.toFixed(3)}, end-to-end preservation delta ${learning.deltaVsBaseline.endToEndPreservation === null ? 'unavailable' : learning.deltaVsBaseline.endToEndPreservation.toFixed(3)})` : ''}`,
        classification: learning.classification,
        supportingEvidenceIds: population.map((o) => o.observationId),
        contradictingEvidenceIds: [],
        baseline: null,
        measuredDelta: learning.deltaVsBaseline?.endToEndPreservation ?? null,
        confidenceState: learning.evidenceState,
        stability: learning.stability,
        regime: null,
        provenance: learning.provenance,
        lineage: lineageOf(population),
      }, config));
    }
    for (const learning of leakageLearning) {
      if (learning.occurrences === 0) continue;
      const population = observations.filter(
        (o) => (o.values.leakageByComponent[learning.component] ?? 0) > 0);
      signals.push(buildSignal({
        subject: {kind: 'LEAKAGE_COMPONENT', key: learning.component},
        kind: 'LEAKAGE_SIGNAL',
        scope: `domain=${learning.domain}`,
        statement: `leakage component ${learning.component} recurs in ${learning.occurrences} of ${learning.sampleSize} ${learning.domain} observations (total ${learning.totalValue.toFixed(2)})`,
        classification: learning.evidenceState === 'INSUFFICIENT' ? 'INSUFFICIENT_EVIDENCE' : 'RECURRING',
        supportingEvidenceIds: population.map((o) => o.observationId),
        contradictingEvidenceIds: [],
        baseline: null,
        measuredDelta: learning.trend,
        confidenceState: learning.evidenceState,
        stability: 'STABLE',
        regime: null,
        provenance: learning.provenance,
        lineage: lineageOf(population),
      }, config));
    }
    for (const regime of regimes) {
      const population = observations.filter((o) => o.timeBucket === regime.timeBucket);
      const adverse = regime.dimensions.filter(
        (d) => d.classification === 'ADVERSE' || d.classification === 'DETERIORATING');
      signals.push(buildSignal({
        subject: {kind: 'REGIME', key: regime.timeBucket},
        kind: 'REGIME_SIGNAL',
        scope: `era=${regime.era}`,
        statement: `historical regime ${regime.timeBucket}: ${regimeSummary(regime)}`,
        classification: adverse.length > 0 ? 'ADVERSE' : 'NORMAL',
        supportingEvidenceIds: population.map((o) => o.observationId),
        contradictingEvidenceIds: [],
        baseline: null,
        measuredDelta: null,
        confidenceState: regime.evidenceState,
        stability: 'STABLE',
        regime: regime.timeBucket,
        provenance: regime.provenance,
        lineage: lineageOf(population),
      }, config));
    }
    for (const assessment of drift) {
      const population = assessment.subject.kind === 'STRATEGY'
        ? observations.filter((o) => o.strategyId === assessment.subject.key)
        : assessment.subject.kind === 'VENUE'
          ? observations.filter((o) => o.venues.includes(assessment.subject.key))
          : assessment.subject.kind === 'POLICY'
            ? observations.filter((o) => `${o.domain}:${o.policyId}@${o.policyVersion}` === assessment.subject.key)
            : observations.filter((o) => o.opportunityClass === assessment.subject.key);
      signals.push(buildSignal({
        subject: assessment.subject,
        kind: 'DRIFT_SIGNAL',
        scope: `metric=${assessment.metric}`,
        statement: `${assessment.metric} for ${assessment.subject.kind.toLowerCase()} ${assessment.subject.key} historically drifted ${assessment.classification} (delta ${assessment.observedDelta === null ? 'unavailable' : assessment.observedDelta.toFixed(3)})`,
        classification: assessment.classification,
        supportingEvidenceIds: population.map((o) => o.observationId),
        contradictingEvidenceIds: [],
        baseline: assessment.baseline,
        measuredDelta: assessment.observedDelta,
        confidenceState: assessment.evidenceState,
        stability: assessment.classification === 'STRUCTURAL_SHIFT' ? 'FRAGILE' : 'STABLE',
        regime: null,
        provenance: 'DERIVED',
        lineage: lineageOf(population),
      }, config));
    }
    // Evidence-gap signals for under-sampled subjects (research priority input).
    for (const learning of [...strategyLearning, ...venueLearning, ...policyLearning,
      ...opportunityLearning]) {
      if (learning.classification !== 'INSUFFICIENT_EVIDENCE') continue;
      const key = 'strategyId' in learning ? learning.strategyId
        : 'venue' in learning ? learning.venue
          : 'opportunityClass' in learning ? learning.opportunityClass
            : `${learning.policyId}@${learning.policyVersion}`;
      const kind = 'strategyId' in learning ? 'STRATEGY' : 'venue' in learning ? 'VENUE'
        : 'opportunityClass' in learning ? 'OPPORTUNITY_CLASS' : 'POLICY';
      const population = kind === 'STRATEGY'
        ? observations.filter((o) => o.strategyId === key)
        : kind === 'VENUE'
          ? observations.filter((o) => o.venues.includes(key))
          : kind === 'OPPORTUNITY_CLASS'
            ? observations.filter((o) => o.opportunityClass === key)
            : observations.filter((o) => key.endsWith(`${o.policyId}@${o.policyVersion}`)
              && key.startsWith(o.domain));
      if (population.length === 0) continue;
      signals.push(buildSignal({
        subject: {kind, key},
        kind: 'RESEARCH_PRIORITY_SIGNAL',
        scope: `evidence-gap`,
        statement: `${kind.toLowerCase()} ${key} has only ${population.length} observations — below the analytical floor of ${config.minSampleSize}`,
        classification: 'INSUFFICIENT_EVIDENCE',
        supportingEvidenceIds: population.map((o) => o.observationId),
        contradictingEvidenceIds: [],
        baseline: null,
        measuredDelta: null,
        confidenceState: 'INSUFFICIENT',
        stability: 'INSUFFICIENT_EVIDENCE',
        regime: null,
        provenance: 'DERIVED',
        lineage: lineageOf(population),
      }, config));
    }
    signals.sort((a, b) => (a.signalId < b.signalId ? -1 : a.signalId > b.signalId ? 1 : 0));
    for (const signal of signals) {
      audit.append('signal-created', {
        signalId: signal.signalId, kind: signal.kind, subject: signal.subject.key,
        classification: signal.classification,
      });
    }

    const priorities = buildPriorities(signals.filter(isPriorityWorthy), config);
    for (const priority of priorities) {
      audit.append('priority-created', {
        priorityId: priority.priorityId, kind: priority.kind, rank: priority.rank,
        score: priority.score,
      });
    }

    const recommendations = [
      ...strategyLearning.filter((s) =>
        s.classification === 'DETERIORATING' || s.classification === 'HIGH_THEORETICAL_LOW_REALIZATION'
        || s.classification === 'CONSISTENT_UNDERPERFORMER')
        .map((s) => monitorRecommendation(
          signals.find((sig) => sig.subject.kind === 'STRATEGY' && sig.subject.key === s.strategyId)!, config)),
      ...venueLearning.filter((v) =>
        v.classification === 'CONSISTENTLY_WEAK' || v.classification === 'DETERIORATING')
        .map((v) => monitorRecommendation(
          signals.find((sig) => sig.subject.kind === 'VENUE' && sig.subject.key === v.venue)!, config)),
      ...signals.filter((s) => s.classification === 'INSUFFICIENT_EVIDENCE' && s.kind !== 'DRIFT_SIGNAL')
        .map((s) => collectEvidenceRecommendation(s, config)),
      ...(priorities.length > 0
        ? [researchInvestigationRecommendation(
          `${priorities[0].subject.kind}:${priorities[0].subject.key}`,
          priorities[0].statement, config)]
        : []),
      ...strategyLearning.filter((s) => s.classification === 'NOT_COMPARABLE')
        .map((s) => comparabilityRecommendation(`STRATEGY:${s.strategyId}`, config)),
    ].filter((rec, index, all) =>
      all.findIndex((r) => r.recommendationId === rec.recommendationId) === index)
      .sort((a, b) => (a.recommendationId < b.recommendationId ? -1 : 1));

    const feedback = [
      ...priorities.slice(0, 3).map((priority) => {
        const signal = signals.find(
          (s) => s.signalId === priority.lineage.signalIds[0])!;
        return researchQueryFeedback(signal, priority, config);
      }),
      ...signals.filter((s) => s.classification === 'INSUFFICIENT_EVIDENCE' && s.kind === 'RESEARCH_PRIORITY_SIGNAL')
        .map((s) => evidenceGapFeedback(s, config)),
      ...(priorities.length > 0 ? [priorityUpdateFeedback(priorities[0], config)] : []),
    ].sort((a, b) => (a.feedbackId < b.feedbackId ? -1 : 1));
    for (const item of feedback) {
      audit.append('feedback-created', {
        feedbackId: item.feedbackId, kind: item.kind, subject: item.subject,
      });
    }

    const lineage = buildLearningLineage({
      research, observations, features, signals, priorities,
      recommendations, feedback,
    });

    const core: LearningResult = Object.freeze({
      analysisId,
      timestamp,
      schemaVersion: 'learning.v1',
      correlationId: input.correlationId,
      traceId: input.traceId,
      configurationFingerprint: this.configurationFingerprint,
      analysisFingerprint: '',
      causalPolicy: 'ASSOCIATIONAL_ONLY',
      source: Object.freeze({
        researchAnalysisId: research.analysisId,
        researchFingerprint: research.analysisFingerprint,
        memoryRecords: research.memory.records.length,
        batches: research.batches,
        findings: research.findings.length,
        patterns: research.patterns.length,
        hypotheses: research.hypotheses.length,
      }),
      observations,
      features,
      featureVectors,
      cohorts,
      baselines,
      regimes,
      strategyLearning,
      opportunityLearning,
      venueLearning,
      policyLearning,
      leakageLearning,
      drift,
      stability: [...stabilityBySubject.values()].sort(
        (a, b) => (a.stabilityId < b.stabilityId ? -1 : 1)),
      confidence,
      signals,
      priorities,
      recommendations,
      feedback,
      lineage,
      auditEvents: audit.snapshot(),
      invariants: Object.freeze({passed: true, checks: [], failedCount: 0}),
      replay: Object.freeze({identical: false, fingerprint: ''}),
    });
    const withFingerprint = Object.freeze({
      ...core,
      analysisFingerprint: analysisFingerprintOf({
        analysisId, observations: observations.length, signals: signals.length,
        priorities: priorities.length, lineage: lineage.fingerprint,
      }),
    });
    return {core: withFingerprint, audit};
  }
}

export type {FeatureVector};
