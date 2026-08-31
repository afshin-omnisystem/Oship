import {Strategy} from './strategy.types';export function assertStrategy(s:Strategy){if(!s.id||!s.domain||!s.evaluate)throw new Error('invalid strategy');return s}
