import {OiinEventEnvelope} from '../types';export class CorrelationEngine{parent(e:OiinEventEnvelope,parentEventId:string){return Object.freeze({...e,parentEventId})}}
