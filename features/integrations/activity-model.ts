export type ActivityEvent={id?:number;timestamp:Date|string;duration?:number;data:Record<string,unknown>};
export function activitySummary(events:ActivityEvent[],from:number,to:number){
 const valid=events.flatMap(e=>{const start=new Date(e.timestamp).getTime(),end=start+Number(e.duration)*1000;return Number.isFinite(start)&&Number.isFinite(end)&&end>start?[{start:Math.max(from,start),end:Math.min(to,end),app:typeof e.data?.app==='string'?e.data.app.slice(0,200):'未知应用'}]:[];}).filter(x=>x.end>x.start).sort((a,b)=>a.start-b.start||a.end-b.end);
 let cursor=from;const segments=valid.flatMap(x=>{const start=Math.max(x.start,cursor);cursor=Math.max(cursor,x.end);return x.end>start?[{...x,start}]:[];});
 const groups=new Map<string,number>();for(const x of segments)groups.set(x.app,(groups.get(x.app)??0)+x.end-x.start);
 return {segments,groups:[...groups].map(([name,ms])=>({name,ms})).sort((a,b)=>b.ms-a.ms),total:segments.reduce((n,x)=>n+x.end-x.start,0)};
}
