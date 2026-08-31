import {OiinEvent} from '../types';export interface DeduplicationResult{accepted:boolean;duplicate:boolean;event:OiinEvent}export interface Deduplicator{check(e:OiinEvent):DeduplicationResult}
