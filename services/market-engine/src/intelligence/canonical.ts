import {canonicalize,sha256} from '../oiin/ids';export {canonicalize};export function intelligenceHash(x:unknown){return sha256(x)}
