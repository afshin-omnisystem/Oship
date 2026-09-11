import {ResearchEngine, researchInput} from '../research';
import type {ResearchResult} from '../research/types';

/**
 * SPRINT 037 — learning test fixtures.
 *
 * The learning corpus is the REAL Sprint 036 research result over the REAL
 * five-era closed-loop history (65 memory records, 3 strategies, 2 venues,
 * 2 policy versions, all 11 opportunity classes, AFIS + ABL). Fixtures
 * refuse to build if the research result fails its own invariants.
 */

export const LEARNING_FIXTURE_TIMESTAMP = 1735689600000;

let corpusCache: ResearchResult | null = null;

/** The validated Sprint 036 research result (memoized, frozen). */
export function learningCorpus(): ResearchResult {
  if (corpusCache) return corpusCache;
  const engine = new ResearchEngine({});
  const result = engine.analyze(researchInput());
  if (!result.invariants.passed) {
    throw new Error('learning fixtures: research corpus failed its own invariants — fail closed');
  }
  corpusCache = result;
  return result;
}

export function learningInput(): {
  research: ResearchResult; timestamp: number; correlationId: string; traceId: string;
} {
  return {
    research: learningCorpus(),
    timestamp: LEARNING_FIXTURE_TIMESTAMP,
    correlationId: 'corr-learning-fixture',
    traceId: 'trace-learning-fixture',
  };
}

/** A research result whose invariants FAILED — learning must reject it. */
export function invariantFailedResearch(): ResearchResult {
  const research = learningCorpus();
  return Object.freeze({
    ...research,
    invariants: Object.freeze({
      passed: false,
      checks: research.invariants.checks,
      failedCount: 1,
    }),
  });
}

/**
 * A research result where the guardian hypothesis is CONTRADICTED — the
 * learning plane must surface the contradicted subject honestly
 * (CONTRADICTORY stability / contradicting evidence).
 */
export function contradictedResearch(): ResearchResult {
  const research = learningCorpus();
  const hypotheses = research.hypotheses.map((h) =>
    h.statement.includes('arb-guardian preserves more')
      ? {...h, status: 'CONTRADICTED' as const}
      : h);
  return Object.freeze({...research, hypotheses: Object.freeze(hypotheses)});
}

/** A research result with an empty memory — learning must fail closed. */
export function emptyResearch(): ResearchResult {
  const research = learningCorpus();
  return Object.freeze({
    ...research,
    memory: Object.freeze({
      ...research.memory,
      records: Object.freeze([]),
    }),
  });
}
