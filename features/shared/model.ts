import { emptyWorkspace, validWorkspace, type Workspace, type Task } from '../../lib/project-model';
import {isFeature} from './feature-registry';
import type { Entries } from '../../lib/planner-model';
export type Session = {id:string;taskId:string;projectId:string;start:number;end:number|null;heartbeat:number;source:'timer'|'manual';review?:boolean;titleSnapshot?:string;projectSnapshot?:string};
export type Plan = {date:string;start?:string;end?:string};
export type State = {version:number;workspace:Workspace;entries:Entries;links:Record<string,string>;orders:Record<string,string[]>;plans:Record<string,Plan>;sessions:Session[];settings:{pinnedFeatures?:string[];showProjectFilters?:boolean;calendarSidebarWidth?:number;theme:'spring'|'minimal';avatar:'avatar'|'ball';showOuterProgress?:boolean;timers?:Record<string,{mode:'up'|'down';minutes:number;baseline:number}>};applied:string[]};
export type Command =
 | {type:'entries';patch:Entries}
 | {type:'paperMove';source:string;target:string}
 | {type:'workspace';base:Workspace;next:Workspace}
 | {type:'task';task:Task}
 | {type:'remove';id:string}
 | {type:'project';id:string;patch:Partial<Workspace['projects'][number]>}
 | {type:'archiveProject';id:string}
 | {type:'order';date:string;ids:string[]}
 | {type:'plan';id:string;plan:Plan}
 | {type:'start';id:string;at:number}
 | {type:'pause';at:number;review?:boolean}
 | {type:'heartbeat';at:number}
 | {type:'session';session:Session}
 | {type:'deleteSession';id:string}
 | {type:'settings';patch:Partial<State['settings']>};
export const today = (at=Date.now()) => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(at);
export function initialState(workspace=emptyWorkspace(),entries:Entries={}):State {return reconcile({version:0,workspace,entries,links:{},orders:{},plans:{},sessions:[],settings:{theme:'spring',avatar:'avatar',showOuterProgress:true},applied:[]});}
const taskKeys = /^(\d{4}-\d{2}-\d{2}):(todo|time|inbox):(\d{1,2})$/;
function paperPlan(key:string):Plan {const m=key.match(taskKeys)!;if(m[2]==='inbox')return {date:''};if(m[2]==='time'){const hour=Number(m[3]);const start=new Date(`${m[1]}T00:00:00+08:00`).getTime()+hour*3600000;return {date:today(start),start:new Date(start).toISOString(),end:new Date(start+3600000).toISOString()};}return {date:m[1]};}
function ensurePaper(s:State,id:string){const t=s.workspace.tasks.find(t=>t.id===id);if(!t?.date||Object.values(s.links).includes(id))return;let i=0;while(s.entries[`${t.date}:todo:${i}`]?.text.trim()&&i<100)i++;if(i<100){const key=`${t.date}:todo:${i}`;s.links[key]=id;s.entries[key]={text:t.title,done:t.done};}}
export function reconcile(s:State, updatePaper:Set<string>=new Set()):State {
 for(const [key,entry] of Object.entries(s.entries)){
  if(!taskKeys.test(key))continue;
  let id=s.links[key];
  if(!entry.text.trim()){if(id){s.workspace.tasks=s.workspace.tasks.filter(t=>t.id!==id);delete s.links[key];delete s.plans[id];}continue;}
  if(!id){id=`paper:${key}`;let suffix=0;while(s.workspace.tasks.some(t=>t.id===id)&&!Object.values(s.links).includes(id))id=`paper:${key}:${++suffix}`;s.links[key]=id;}
  const plan=paperPlan(key);const t=s.workspace.tasks.find(t=>t.id===id);
  if(t&&updatePaper.has(key)){if(!t.done&&entry.done)t.completedOn=today();if(t.done&&!entry.done)delete t.completedOn;t.title=entry.text;t.done=entry.done;t.date=plan.date;}
  else if(!t) s.workspace.tasks.push({id,title:entry.text,projectId:'',minutes:0,date:plan.date,done:entry.done,completedOn:entry.done?today():undefined});
  if(updatePaper.has(key)||!s.plans[id])s.plans[id]=plan;
 }
 for(const t of s.workspace.tasks){ensurePaper(s,t.id);if(!s.plans[t.id])s.plans[t.id]={date:t.date};if(t.date){const ids=s.orders[t.date]??=[];if(!ids.includes(t.id))ids.push(t.id);}}
 for(const date of Object.keys(s.orders)){s.orders[date]=s.orders[date].filter((id,i,a)=>a.indexOf(id)===i&&s.workspace.tasks.some(t=>t.id===id&&t.date===date));}
 return s;
}
const copy=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));
export function activeSession(s:State){return s.sessions.find(x=>x.end===null);}
function pause(s:State,at:number,review=false){for(const session of s.sessions.filter(x=>x.end===null)){session.end=Math.max(session.start,at);session.heartbeat=session.end;session.review=review||undefined;}}
function syncPaper(s:State,id:string){for(const [key,tid]of Object.entries(s.links)){if(tid!==id)continue;const task=s.workspace.tasks.find(t=>t.id===id);if(task){s.entries[key]={text:task.title,done:task.done};const targetDate=task.date;
  if(targetDate!==paperPlan(key).date){s.entries[key]={text:'',done:false};delete s.links[key];if(targetDate){let index=0;while(s.entries[`${targetDate}:todo:${index}`]?.text.trim()&&index<99)index++;if(index<100){const target=`${targetDate}:todo:${index}`;s.entries[target]={text:task.title,done:task.done};s.links[target]=id;}}}}
 else{s.entries[key]={text:'',done:false};delete s.links[key];}}
}
export function prepareSessionCorrection(s:State,previous:Session|null,input:{taskId:string;start:number;end:number},at=Date.now()):Session {
 const task=s.workspace.tasks.find(t=>t.id===input.taskId);
 if(!task)throw Error('请选择实际做的事项');
 if(previous&&s.sessions.find(x=>x.id===previous.id)?.end===null)throw Error('请先暂停，再修正这段时间');
 if(!Number.isFinite(input.start)||!Number.isFinite(input.end)||input.end<=input.start||input.end-input.start>7*86400000)throw Error('结束须晚于开始，单次最多七天');
 if(input.end>at)throw Error('实际记录不能晚于现在');
 if(s.sessions.some(x=>x.id!==previous?.id&&x.start<input.end&&(x.end??at)>input.start))throw Error('该时间段与已有记录重叠，请先调整');
 const changed=previous?.taskId!==task.id;
 const projectId=changed?task.projectId:previous!.projectId;
 return {...previous,id:previous?.id??crypto.randomUUID(),taskId:task.id,projectId,start:input.start,end:input.end,heartbeat:input.end,source:previous?.source??'manual',review:undefined,titleSnapshot:changed?task.title:(previous?.titleSnapshot??task.title),projectSnapshot:changed?s.workspace.projects.find(p=>p.id===projectId)?.name:previous?.projectSnapshot};
}
export function reduce(s0:State,c:Command,at=Date.now()):State {
 const s=copy(s0);
 switch(c.type){
 case 'paperMove':{
  if(c.source===c.target||!s.entries[c.source]?.text.trim())break;
  const a=s.entries[c.source],b=s.entries[c.target]??{text:'',done:false},aid=s.links[c.source],bid=s.links[c.target];
  s.entries[c.source]=b;s.entries[c.target]=a;
  if(bid)s.links[c.source]=bid;else delete s.links[c.source];
  if(aid)s.links[c.target]=aid;else delete s.links[c.target];
  reconcile(s,new Set([c.source,c.target]));break;
 }
 case 'entries':{
   Object.assign(s.entries,c.patch);reconcile(s,new Set(Object.keys(c.patch)));for(const t of s.workspace.tasks)if(t.done&&activeSession(s)?.taskId===t.id)pause(s,at);break;
 }
 case 'workspace': {
   if(!validWorkspace(c.next)||!validWorkspace(c.base))throw Error('项目数据格式无效');
   for(const kind of ['tasks','projects','feedback'] as const){
    const before=new Map(c.base[kind].map(t=>[t.id,t]));const after=new Map(c.next[kind].map(t=>[t.id,t]));
    const removed=[...before.keys()].filter(id=>!after.has(id));
    (s.workspace as unknown as Record<string,unknown>)[kind]=s.workspace[kind].filter(t=>!removed.includes(t.id));
    for(const [id,value]of after){const prev=before.get(id);if(JSON.stringify(prev)===JSON.stringify(value))continue;const current=s.workspace[kind].find(t=>t.id===id);
      if(current&&prev){for(const field of Object.keys(value)){if(JSON.stringify((prev as unknown as Record<string,unknown>)[field])!==JSON.stringify((value as unknown as Record<string,unknown>)[field]))(current as unknown as Record<string,unknown>)[field]=(value as unknown as Record<string,unknown>)[field];}}
      else if(!prev)(s.workspace[kind] as unknown[]).push(value);
    }
    if(kind==='tasks'){for(const id of new Set([...before.keys(),...after.keys()]))syncPaper(s,id);}
   }
   for(const key of new Set([...Object.keys(c.base.notes),...Object.keys(c.next.notes)]))if(c.base.notes[key]!==c.next.notes[key]){if(c.next.notes[key]===undefined)delete s.workspace.notes[key];else s.workspace.notes[key]=c.next.notes[key];}
   if(c.base.capacity!==c.next.capacity)s.workspace.capacity=c.next.capacity;
   for(const task of s.workspace.tasks){if(task.done&&activeSession(s)?.taskId===task.id)pause(s,at);if(s.plans[task.id]?.date!==task.date)s.plans[task.id]={date:task.date};}
   break;
 }
 case 'task':{if(!c.task.title.trim())throw Error('请填写事项名称');const index=s.workspace.tasks.findIndex(t=>t.id===c.task.id);if(index<0)s.workspace.tasks.push(c.task);else s.workspace.tasks[index]=c.task;if(c.task.done&&activeSession(s)?.taskId===c.task.id)pause(s,at);if(s.plans[c.task.id]?.date!==c.task.date)s.plans[c.task.id]={date:c.task.date};syncPaper(s,c.task.id);break;}
 case 'remove':{if(activeSession(s)?.taskId===c.id)pause(s,at);s.workspace.tasks=s.workspace.tasks.filter(t=>t.id!==c.id);syncPaper(s,c.id);delete s.plans[c.id];break;}
 case 'project':{const p=s.workspace.projects.find(p=>p.id===c.id);if(!p)throw Error('项目不存在');if(c.patch.color&&!/^#[\da-f]{6}$/i.test(c.patch.color))throw Error('颜色无效');Object.assign(p,c.patch);break;}
 case 'archiveProject':{const p=s.workspace.projects.find(p=>p.id===c.id);if(p)p.archived=!p.archived;break;}
 case 'order':{const all=s.orders[c.date]??[];const requested=c.ids.filter((id,i,a)=>a.indexOf(id)===i&&s.workspace.tasks.some(t=>t.id===id&&t.date===c.date));const visible=new Set(requested);let i=0;s.orders[c.date]=all.map(id=>visible.has(id)?requested[i++]:id);for(const id of requested)if(!s.orders[c.date].includes(id))s.orders[c.date].push(id);break;}
 case 'plan':{const t=s.workspace.tasks.find(t=>t.id===c.id);if(!t)throw Error('事项不存在');if(c.plan.start&&(!c.plan.end||Date.parse(c.plan.end)<=Date.parse(c.plan.start)))throw Error('结束须晚于开始');t.date=c.plan.date;s.plans[c.id]=c.plan;syncPaper(s,c.id);break;}
 case 'start':{const t=s.workspace.tasks.find(t=>t.id===c.id);if(!t||t.done)throw Error('请先选择未完成事项');if(activeSession(s)?.taskId===c.id)break;pause(s,c.at);s.sessions.push({id:`timer:${c.id}:${c.at}`,taskId:c.id,projectId:t.projectId,start:c.at,end:null,heartbeat:c.at,source:'timer',titleSnapshot:t.title,projectSnapshot:s.workspace.projects.find(p=>p.id===t.projectId)?.name});break;}
 case 'pause':pause(s,c.at,c.review);break;
 case 'heartbeat':{const a=activeSession(s);if(a){const timer=s.settings.timers?.[a.taskId];if(timer?.mode==='down'){const excess=tracked(s,a.taskId,0,c.at,c.at)-timer.baseline-timer.minutes*60000;if(excess>=0){pause(s,Math.max(a.start,c.at-excess));break;}}a.heartbeat=Math.max(a.start,c.at);}break;}
 case 'session':{const x={...c.session};const previous=s.sessions.find(v=>v.id===x.id);if(previous?.end===null)throw Error('请先暂停，再修正这段时间');const t=s.workspace.tasks.find(t=>t.id===x.taskId);if(previous&&previous.taskId!==x.taskId){x.projectId=t?.projectId??'';x.titleSnapshot=t?.title;x.projectSnapshot=s.workspace.projects.find(p=>p.id===x.projectId)?.name;}x.titleSnapshot=x.titleSnapshot??t?.title;x.projectSnapshot=x.projectSnapshot??s.workspace.projects.find(p=>p.id===x.projectId)?.name;if(!Number.isFinite(x.start)||x.end===null||!Number.isFinite(x.end)||x.end<=x.start||x.end-x.start>7*86400000||!s.workspace.tasks.some(t=>t.id===x.taskId))throw Error('请输入有效的事项和起止时间（最多七天）');if(s.sessions.some(v=>v.id!==x.id&&v.start<x.end!&&(v.end??at)>x.start))throw Error('这个时间段与已有记录重叠');const i=s.sessions.findIndex(v=>v.id===x.id);if(i<0)s.sessions.push(x);else s.sessions[i]=x;break;}
 case 'deleteSession':{if(activeSession(s)?.id===c.id)throw Error('请先暂停');s.sessions=s.sessions.filter(x=>x.id!==c.id);break;}
 case 'settings':{if(c.patch.pinnedFeatures!==undefined&&(!Array.isArray(c.patch.pinnedFeatures)||c.patch.pinnedFeatures.length>20||c.patch.pinnedFeatures.some(id=>typeof id!=='string'||!isFeature(id))))throw Error('功能设置无效');if(c.patch.calendarSidebarWidth!==undefined&&(!Number.isFinite(c.patch.calendarSidebarWidth)||c.patch.calendarSidebarWidth<15||c.patch.calendarSidebarWidth>60))throw Error('日历栏宽无效');if(c.patch.theme&& !['spring','minimal'].includes(c.patch.theme))throw Error('主题无效');if(c.patch.avatar&&!['avatar','ball'].includes(c.patch.avatar))throw Error('头像无效');Object.assign(s.settings,c.patch);break;}
 default:throw Error('未知操作');
 }
 if(activeSession(s)&&!s.workspace.tasks.some(t=>t.id===activeSession(s)!.taskId))pause(s,at);
 if(!validWorkspace(s.workspace))throw Error('数据无效或超过容量');reconcile(s);s.version++;return s;
}
export function dailyTasks(s:State,date:string){const ids=s.orders[date]??[];return s.workspace.tasks.filter(t=>t.date===date).sort((a,b)=>Number(a.done)-Number(b.done)||ids.indexOf(a.id)-ids.indexOf(b.id));}
export function tracked(s:State,taskId:string,from=0,to=Date.now(),now=Date.now()){return s.sessions.filter(x=>x.taskId===taskId).reduce((n,x)=>n+Math.max(0,Math.min(x.end??now,to)-Math.max(x.start,from)),0);}
export function rangeBounds(kind:string,date:string,end=date){const d=new Date(date+'T00:00:00+08:00');const shift=(n:number)=>new Date(d.getTime()+n*86400000);let from=d,to=shift(1);if(kind==='week'){from=shift(-((new Date(d.getTime()+8*3600000).getUTCDay()+6)%7));to=new Date(from.getTime()+7*86400000);}if(kind==='month'){from=new Date(date.slice(0,7)+'-01T00:00:00+08:00');const y=Number(date.slice(0,4)),m=Number(date.slice(5,7));to=new Date(Date.UTC(y,m,1)-8*3600000);}if(kind==='year'){from=new Date(date.slice(0,4)+'-01-01T00:00:00+08:00');to=new Date((Number(date.slice(0,4))+1)+'-01-01T00:00:00+08:00');}if(kind==='custom')to=new Date(new Date(end+'T00:00:00+08:00').getTime()+86400000);return {from:from.getTime(),to:to.getTime()};}
