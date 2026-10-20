import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from './store';
import {initialState,activeSession} from '../features/shared/model';
import {startServer} from './server';
test('migration backups, operation deduplication, version checks, reopen and recovery',()=>{const dir=mkdtempSync(join(tmpdir(),'feiyue-test-')),legacy=join(dir,'legacy.json');writeFileSync(legacy,JSON.stringify({'2026-10-13':[{id:'one',text:'旧桌面',done:false}]}));let store=openStore(dir,{workspace:initialState().workspace,entries:{'2026-10-13:todo:0':{text:'旧纸本',done:false}}},legacy);const s=store.read();assert.equal(s.workspace.tasks.length,2);assert(readFileSync(join(dir,'migration-backup.json'),'utf8').includes('旧桌面'));let result=store.execute({type:'start',id:s.workspace.tasks[0].id,at:1000},'start',s.version);assert.equal(result.state.sessions.length,1);assert.equal(store.execute({type:'start',id:s.workspace.tasks[0].id,at:2000},'start').state.sessions.length,1);assert.equal(store.execute({type:'pause',at:3000},'conflict',0).conflict,true);store.execute({type:'heartbeat',at:2500},'heartbeat');store.close();store=openStore(dir,undefined,legacy);assert.equal(store.read().workspace.tasks.length,2);assert.equal(activeSession(store.read()),undefined);assert.equal(store.read().sessions[0].end,2500);assert.equal(store.read().sessions[0].review,true);store.close();rmSync(dir,{recursive:true});});
test('loopback API checks origin and request header; persisted data readable by multiple clients',async()=>{const dir=mkdtempSync(join(tmpdir(),'feiyue-api-'));writeFileSync(join(dir,'index.html'),'<html>飞跃</html>');const server=await startServer({dir,assets:dir,port:0});try{const state=await(await fetch(server.url+'/api/state')).json() as {version:number};const cmd={id:'new',version:state.version,command:{type:'task',task:{id:'one',title:'共同事项',projectId:'',minutes:20,date:'2026-10-13',done:false}}};assert.equal((await fetch(server.url+'/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cmd)})).status,403);assert.equal((await fetch(server.url+'/api/state',{method:'POST',headers:{'Content-Type':'application/json','X-Feiyue-Request':'1','Origin':'https://example.com'},body:JSON.stringify(cmd)})).status,403);assert.equal((await fetch(server.url+'/api/state',{method:'POST',headers:{'Content-Type':'application/json','X-Feiyue-Request':'1'},body:JSON.stringify(cmd)})).status,200);const after=await(await fetch(server.url+'/api/state')).json() as ReturnType<typeof initialState>;assert.equal(after.workspace.tasks[0].title,'共同事项');assert.equal((await fetch(server.url+'/')).status,200);}finally{server.close();rmSync(dir,{recursive:true});}});
test('daily and latest snapshots preserve recoverable complete state',()=>{const dir=mkdtempSync(join(tmpdir(),'feiyue-backups-'));const store=openStore(dir);try{const s=store.read();const daily=join(dir,'backups',`daily-${new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(Date.now())}.json`);assert.equal(JSON.parse(readFileSync(daily,'utf8')).workspace.tasks.length,0);store.execute({type:'task',task:{id:'safe',title:'需保管事项',projectId:'',minutes:30,date:'2026-10-13',done:false}},'save');const latest=JSON.parse(readFileSync(join(dir,'backups','latest.json'),'utf8'));assert.equal(latest.workspace.tasks[0].title,'需保管事项');assert.equal(latest.version,s.version+1);assert.equal(JSON.parse(readFileSync(daily,'utf8')).workspace.tasks.length,0);}finally{store.close();rmSync(dir,{recursive:true});}});

test('updating the app reuses existing data and ignores a different migration seed',()=>{
 const dir=mkdtempSync(join(tmpdir(),'feiyue-upgrade-'));let store=openStore(dir);
 try{
  store.execute({type:'task',task:{id:'kept',title:'保留事项',projectId:'',minutes:30,date:'2026-10-16',done:false}},'task');
  store.execute({type:'entries',patch:{'2026-10-16:note:0':{text:'保留随记',done:false}}},'note');
  store.execute({type:'settings',patch:{avatar:'ball',showOuterProgress:false,pinnedFeatures:['calendar','reports'],showProjectFilters:false,calendarSidebarWidth:33}},'settings');
  store.execute({type:'session',session:{id:'kept-session',taskId:'kept',projectId:'',start:1000,end:61005,heartbeat:61005,source:'manual'}},'record');
  const before=store.read();store.close();
  const different=initialState();different.workspace.tasks=[{id:'unwanted',title:'不能覆盖旧数据',projectId:'',minutes:0,date:'',done:false}];
  store=openStore(dir,different);assert.deepEqual(store.read(),before);assert.equal(store.read().sessions[0].end,61005);
 }finally{store.close();rmSync(dir,{recursive:true});}
});
