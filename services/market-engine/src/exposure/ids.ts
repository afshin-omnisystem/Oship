import {sha256} from '../oiin/ids';export const exposureId=(dimension:string,key:string,amount:number)=>`exp_${sha256({dimension,key,amount}).slice(0,16)}`
