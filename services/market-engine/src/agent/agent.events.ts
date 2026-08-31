import {AgentId,Domain} from './agent.types';
export interface AgentEvent<T=unknown>{eventId:string;timestamp:string;agentId:AgentId;domain:Domain;eventType:string;correlationId:string;causationId:string;payload:T;schemaVersion:'1.0'}
export function agentEvent<T>(type:string,agentId:AgentId,domain:Domain,timestamp:string,correlationId:string,payload:T,causationId='root'):AgentEvent<T>{return {eventId:`${type}:${agentId}:${timestamp}:${correlationId}`,timestamp,agentId,domain,eventType:type,correlationId,causationId,payload,schemaVersion:'1.0'}}
