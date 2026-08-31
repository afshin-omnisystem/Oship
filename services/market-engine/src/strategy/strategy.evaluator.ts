import {StrategyDecision} from './strategy.types';export function rankDecisions(ds:StrategyDecision[]){return [...ds].sort((a,b)=>b.confidence*b.expectedValue-a.confidence*a.expectedValue)}
