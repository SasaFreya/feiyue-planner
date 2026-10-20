import type {IncomingMessage,ServerResponse} from 'node:http';
import {AWClient} from 'aw-client';
import {activitySummary} from '../features/integrations/activity-model';
const dateBounds=(value:string|null)=>{if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('请选择日期');const from=Date.parse(value+'T00:00:00+08:00');if(!Number.isFinite(from)||new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(from)!==value)throw Error('日期无效');return {from,to:from+86400000};};
function localPort(value:unknown,fallback:number){const port=value===undefined||value===null?fallback:Number(value);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('端口须在 1024–65535 之间');return port;}
async function body(req:IncomingMessage){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16000)throw Error('请求过大');}return JSON.parse(raw);}
async function jsonFetch(url:string,token:string){const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error(r.status===401||r.status===403?'solidtime 认证失败，请检查 API Token 和组织 ID':`solidtime 返回 ${r.status}`);const text=await r.text();if(text.length>2_000_000)throw Error('返回数据过大，请缩小日期范围');return JSON.parse(text);}
const collection=(value:unknown):Record<string,unknown>[]=>{if(!value||typeof value!=='object'||!Array.isArray((value as {data?:unknown}).data))throw Error('无法识别 solidtime API 响应');return (value as {data:Record<string,unknown>[]}).data;};
export async function handleIntegrationRequest(req:IncomingMessage,res:ServerResponse):Promise<boolean>{
 const url=new URL(req.url??'/','http://127.0.0.1');if(!url.pathname.startsWith('/api/integrations/'))return false;
 const send=(status:number,value:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 const host=req.headers.host??'';if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host)||req.headers['x-feiyue-request']!=='1'||req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==`http://${host}`)){send(403,{error:'请求来源无效'});return true;}
 try{
  if(url.pathname==='/api/integrations/activitywatch'&&req.method==='GET'){
   const client=new AWClient('feiyue-planner',{baseURL:`http://127.0.0.1:${localPort(url.searchParams.get('port'),5600)}`,timeout:4000});
   const buckets=Object.values(await client.getBuckets()).filter(b=>b.type==='currentwindow');
   const selected=url.searchParams.get('bucket');
   if(!selected){send(200,{buckets:buckets.map(b=>({id:b.id,name:b.name||b.id,hostname:b.hostname})),connected:true});return true;}
   if(!buckets.some(b=>b.id===selected)||!/^[\w.:-]{1,200}$/.test(selected))throw Error('请选择可用的窗口活动来源');
   const {from,to}=dateBounds(url.searchParams.get('date'));const count=await client.countEvents(selected,new Date(from),new Date(to));
   const events=await client.getEvents(selected,{start:new Date(from),end:new Date(to),limit:5000});
   // Only app names and intervals leave this handler: window titles and URLs are never returned.
   send(200,{buckets:buckets.map(b=>({id:b.id,name:b.name||b.id,hostname:b.hostname})),...activitySummary(events,from,to),truncated:count>5000,totalEvents:count,connected:true});return true;
  }
  if(url.pathname==='/api/integrations/solidtime'&&req.method==='POST'){
   const input=await body(req);const {organization,token,date}=input;if(typeof organization!=='string'||! /^[\da-f-]{36}$/i.test(organization)||typeof token!=='string'||!token.trim()||token.length>4096||/[\r\n]/.test(token))throw Error('请填写组织 UUID 和有效 API Token');
   const port=localPort(input.port,8000),{from,to}=dateBounds(date);const base=`http://127.0.0.1:${port}/api/v1/organization/${organization}`;
   const [projectResult,timeResult]=await Promise.all([jsonFetch(base+'/projects',token),jsonFetch(base+'/time-entries?'+new URLSearchParams({before:new Date(to).toISOString(),limit:'500'}),token)]);
   const projects=collection(projectResult),records=collection(timeResult).flatMap(x=>{const start=Date.parse(String(x.start)),end=x.end===null?null:Date.parse(String(x.end));if(!Number.isFinite(start)||(end!==null&&!Number.isFinite(end)))return [];const ms=Math.max(0,Math.min(end??Date.now(),to)-Math.max(start,from));return ms?[{id:String(x.id),title:typeof x.description==='string'?x.description:'未命名记录',projectId:String(x.project_id??''),start,end,ms}]:[];});
   send(200,{records,projects:projects.map(x=>({id:String(x.id),name:String(x.name),color:typeof x.color==='string'&&/^#[\da-f]{6}$/i.test(x.color)?x.color:'#5d9d82'})),total:records.reduce((n,x)=>n+x.ms,0),truncated:collection(timeResult).length===500,connected:true});return true;
  }
  send(404,{error:'连接接口不存在'});
 }catch(e){const message=(e as Error).message;send(502,{error:/^(请选择|日期|端口|请求过大|solidtime|请填写|无法识别|返回数据)/.test(message)?message:'无法连接本机服务，请先启动对应应用并核对端口；飞跃未启动活动采集。'});}
 return true;
}
