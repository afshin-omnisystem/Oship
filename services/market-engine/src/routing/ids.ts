import {sha256} from '../oiin/ids';export const routeId=(c:RouteCandidateLike)=>`route_${sha256(c).slice(0,16)}`;interface RouteCandidateLike{venue:string;price:number;liquidity:number}
