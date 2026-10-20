import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {initialState,reduce,rangeBounds,tracked,activeSession,prepareSessionCorrection} from './model';
import {pinnedFeatures} from './feature-registry';
const task=(id:string,date='2026-10-13')=>({id,title:id,projectId:'',minutes:30,date,done:false});
test('paper drag preserves task identity, project, running timer and timed schedule survives unrelated edits',()=>{
 let s=initialState(undefined,{'2026-10-13:todo:0':{text:'论文',done:false}});const id=s.links['2026-10-13:todo:0'];s=reduce(s,{type:'start',id,at:1000},1000);s=reduce(s,{type:'paperMove',source:'2026-10-13:todo:0',target:'2026-10-14:todo:1'},2000);assert.equal(s.links['2026-10-14:todo:1'],id);assert.equal(activeSession(s)?.taskId,id);assert.equal(s.workspace.tasks.find(t=>t.id===id)?.date,'2026-10-14');
 s=reduce(s,{type:'plan',id,plan:{date:'2026-10-14',start:'2026-10-14T01:00:00Z',end:'2026-10-14T02:30:00Z'}});s=reduce(s,{type:'entries',patch:{'2026-10-13:note:0':{text:'随记',done:false}}});assert.equal(s.plans[id].end,'2026-10-14T02:30:00Z');
});
test('swapping equal paper titles preserves distinct identities',()=>{let s=initialState(undefined,{'2026-10-13:todo:0':{text:'同名',done:false},'2026-10-13:todo:1':{text:'同名',done:false}});const [a,b]=Object.values(s.links);s=reduce(s,{type:'paperMove',source:'2026-10-13:todo:0',target:'2026-10-13:todo:1'});assert.equal(s.links['2026-10-13:todo:0'],b);assert.equal(s.links['2026-10-13:todo:1'],a);});
test('filtered order preserves hidden slots and never changes planned dates',()=>{let s=initialState();for(const id of ['a','b','c','d'])s=reduce(s,{type:'task',task:task(id)});s=reduce(s,{type:'order',date:'2026-10-13',ids:['d','b']});assert.deepEqual(s.orders['2026-10-13'],['a','d','c','b']);assert(s.workspace.tasks.every(t=>t.date==='2026-10-13'));});
test('25 + 15 minutes, one active timer, completed tasks stop timer',()=>{let s=initialState();s=reduce(s,{type:'task',task:task('a')});s=reduce(s,{type:'task',task:task('b')});s=reduce(s,{type:'start',id:'a',at:0},0);s=reduce(s,{type:'pause',at:25*60000},25*60000);s=reduce(s,{type:'start',id:'a',at:60*60000},60*60000);s=reduce(s,{type:'start',id:'b',at:75*60000},75*60000);assert.equal(tracked(s,'a',0,75*60000,75*60000),40*60000);assert.equal(s.sessions.filter(x=>x.end===null).length,1);s=reduce(s,{type:'task',task:{...task('b'),done:true}},80*60000);assert.equal(activeSession(s),undefined);});
test('cross-midnight sessions use exact intersections; task/project totals agree',()=>{let s=initialState();s=reduce(s,{type:'task',task:task('a')});const start=Date.parse('2026-10-13T23:50:00+08:00'),end=Date.parse('2026-10-14T00:20:00+08:00');s=reduce(s,{type:'session',session:{id:'s',taskId:'a',projectId:'',start,end,heartbeat:end,source:'manual'}});const a=rangeBounds('day','2026-10-13'),b=rangeBounds('day','2026-10-14');assert.equal(tracked(s,'a',a.from,a.to),10*60000);assert.equal(tracked(s,'a',b.from,b.to),20*60000);assert.equal(b.from-a.from,86400000);const week=rangeBounds('week','2026-10-13');assert.equal(new Date(week.from).toISOString(),'2026-10-11T16:00:00.000Z');});
test('legacy workspace field patches keep concurrent edits and do not erase sessions',()=>{let s=initialState();s=reduce(s,{type:'task',task:task('a')});const base=structuredClone(s.workspace);s=reduce(s,{type:'task',task:{...task('a'),title:'新标题'}});s=reduce(s,{type:'start',id:'a',at:1000},1000);const next=structuredClone(base);next.tasks[0].minutes=55;s=reduce(s,{type:'workspace',base,next},2000);assert.equal(s.workspace.tasks[0].title,'新标题');assert.equal(s.workspace.tasks[0].minutes,55);assert.equal(activeSession(s)?.taskId,'a');});
test('overlapping manual records rejected; timestamps and expected minutes stay separate',()=>{let s=initialState();s=reduce(s,{type:'task',task:task('a')});s=reduce(s,{type:'session',session:{id:'1',taskId:'a',projectId:'',start:0,end:10000,heartbeat:10000,source:'manual'}});assert.throws(()=>reduce(s,{type:'session',session:{id:'2',taskId:'a',projectId:'',start:9000,end:12000,heartbeat:12000,source:'manual'}}),/重叠/);assert.equal(s.workspace.tasks[0].minutes,30);});
test('countdown pause and resume stops at exact target and preserves earlier tracked time',()=>{let s=initialState();s=reduce(s,{type:'task',task:task('timer')});s=reduce(s,{type:'start',id:'timer',at:1000},1000);s=reduce(s,{type:'pause',at:61000},61000);s=reduce(s,{type:'settings',patch:{timers:{timer:{mode:'down',minutes:2,baseline:60000}}}});s=reduce(s,{type:'start',id:'timer',at:100000},100000);s=reduce(s,{type:'pause',at:130000},130000);s=reduce(s,{type:'start',id:'timer',at:200000},200000);s=reduce(s,{type:'heartbeat',at:300000},300000);assert.equal(activeSession(s),undefined);assert.equal(s.sessions.at(-1)?.end,290000);assert.equal(tracked(s,'timer',0,400000,400000),180000);});

test('correcting actual task moves its time and project together while retaining exact timestamps and plans',()=>{
 let s=initialState();s.workspace.projects=[{id:'p1',name:'学习',color:'#aa6677',start:'',deadline:''},{id:'p2',name:'工作',color:'#557788',start:'',deadline:''}];
 s=reduce(s,{type:'task',task:{...task('a'),projectId:'p1'}});s=reduce(s,{type:'task',task:{...task('b'),projectId:'p2'}});
 s=reduce(s,{type:'start',id:'a',at:1001},1001);s=reduce(s,{type:'pause',at:61007},61007);
 const previous=s.sessions[0],plans=structuredClone(s.plans);
 const corrected=prepareSessionCorrection(s,previous,{taskId:'b',start:previous.start,end:previous.end!},100000);
 s=reduce(s,{type:'session',session:corrected},100000);
 assert.equal(s.sessions.length,1);assert.equal(s.sessions[0].projectId,'p2');assert.equal(s.sessions[0].titleSnapshot,'b');assert.equal(s.sessions[0].projectSnapshot,'工作');assert.equal(s.sessions[0].source,'timer');
 assert.equal(tracked(s,'a',0,100000),0);assert.equal(tracked(s,'b',0,100000),60006);assert.deepEqual(s.plans,plans);assert(s.workspace.tasks.every(t=>!t.done));
 s=reduce(s,{type:'remove',id:'b'},100000);assert.equal(s.sessions[0].titleSnapshot,'b');assert.equal(s.sessions[0].projectSnapshot,'工作');
});
test('time correction preserves historical project on same-task edit; rejects running, overlapping and future time',()=>{
 let s=initialState();s=reduce(s,{type:'task',task:task('a')});s=reduce(s,{type:'task',task:task('b')});
 s=reduce(s,{type:'start',id:'a',at:1000},1000);const running=s.sessions[0];
 assert.throws(()=>prepareSessionCorrection(s,running,{taskId:'b',start:1000,end:2000},3000),/暂停/);
 assert.throws(()=>reduce(s,{type:'session',session:{...running,end:2000}},3000),/暂停/);
 s=reduce(s,{type:'pause',at:2000},2000);const previous=s.sessions[0];
 s=reduce(s,{type:'task',task:{...task('a'),projectId:'new-project'}});
 assert.equal(prepareSessionCorrection(s,previous,{taskId:'a',start:1001,end:2000},3000).projectId,'');
 s=reduce(s,{type:'session',session:{id:'other',taskId:'b',projectId:'',start:3000,end:4000,heartbeat:4000,source:'manual'}},5000);
 assert.throws(()=>prepareSessionCorrection(s,previous,{taskId:'b',start:1000,end:3500},5000),/重叠/);
 assert.throws(()=>prepareSessionCorrection(s,previous,{taskId:'b',start:5000,end:6000},5500),/现在/);
});

test('feature visibility only changes preferences; hidden modules retain task, notes, plan and time data',()=>{
 let s=initialState(undefined,{'2026-10-16:note:0':{text:'保留文字',done:false}});s=reduce(s,{type:'task',task:task('a')});s=reduce(s,{type:'session',session:{id:'record',taskId:'a',projectId:'',start:1000,end:2000,heartbeat:2000,source:'manual'}},3000);
 const before=JSON.parse(JSON.stringify(s));s=reduce(s,{type:'settings',patch:{pinnedFeatures:[],showProjectFilters:false,calendarSidebarWidth:35}});
 assert.deepEqual(pinnedFeatures(s.settings.pinnedFeatures),[]);for(const key of ['workspace','entries','links','orders','plans','sessions'] as const)assert.deepEqual(s[key],before[key]);
 assert.deepEqual(pinnedFeatures(),['today','calendar','paper']);assert.deepEqual(pinnedFeatures(['reports','unknown','reports']),['reports']);
 assert.throws(()=>reduce(s,{type:'settings',patch:{pinnedFeatures:['unknown']}}),/无效/);assert.throws(()=>reduce(s,{type:'settings',patch:{calendarSidebarWidth:NaN}}),/无效/);
});

test('quote entries survive state round trip without becoming calendar tasks or replacing daily notes',()=>{const key='2026-10-16:quote:sample',text=JSON.stringify({v:1,text:'慢慢来。',source:'书页'});let s=initialState(undefined,{'2026-10-16:note:0':{text:'当天内容',done:false}});s=reduce(s,{type:'entries',patch:{[key]:{text,done:false}}});s=JSON.parse(JSON.stringify(s));assert.equal(s.entries[key].text,text);assert.equal(s.entries['2026-10-16:note:0'].text,'当天内容');assert.equal(s.workspace.tasks.length,0);assert.deepEqual(s.sessions,[]);s=reduce(s,{type:'entries',patch:{[key]:{text:'',done:false}}});assert.equal(s.entries[key].text,'');s=reduce(s,{type:'entries',patch:{[key]:{text,done:false}}});assert.equal(s.entries[key].text,text);});

test('sidebar order persists user order, removes duplicates and ignores removed feature ids',()=>{assert.deepEqual(pinnedFeatures(['calendar','quotes','today','calendar','missing']),['calendar','quotes','today']);let s=initialState();s=reduce(s,{type:'settings',patch:{pinnedFeatures:['calendar','today','quotes']}});assert.deepEqual(pinnedFeatures(JSON.parse(JSON.stringify(s)).settings.pinnedFeatures),['calendar','today','quotes']);});
