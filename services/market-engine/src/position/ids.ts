import {sha256} from '../oiin/ids';export const positionId=(domain:string,instrument:string,correlation:string)=>`pos_${domain}_${sha256({domain,instrument,correlation}).slice(0,16)}`
