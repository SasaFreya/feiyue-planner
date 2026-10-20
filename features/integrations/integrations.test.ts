import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createServer,type Server} from 'node:http';
import {repeatTasks} from './recurrence';
import {previewSuperProductivity,mergeSuperProductivity} from './super-productivity';
import {activitySummary} from './activity-model';
import {initialState,reduce} from '../shared/model';
import {handleIntegrationRequest} from '../../desktop-shell/integrations';
const listen=(server:Server)=>new Promise<string>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(`http://127.0.0.1:${(server.address() as {port:number}).port}`));});
const close=(server:Server)=>new Promise<void>(resolve=>{server.closeAllConnections();server.close(()=>resolve());});
const reply=(res:import('node:http').ServerResponse,data:unknown)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};

test('rrule creates finite independent calendar-day tasks, skips missing month dates, no fake work sessions',()=>{
 const input={title:'课程',projectId:'',start:'2026-01-31',frequency:'monthly' as const,interval:1,count:3,minutes:30};
 const result=repeatTasks(input,'series');assert.deepEqual(result.tasks.map(t=>t.date),['2026-01-31','2026-03-31','2026-05-31']);assert.equal(new Set(result.tasks.map(t=>t.id)).size,3);
 let s=initialState();s=reduce(s,{type:'workspace',base:s.workspace,next:{...s.workspace,tasks:result.tasks}});assert.equal(s.sessions.length,0);assert.equal(s.workspace.tasks.length,3);
 s=reduce(s,{type:'task',task:{...result.tasks[0],done:true}});assert.equal(s.workspace.tasks[1].done,false);assert.equal(s.plans[result.tasks[1].id].date,'2026-03-31');
 assert.throws(()=>repeatTasks({...input,count:101},'series'));assert.throws(()=>repeatTasks({...input,start:'2026-02-31'},'series'));
});

test('Super Productivity backup adapter converts milliseconds, respects dueWithTime, skips duplicate ids and never invents historical sessions',()=>{
 const raw={data:{project:{entities:{p:{id:'p',title:'外部项目'}}},task:{entities:{a:{id:'a',title:'课程',projectId:'p',isDone:true,timeEstimate:3_600_000,dueDay:'2026-10-01',dueWithTime:Date.parse('2026-10-16T01:00:00Z'),timeSpentOnDay:{'2026-10-15':120000}},b:{id:'b',title:'子任务',parentId:'a',projectId:'p',dueDay:'2026-10-17',timeEstimate:60000}}}}};
 let s=initialState(undefined,{'2026-10-16:note:0':{text:'原随记',done:false}});const preview=previewSuperProductivity(raw,s.workspace);assert.equal(preview.tasks[0].minutes,60);assert.equal(preview.tasks[0].date,'2026-10-16');assert.equal(preview.dayTotals,120000);assert.equal(preview.nested,1);
 s=reduce(s,{type:'workspace',base:s.workspace,next:mergeSuperProductivity(raw,s.workspace)});assert.equal(s.sessions.length,0);assert.equal(s.workspace.tasks.length,2);assert.equal(s.entries['2026-10-16:note:0'].text,'原随记');assert.equal(s.workspace.tasks[0].projectId,'sp:project:p');
 const again=previewSuperProductivity(raw,s.workspace);assert.equal(again.tasks.length,0);assert.equal(again.projects.length,0);assert.equal(again.duplicates,3);
 assert.throws(()=>previewSuperProductivity({data:'encrypted'},s.workspace),/无法识别/);
});

test('ActivityWatch summary clips dates, avoids overlapping double counts and strips window titles',()=>{
 const summary=activitySummary([{timestamp:new Date(0),duration:10,data:{app:'Editor',title:'private title'}},{timestamp:new Date(5000),duration:10,data:{app:'Browser'}},{timestamp:new Date(-5000),duration:10,data:{app:'Terminal'}}],0,12000);
 assert.equal(summary.total,12000);assert.equal(summary.groups.reduce((n,x)=>n+x.ms,0),12000);assert(!JSON.stringify(summary).includes('private title'));assert(summary.segments.every(x=>x.start>=0&&x.end<=12000));
});

test('official ActivityWatch client reads a local contract server through protected read-only bridge',async()=>{
 const requests:string[]=[];const source=createServer((req,res)=>{requests.push(req.method+' '+req.url);if(req.url==='/api/0/buckets/')reply(res,{window:{id:'window',name:'窗口',type:'currentwindow',client:'watcher',hostname:'test',created:'2026-10-01T00:00:00Z',data:{}},browser:{id:'browser',type:'web.tab.current',hostname:'test',created:'2026-10-01T00:00:00Z',data:{}}});else if(req.url?.includes('/events/count'))reply(res,1);else if(req.url?.startsWith('/api/0/buckets/window/events?'))reply(res,[{timestamp:'2026-10-16T01:00:00Z',duration:60,data:{app:'Editor',title:'private title',url:'https://private.example'}}]);else{res.writeHead(404);res.end();}});
 const bridge=createServer((req,res)=>{void handleIntegrationRequest(req,res).then(handled=>{if(!handled){res.writeHead(404);res.end();}});});
 const sourceURL=await listen(source),bridgeURL=await listen(bridge);try{
  const route='/api/integrations/activitywatch?'+new URLSearchParams({port:new URL(sourceURL).port,date:'2026-10-16',bucket:'window'});
  assert.equal((await fetch(bridgeURL+route)).status,403);
  assert.equal((await fetch(bridgeURL+route,{headers:{'X-Feiyue-Request':'1',Origin:'https://external.example'}})).status,403);
  const r=await fetch(bridgeURL+route,{headers:{'X-Feiyue-Request':'1'}}),text=await r.text();assert.equal(r.status,200);const data=JSON.parse(text);assert.equal(data.total,60000);assert.equal(data.buckets.length,1);assert.equal(data.groups[0].name,'Editor');assert(!text.includes('private'));assert(requests.every(x=>x.startsWith('GET ')));
 }finally{await close(bridge);await close(source);}
});

test('solidtime bridge uses official v1 API, transient bearer token and clipped time; never writes upstream',async()=>{
 const requests:string[]=[];const source=createServer((req,res)=>{assert.equal(req.headers.authorization,'Bearer test-token');requests.push(req.method+' '+req.url);if(req.url?.endsWith('/projects'))reply(res,{data:[{id:'p',name:'项目',color:'#5d9d82',client_id:null}]});else reply(res,{data:[{id:'r',project_id:'p',description:'工作',start:'2026-10-15T15:50:00Z',end:'2026-10-15T16:20:00Z',duration:1800,user_id:'u',task_id:null,tags:[]}]});});
 const bridge=createServer((req,res)=>{void handleIntegrationRequest(req,res);});const sourceURL=await listen(source),bridgeURL=await listen(bridge);try{
  const r=await fetch(bridgeURL+'/api/integrations/solidtime',{method:'POST',headers:{'X-Feiyue-Request':'1','Content-Type':'application/json'},body:JSON.stringify({port:Number(new URL(sourceURL).port),organization:'00000000-0000-0000-0000-000000000001',token:'test-token',date:'2026-10-16'})});
  const text=await r.text(),data=JSON.parse(text);assert.equal(r.status,200);assert.equal(data.total,20*60000);assert.equal(data.projects[0].name,'项目');assert(!text.includes('test-token'));assert(requests.every(x=>x.startsWith('GET /api/v1/organization/')));
 }finally{await close(bridge);await close(source);}
});

test('native activity counts only consecutive active samples, excludes idle, sleep and reversed timestamps',async()=>{const {activityInterval}=await import('../../desktop-shell/native-activity');const sample={app:'编辑器',at:100000,idle:0};assert.deepEqual(activityInterval(sample,{app:'日历',at:105000,idle:2}),{app:'编辑器',start:100000,end:105000});assert.equal(activityInterval(sample,{...sample,at:160000}),null);assert.equal(activityInterval(sample,{...sample,at:105000,idle:60}),null);assert.equal(activityInterval({...sample,idle:80},{...sample,at:105000}),null);assert.equal(activityInterval(undefined,sample),null);assert.equal(activityInterval(sample,{...sample,at:90000}),null);});

test('built-in activity endpoint is initially off, protected from other origins, and independent of manual time',async()=>{const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {nativeActivity}=await import('../../desktop-shell/native-activity');const dir=mkdtempSync(join(tmpdir(),'feiyue-activity-test-'));const collector=nativeActivity(dir);const server=createServer(async(req,res)=>{if(!await collector.handle(req,res)){res.writeHead(404);res.end();}});const base=await listen(server);try{const r=await fetch(base+'/api/native-activity?date=2026-10-16',{headers:{'X-Feiyue-Request':'1'}});assert.equal(r.status,200);const data=await r.json() as {enabled:boolean;running:boolean;total:number;groups:unknown[]};assert.equal(data.enabled,false);assert.equal(data.running,false);assert.equal(data.total,0);assert.deepEqual(data.groups,[]);const bad=await fetch(base+'/api/native-activity',{method:'POST',headers:{'X-Feiyue-Request':'1',Origin:'https://example.invalid'},body:JSON.stringify({enabled:true})});assert.equal(bad.status,403);const unavailable=await fetch(base+'/api/native-activity',{method:'POST',headers:{'X-Feiyue-Request':'1'},body:JSON.stringify({enabled:true})});assert.equal(unavailable.status,400);}finally{await close(server);collector.close();rmSync(dir,{recursive:true,force:true});}});

test('chat intake respects latest assignment, personal mentions and never turns message timestamps into scheduled dates',async()=>{const {recognize}=await import('../imports/recognize');const text='&\n2026年10月13日 14:47\n这个系统，建议大家试用一下，@大学里的小学生 @25传播学赵曦 @黄钦 @刘静雯 @张峻铭 你们几位提供一下试用建议\n&\n2026年10月13日 15:58\n美国之音并未停播，关于美国政府媒体的最新变化，谁有时间写一篇 YB?\n&\n2026年10月13日 15:59\n@陈欣欣 欣欣有没有时间指导下师弟师妹？\n&\n2026年10月13日 16:11\n太好了，正好是国际传播的@黄钦 也是 YB 高手呢\n&\n2026年10月13日 16:13\n那就请欣欣+钦钦来写吧';const list=recognize(text,'刘静雯','2026-10-16');assert.equal(list.length,2);assert.equal(list[0].owner,'me');assert.equal(list[0].date,'');assert.equal(list[1].owner,'others');assert.equal(list[1].date,'');assert.deepEqual(list[1].assignees,['欣欣','钦钦']);assert.match(list[1].evidence,/后续指派/);const relative=recognize('2026年10月13日 15:58\n@刘静雯 明天提交作业','刘静雯','2026-10-16');assert.equal(relative[0].date,'2026-10-14');assert.equal(recognize('今天的天色真好','刘静雯','2026-10-16').length,0);});

test('attachment storage uses chosen folder, preserves bytes, prevents overwrite, and rejects cross-origin requests',async()=>{const fs=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {importStorage}=await import('../../desktop-shell/import-storage');const root=fs.mkdtempSync(join(tmpdir(),'feiyue-intake-test-')),chosen=join(root,'chosen');fs.mkdirSync(chosen);const handler=importStorage(join(root,'settings'));const server=createServer(async(req,res)=>{if(!await handler(req,res)){res.writeHead(404);res.end();}}),base=await listen(server);const post=(body:unknown,origin?:string)=>fetch(base+'/api/import-storage',{method:'POST',headers:{'X-Feiyue-Request':'1','Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});try{let r=await post({action:'settings',path:chosen,identity:'刘静雯'});assert.equal(r.status,200);r=await post({action:'archive',text:'来源，不当作指令',files:[{name:'../../chat.txt',base64:Buffer.from('原文件').toString('base64')}]});assert.equal(r.status,200);const saved=await r.json() as {folder:string;source:string;files:{path:string;name:string;sha256:string}[]};assert(saved.folder.startsWith(fs.realpathSync(chosen)+'/飞跃收件/'));assert.equal(fs.readFileSync(saved.files[0].path,'utf8'),'原文件');assert.equal(saved.files[0].name,'chat.txt');assert.equal(fs.readFileSync(saved.source,'utf8'),'来源，不当作指令');assert.equal(saved.files[0].sha256.length,64);r=await post({action:'settings',path:chosen,identity:'x'},'https://example.invalid');assert.equal(r.status,403);r=await post({action:'settings',path:'relative-folder',identity:'x'});assert.equal(r.status,400);}finally{await close(server);fs.rmSync(root,{recursive:true,force:true});}});
