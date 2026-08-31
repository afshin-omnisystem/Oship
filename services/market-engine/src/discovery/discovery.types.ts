import {Domain,Observation,AgentId} from '../agent/agent.types'; export interface Opportunity {id:string;domain:Domain;type:string;instruments:string[];venues:string[];direction:string;timeWindow:string;conditions:Record<string,number>;expectedEdge:number;confidence:number;sources:AgentId[];discoveredAt:string;score?:OpportunityScore}
export interface OpportunityScore {version:string;value:number;dimensions:Record<string,number>}
export interface CandidateOpportunity extends Omit<Opportunity,'id'|'sources'|'score'>{agentId:AgentId;evidence?:Record<string,unknown>}
export interface ScoringConfig {version:string;weights:Record<string,number>}
export interface DiscoveryAgent {identity:import('../agent/agent.types').AgentIdentity; discover(o:Observation):CandidateOpportunity[]}
