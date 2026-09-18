/**
 * SPRINT 043 — fail-closed gallery plumbing: re-exports the gallery and
 * the full rejection code list for the fail-closed report.
 */

import {INPUT_REJECTION_CODES} from '../types';
import type {InputRejectionCode} from '../types';

export {inputRejectionGallery, expectInputRejection,
  assertInputRejects, cleanEvaluationResult, bridgeInputOf,
  staleStrategyConstraint, knownExposureConstraint,
} from '../test-fixtures';

export const INPUT_REJECTION_CODE_LIST: readonly InputRejectionCode[]
  = INPUT_REJECTION_CODES;
