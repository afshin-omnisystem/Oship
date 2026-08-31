import {sha256} from '../oiin/ids';export const allocationId=(x:unknown)=>`alloc_${sha256(x).slice(0,16)}`
