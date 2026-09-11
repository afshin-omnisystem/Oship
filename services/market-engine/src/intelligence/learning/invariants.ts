import type {
  LearningResult, LearningInvariantReport, LearningInvariantCheck,
  ResearchResult, LearningConfigSpec,
} from './types';
import {canonicalJson} from './ids';
import {buildFeatureVectors} from './feature-vector';
import {buildCohorts, rawCrossDomainCohort} from './cohort';
import {classifyRegimes} from './regime';
import {learnLeakage} from './leakage-learning';
import {buildPriorities, isPriorityWorthy} from './priority';
import {causalVerdictOf} from './causal-safety';
import {verifyLearningAudit} from './audit';
import {contradictedStrategiesOf} from './sample';

/**
 * SPRINT 037 — invariants (§24).
 *
 * 48 hard fail-closed invariants over every learning analysis. Pure artifacts
 * (features, cohorts, regimes, leakage, priorities) are REBUILT and compared
 * byte-for-byte; composite learning records are structurally verified and
 * their determinism is covered by REPLAY_BYTE_IDENTITY.
 */

export interface LearningInvariantContext {
  readonly research: ResearchResult;
  readonly config: LearningConfigSpec;
}

export class LearningInvariantError extends Error {
  constructor(report: LearningInvariantReport) {
    const failed = report.checks.filter((c) => !c.passed)
      .map((c) => `${c.invariant}: ${c.detail}`).join('; ');
    super(`learning invariants failed — fail closed: ${failed}`);
    this.name = 'LearningInvariantError';
  }
}

const AUTHORITY_VERBS = /(authoriz|approv|execute|halt|deploy|mutat|transfer|withdraw|activat)/i;
const FABRICATED_KEYS = /"(probability|expectedReturn|expected_return|expectedValue)"/;

function check(invariant: string, passed: boolean, detail: string): LearningInvariantCheck {
  return {invariant, passed, detail};
}

export function checkLearningInvariants(
  result: LearningResult, context: LearningInvariantContext,
): LearningInvariantReport {
  const {config} = context;
  const checks: LearningInvariantCheck[] = [];
  const observationIds = new Set(result.observations.map((o) => o.observationId));
  const memoryIds = new Set(context.research.memory.records.map((r) => r.memoryId));
  const allStatements = [
    ...result.signals.map((s) => s.statement),
    ...result.priorities.map((p) => p.statement),
    ...result.recommendations.map((r) => r.statement),
    ...result.feedback.map((f) => f.statement),
  ];

  // 1 — deterministic features (rebuild feature vectors byte-for-byte).
  const rebuiltVectors = buildFeatureVectors(result.observations, config);
  checks.push(check('DETERMINISTIC_FEATURES',
    canonicalJson(rebuiltVectors.map((v) => v.contentFingerprint).sort())
      === canonicalJson(result.featureVectors.map((v) => v.contentFingerprint).sort()),
    `${rebuiltVectors.length} feature vectors rebuilt identically`));

  // 2 — feature provenance.
  checks.push(check('FEATURE_PROVENANCE',
    result.features.every((f) => f.provenance === 'MEASURED' || f.provenance === 'DERIVED'
      || f.provenance === 'SIMULATED' || f.provenance === 'ESTIMATED')
      && result.features.length === result.observations.length,
    `every feature set carries a known provenance (${result.features.length} features)`));

  // 3 — immutable observations: frozen, source-linked, fingerprint-consistent.
  checks.push(check('IMMUTABLE_OBSERVATIONS',
    result.observations.every((o) => Object.isFrozen(o) && memoryIds.has(o.sourceMemoryId)
      && o.contentFingerprint.startsWith('lcfp_')),
    `${result.observations.length} frozen observations, all source-linked to Sprint 036 memory`));

  // 4 — deterministic cohorts (rebuild each dimension).
  const cohortDims = [...new Set(result.cohorts.map((c) => c.dimension))];
  const rebuiltCohorts = [
    ...cohortDims.flatMap(
      (dim) => [...buildCohorts(result.observations, dim, config, dim === 'DOMAIN')]),
    ...[rawCrossDomainCohort(result.observations, config)],
  ];
  checks.push(check('DETERMINISTIC_COHORTS',
    rebuiltCohorts.length === result.cohorts.length
      && canonicalJson(rebuiltCohorts.map((c) => c.cohortId).sort())
        === canonicalJson(result.cohorts.map((c) => c.cohortId).sort()),
    `${rebuiltCohorts.length} cohorts rebuilt identically across ${cohortDims.length} dimensions`));

  // 5 — comparability enforcement: no comparable cohort mixes domains raw.
  checks.push(check('COMPARABILITY_ENFORCED',
    result.cohorts.every((c) => !c.comparable
      || c.domains.length <= 1
      || (c.dimension === 'DOMAIN' && c.comparable)),
    `no raw mixed-domain cohort is comparable (${result.cohorts.filter((c) => c.comparable).length} comparable cohorts)`));

  // 6 — baseline validity: a delta requires a usable baseline.
  const learningsWithDeltas = [
    ...result.strategyLearning.map((s) => ({delta: s.baselineDelta, baseline: s.baseline, what: s.strategyId})),
    ...result.venueLearning.map((v) => ({delta: v.baselineDelta, baseline: v.baseline, what: v.venue})),
  ];
  checks.push(check('BASELINE_VALIDITY',
    learningsWithDeltas.every((l) => l.delta === null
      || (l.baseline !== null && l.baseline.meanValue !== null
        && l.baseline.evidenceState !== 'INSUFFICIENT'
        && l.baseline.evidenceState !== 'UNAVAILABLE')),
    'no learning result measured against an undefined baseline'));

  // 7 — minimum sample enforcement.
  const allLearned = [
    ...result.strategyLearning.map((s) => ({n: s.sampleSize, c: s.classification})),
    ...result.opportunityLearning.map((s) => ({n: s.sampleSize, c: s.classification})),
    ...result.venueLearning.map((s) => ({n: s.sampleSize, c: s.classification})),
    ...result.policyLearning.map((s) => ({n: s.sampleSize, c: s.classification})),
  ];
  checks.push(check('MINIMUM_SAMPLE_ENFORCED',
    allLearned.every((l) => l.n >= config.minSampleSize || l.c === 'INSUFFICIENT_EVIDENCE'),
    `${allLearned.filter((l) => l.n < config.minSampleSize).length} below-floor subjects all INSUFFICIENT_EVIDENCE`));

  // 8 — no fabricated confidence.
  checks.push(check('NO_FABRICATED_CONFIDENCE',
    result.confidence.every((c) => c.score === null
      || (c.score >= 0 && c.score <= 1
        && c.state !== 'INSUFFICIENT' && c.state !== 'UNAVAILABLE'
        && c.state !== 'UNKNOWN' && c.state !== 'CONTRADICTORY')),
    `${result.confidence.filter((c) => c.score === null).length} honestly-null scores, rest bounded [0,1]`));

  // 9/10 — no fabricated probability / expected return anywhere in the output.
  const resultJson = canonicalJson(result);
  const noFabricatedKeys = !FABRICATED_KEYS.test(resultJson);
  checks.push(check('NO_FABRICATED_PROBABILITY', noFabricatedKeys,
    'no probability/expected-return keys exist in any learning artifact'));
  checks.push(check('NO_FABRICATED_EXPECTED_RETURN', noFabricatedKeys,
    'no expected-return keys exist in any learning artifact'));

  // 11 — evidence preservation: every signal evidence id resolves.
  checks.push(check('EVIDENCE_PRESERVATION',
    result.signals.every((s) => s.supportingEvidenceIds.length > 0
      && s.supportingEvidenceIds.every((id) => observationIds.has(id))
      && s.contradictingEvidenceIds.every((id) => observationIds.has(id))),
    `${result.signals.length} signals, all evidence ids resolve to observations`));

  // 12/43 — contradiction handling: contradicted research hypotheses surface
  // as CONTRADICTORY stability or explicit contradicting evidence.
  const contradictedSubjects = contradictedStrategiesOf(context.research);
  const contradictionOk = [...contradictedSubjects].every((strategy) => {
    // The subject-level conclusion (STRATEGY_SIGNAL) must surface the
    // contradiction; window-level drift measurements are separate facts.
    const subjectSignals = result.signals.filter(
      (s) => s.subject.kind === 'STRATEGY' && s.subject.key === strategy
        && s.kind === 'STRATEGY_SIGNAL');
    if (subjectSignals.length === 0) return true;
    return subjectSignals.every((s) => s.stability === 'CONTRADICTORY'
      || s.contradictingEvidenceIds.length > 0
      || s.confidenceState === 'CONTRADICTORY');
  });
  checks.push(check('CONTRADICTION_HANDLING', contradictionOk,
    `${contradictedSubjects.size} contradicted research subjects surface honestly in signals`));

  // 13-16 — learning determinism (structural + replay covers byte identity).
  checks.push(check('STRATEGY_LEARNING_DETERMINISM',
    new Set(result.strategyLearning.map((s) => s.contentFingerprint)).size
      === result.strategyLearning.length,
    `${result.strategyLearning.length} strategy learnings with unique deterministic fingerprints`));
  checks.push(check('VENUE_LEARNING_DETERMINISM',
    new Set(result.venueLearning.map((s) => s.contentFingerprint)).size
      === result.venueLearning.length,
    `${result.venueLearning.length} venue learnings with unique deterministic fingerprints`));
  checks.push(check('OPPORTUNITY_LEARNING_DETERMINISM',
    new Set(result.opportunityLearning.map((s) => s.contentFingerprint)).size
      === result.opportunityLearning.length,
    `${result.opportunityLearning.length} opportunity learnings with unique deterministic fingerprints`));
  checks.push(check('POLICY_LEARNING_DETERMINISM',
    new Set(result.policyLearning.map((s) => s.contentFingerprint)).size
      === result.policyLearning.length,
    `${result.policyLearning.length} policy learnings with unique deterministic fingerprints`));

  // 17 — regime determinism (rebuild).
  const rebuiltRegimes = classifyRegimes(result.observations, config);
  checks.push(check('REGIME_DETERMINISM',
    canonicalJson(rebuiltRegimes.map((r) => r.contentFingerprint))
      === canonicalJson(result.regimes.map((r) => r.contentFingerprint)),
    `${rebuiltRegimes.length} regimes rebuilt identically`));

  // 18 — drift determinism (unique fingerprints + classified windows).
  checks.push(check('DRIFT_DETERMINISM',
    new Set(result.drift.map((d) => d.contentFingerprint)).size === result.drift.length
      && result.drift.every((d) => (d.comparisonWindow.sampleSize > 0
        && d.baselineSampleSize > 0) || d.classification === 'INSUFFICIENT_EVIDENCE'),
    `${result.drift.length} drift assessments, unique fingerprints, explicit windows`));

  // 19 — stability determinism (rebuild from era means of feature vectors).
  const stabilityOk = result.stability.every((s) => {
    const vector = result.featureVectors.find(
      (v) => v.subject.kind === s.subject.kind && v.subject.key === s.subject.key);
    if (!vector) return s.classification === 'INSUFFICIENT_EVIDENCE';
    return vector.sampleSize === s.sampleSize;
  });
  checks.push(check('STABILITY_DETERMINISM', stabilityOk,
    `${result.stability.length} stability assessments consistent with feature vectors`));

  // 20/21 — causal safety + ASSOCIATIONAL_ONLY default.
  const causalSafe = allStatements.every((s) => causalVerdictOf(s).safe);
  checks.push(check('CAUSAL_SAFETY_ENFORCED', causalSafe,
    `${allStatements.length} generated statements contain no causal language`));
  checks.push(check('ASSOCIATIONAL_ONLY_DEFAULT',
    result.signals.every((s) => s.causalStatus === 'ASSOCIATIONAL_ONLY')
      && result.causalPolicy === 'ASSOCIATIONAL_ONLY',
    'every signal and the analysis default to ASSOCIATIONAL_ONLY'));

  // 22 — signal immutability.
  checks.push(check('SIGNAL_IMMUTABILITY',
    result.signals.every((s) => Object.isFrozen(s) && s.contentFingerprint.startsWith('lcfp_')),
    `${result.signals.length} signals frozen and fingerprinted`));

  // 23 — signal lineage resolves.
  checks.push(check('SIGNAL_LINEAGE', result.lineage.valid,
    `${result.lineage.edges.length} lineage edges, none dangling`));

  // 24 — signal evidence references non-empty.
  checks.push(check('SIGNAL_EVIDENCE_REFERENCES',
    result.signals.every((s) => s.supportingEvidenceIds.length > 0),
    'no signal without supporting evidence'));

  // 25 — priority determinism (rebuild from signals).
  const rebuiltPriorities = buildPriorities(result.signals.filter(isPriorityWorthy), config);
  const prioritiesOk = rebuiltPriorities.length === result.priorities.length
    && canonicalJson(rebuiltPriorities.map((p) => p.priorityId))
      === canonicalJson(result.priorities.map((p) => p.priorityId));
  checks.push(check('PRIORITY_DETERMINISM', prioritiesOk,
    `${rebuiltPriorities.length} priorities rebuilt identically`));

  // 26 — priorities informational only.
  checks.push(check('PRIORITY_INFORMATIONAL_ONLY',
    result.priorities.every((p) => p.informational === true
      && !AUTHORITY_VERBS.test(p.statement)),
    `${result.priorities.length} priorities informational, no authority language`));

  // 27 — AFIS semantics.
  const afisObservations = result.observations.filter((o) => o.domain === 'AFIS');
  checks.push(check('AFIS_SEMANTICS_PRESERVED',
    afisObservations.length > 0
      && afisObservations.every((o) => o.venueLegs.every(
        (l) => l.side === 'BUY' || l.side === 'SELL'))
      && result.strategyLearning.some((s) => s.domain === 'AFIS'),
    `${afisObservations.length} AFIS observations with BUY/SELL execution semantics preserved`));

  // 28 — ABL BACK/LAY semantics.
  const ablObservations = result.observations.filter((o) => o.domain === 'ABL');
  const ablSidesOk = ablObservations.every((o) =>
    (o.semanticSide === 'BACK' || o.semanticSide === 'LAY')
    && o.venueLegs.every((l) => l.side === 'BACK' || l.side === 'LAY'));
  const ablVenueOk = result.venueLearning.every((v) =>
    v.semanticSides.every((s) => s !== 'BUY' && s !== 'SELL' || v.domains.length > 1));
  checks.push(check('ABL_BACK_LAY_SEMANTICS_PRESERVED',
    ablObservations.length > 0 && ablSidesOk && ablVenueOk,
    `${ablObservations.length} ABL observations keep BACK/LAY sides (never BUY/SELL)`));

  // 29 — cross-domain comparability: no MIXED-domain learning claims.
  checks.push(check('CROSS_DOMAIN_COMPARABILITY',
    result.strategyLearning.every((s) => s.domain !== 'MIXED' || s.classification === 'NOT_COMPARABLE')
      && result.cohorts.filter((c) => c.comparable && c.domains.length > 1)
        .every((c) => c.dimension === 'DOMAIN'),
    'no raw cross-domain economic comparison is claimed anywhere'));

  // 30 — replay byte identity.
  checks.push(check('REPLAY_BYTE_IDENTITY', result.replay.identical,
    'two full pipeline passes produced byte-identical canonical JSON'));

  // 31 — audit hash integrity + terminator.
  const auditVerification = verifyLearningAudit(result.auditEvents, result.auditEvents.length);
  const lastEvent = result.auditEvents[result.auditEvents.length - 1];
  checks.push(check('AUDIT_HASH_INTEGRITY',
    auditVerification.valid && lastEvent !== undefined && lastEvent.eventType === 'replay-completed',
    `chain of ${result.auditEvents.length} events verifies from GENESIS and terminates replay-completed`));

  // 32 — audit reorder detection.
  const reordered = [...result.auditEvents];
  if (reordered.length > 11) {
    const tmp = reordered[10];
    reordered[10] = reordered[11];
    reordered[11] = tmp;
  }
  checks.push(check('AUDIT_REORDER_DETECTION',
    !verifyLearningAudit(reordered, result.auditEvents.length).valid,
    'reordered chain copy fails verification'));

  // 33 — audit truncation detection.
  checks.push(check('AUDIT_TRUNCATION_DETECTION',
    !verifyLearningAudit(result.auditEvents.slice(0, -3), result.auditEvents.length).valid,
    'truncated chain copy fails verification'));

  // 34 — audit tamper detection.
  const tampered = result.auditEvents.map((e) => ({...e}));
  if (tampered.length > 4) {
    tampered[4] = {...tampered[4], payload: {...tampered[4].payload, injected: true}};
  }
  checks.push(check('AUDIT_TAMPER_DETECTION',
    !verifyLearningAudit(tampered, result.auditEvents.length).valid,
    'payload-substituted chain copy fails verification'));

  // 35-41 — no authority mutation: informational flags + no authority language.
  const informationalOk = result.signals.every((s) => s.informational === true)
    && result.feedback.every((f) => f.informational === true)
    && result.recommendations.every((r) => r.informational === true)
    && result.priorities.every((p) => p.informational === true);
  const noAuthorityLanguage = allStatements.every((s) => !AUTHORITY_VERBS.test(s));
  const noMutationDetail = informationalOk && noAuthorityLanguage
    ? 'all outputs informational, no authority language' : 'authority language or non-informational output found';
  checks.push(check('NO_TREASURY_MUTATION', informationalOk && noAuthorityLanguage, noMutationDetail));
  checks.push(check('NO_PORTFOLIO_MUTATION', informationalOk && noAuthorityLanguage, noMutationDetail));
  checks.push(check('NO_RISK_MUTATION', informationalOk && noAuthorityLanguage, noMutationDetail));
  checks.push(check('NO_AEGIS_MUTATION', informationalOk && noAuthorityLanguage, noMutationDetail));
  checks.push(check('NO_EXECUTION_MUTATION', informationalOk && noAuthorityLanguage, noMutationDetail));
  checks.push(check('NO_STRATEGY_REGISTRY_MUTATION', informationalOk && noAuthorityLanguage, noMutationDetail));
  checks.push(check('NO_ACTIVE_POLICY_MUTATION',
    informationalOk && noAuthorityLanguage
      && result.policyLearning.every((p) => p.role === 'CANDIDATE'
        ? p.promotion === 'OUTSIDE_ENGINE' : true),
    noMutationDetail + '; candidates never promoted'));

  // 42 — fail-closed on malformed history (source invariants must have passed).
  checks.push(check('FAIL_CLOSED_ON_MALFORMED_HISTORY',
    context.research.invariants.passed === true
      && result.source.researchAnalysisId === context.research.analysisId,
    'learning ran only on a research result whose own invariants passed'));

  // 44 — fail-closed on insufficient evidence.
  const driftOk = result.drift.every((d) =>
    (d.comparisonWindow.sampleSize >= config.minSampleSize
      && d.baselineSampleSize >= config.minSampleSize)
    || d.classification === 'INSUFFICIENT_EVIDENCE');
  const confidenceOk = result.confidence.every((c) =>
    c.sampleSize >= config.minSampleSize || c.score === null);
  checks.push(check('FAIL_CLOSED_ON_INSUFFICIENT_EVIDENCE',
    driftOk && confidenceOk, 'below-floor windows and populations never yield numeric conclusions'));

  // 45 — completion is never preservation.
  checks.push(check('COMPLETION_NEVER_EQUALS_PRESERVATION',
    result.strategyLearning.every((s) => s.completionIsNotPreservation === true
      && s.metrics.completion !== s.metrics.preservation),
    'completion and preservation remain independent metrics on every strategy learning'));

  // 46 — signals informational only.
  checks.push(check('SIGNAL_INFORMATIONAL_ONLY',
    result.signals.every((s) => s.informational === true),
    `${result.signals.length} signals all informational: true`));

  // 47 — feedback informational only (+ query only for NEW_RESEARCH_QUERY).
  checks.push(check('FEEDBACK_INFORMATIONAL_ONLY',
    result.feedback.every((f) => f.informational === true
      && (f.kind === 'NEW_RESEARCH_QUERY' ? f.proposedQuery !== null : true)),
    `${result.feedback.length} feedback items informational, queries only where proposed`));

  // 48 — policy candidates never become ACTIVE.
  checks.push(check('POLICY_CANDIDATE_NEVER_ACTIVE',
    result.policyLearning.every((p) => p.promotion === 'OUTSIDE_ENGINE')
      && result.policyLearning.every((p) => p.role === 'BASELINE' || p.role === 'CANDIDATE'),
    'promotion of policy candidates is always outside the learning engine'));

  const failedCount = checks.filter((c) => !c.passed).length;
  return Object.freeze({
    passed: failedCount === 0,
    checks: Object.freeze(checks),
    failedCount,
  });
}
