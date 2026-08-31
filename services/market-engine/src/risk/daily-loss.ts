export function utcDay(timestamp:number){return new Date(timestamp).toISOString().slice(0,10)}export function dailyLoss(realized:number,unrealized=0){return Math.max(0,-(realized+unrealized))}
