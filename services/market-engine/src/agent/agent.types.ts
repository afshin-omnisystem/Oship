export type AgentId = string; export type Domain = 'AFIS'|'ABL';
export type AgentStatus='CREATED'|'INITIALIZING'|'ACTIVE'|'PAUSED'|'DEGRADED'|'STOPPING'|'STOPPED'|'FAILED';
export type AgentType='DISCOVERY'|'STRATEGY'; export type AgentRole=string;
export type Permission='DISCOVERY_READ_MARKET'|'DISCOVERY_READ_ODDS'|'DISCOVERY_READ_NEWS'|'DISCOVERY_CREATE_OPPORTUNITY'|'STRATEGY_EVALUATE'|'STRATEGY_PROPOSE_ACTION'|'EXECUTION_REQUEST'|'TREASURY_REQUEST'|'ADMIN'|'TREASURY_WRITE'|'EXECUTION_DIRECT'|'SECRET_READ';
export interface AgentIdentity {readonly id:AgentId; readonly domain:Domain; readonly type:AgentType; readonly role:AgentRole; readonly version:string; readonly trustScore:number; readonly createdAt:string; readonly updatedAt:string; readonly permissions:ReadonlySet<Permission>; status:AgentStatus}
export interface Observation {id:string; domain:Domain; kind:string; timestamp:string; payload:Record<string, unknown>; correlationId:string}
export interface Heartbeat {agentId:AgentId; timestamp:string; status:AgentStatus; lastEventAt:string; processedEvents:number; failedEvents:number; latencyMs:number; currentLoad:number}
export class DeterministicClock {private t:number; constructor(start='2025-01-01T00:00:00.000Z'){this.t=Date.parse(start)} now(){return new Date(this.t).toISOString()} tick(ms=1){this.t+=ms; return this.now()}}
