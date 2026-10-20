import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {initialState,reduce,reconcile,activeSession,type State,type Command,today} from '../features/shared/model';
import type {Workspace} from '../lib/project-model';
import type {Entries} from '../lib/planner-model';
export function openStore(dir:string,seed?:State|{workspace:Workspace;entries:Entries},legacyPath?:string){
 mkdirSync(dir,{recursive:true});const db=new DatabaseSync(join(dir,'planner.sqlite'));db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY CHECK(id=1),json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY,at INTEGER NOT NULL,command TEXT NOT NULL);');
 const existing=db.prepare('SELECT json FROM state WHERE id=1').get();
 if(!existing){let state=seed&&'sessions' in seed?JSON.parse(JSON.stringify(seed)) as State:initialState(seed?.workspace,seed?.entries);let legacy:Record<string,{id:string;text:string;done:boolean}[]>={};if(legacyPath&&existsSync(legacyPath)){legacy=JSON.parse(readFileSync(legacyPath,'utf8'));for(const [date,items]of Object.entries(legacy)){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Array.isArray(items))continue;for(const [index,item]of items.entries()){if(!item.text?.trim())continue;state.workspace.tasks.push({id:`swift:${date}:${item.id??index}`,title:item.text,date,done:!!item.done,completedOn:item.done?date:undefined,projectId:'',minutes:0});}}state=reconcile(state);}
  writeFileSync(join(dir,'migration-backup.json'),JSON.stringify({createdAt:new Date().toISOString(),website:seed??null,swift:legacy},null,2));db.prepare('INSERT INTO state(id,json)VALUES(1,?)').run(JSON.stringify(state));
 }
 function read():State{return JSON.parse(String(db.prepare('SELECT json FROM state WHERE id=1').get()!.json));}
 function snapshot(state:State,name:string){const backups=join(dir,'backups');mkdirSync(backups,{recursive:true,mode:0o700});const path=join(backups,name),temporary=path+'.tmp';writeFileSync(temporary,JSON.stringify(state,null,2),{mode:0o600});renameSync(temporary,path);}
 function dailyBackup(state:State){const name=`daily-${today()}.json`;if(!existsSync(join(dir,'backups',name)))snapshot(state,name);}
 dailyBackup(read());
 function execute(command:Command,id:string,version?:number){db.exec('BEGIN IMMEDIATE');try{const s=read();if(db.prepare('SELECT id FROM operations WHERE id=?').get(id)){db.exec('COMMIT');return {state:s,conflict:false};}if(version!==undefined&&version!==s.version){db.exec('COMMIT');return {state:s,conflict:true};}dailyBackup(s);const next=reduce(s,command);if(command.type!=='heartbeat')snapshot(next,'latest.json');next.applied=[...next.applied.slice(-999),id];db.prepare('UPDATE state SET json=? WHERE id=1').run(JSON.stringify(next));db.prepare('INSERT INTO operations(id,at,command)VALUES(?,?,?)').run(id,Date.now(),JSON.stringify(command));db.exec('COMMIT');return {state:next,conflict:false};}catch(e){db.exec('ROLLBACK');throw e;}}
 const active=activeSession(read());if(active)execute({type:'pause',at:active.heartbeat,review:true},`recovery:${Date.now()}`);
 return {read,execute,close:()=>db.close(),dir};
}
