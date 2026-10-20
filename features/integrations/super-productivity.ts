import type {Workspace,Task,Project} from '../../lib/project-model';
import {validWorkspace} from '../../lib/project-model';
// Independent compatibility adapter for upstream CompleteBackup.data.task/project EntityState.
// Upstream contract: src/app/op-log/backup/backup.service.ts and features/tasks/task.model.ts.
type Dict=Record<string,unknown>;
const object=(v:unknown):v is Dict=>!!v&&typeof v==='object'&&!Array.isArray(v);
const date=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:'';
const id=(v:unknown)=>typeof v==='string'&&v.length>0&&v.length<=70?v:'';
export function previewSuperProductivity(raw:unknown,workspace:Workspace){
 if(!object(raw))throw Error('请选择 Super Productivity 导出的未加密 JSON 备份');
 const data=object(raw.data)?raw.data:raw;
 if(!object(data.task)||!object(data.task.entities)||!object(data.project)||!object(data.project.entities))throw Error('无法识别备份：需要 task.entities 和 project.entities；不支持加密或 V1 备份');
 const projects:Project[]=[],tasks:Task[]=[];let skipped=0,duplicates=0,dayTotals=0,nested=0,timed=0;
 for(const source of Object.values(data.project.entities)){
  if(!object(source)||!id(source.id)||typeof source.title!=='string'||!source.title.trim()){skipped++;continue;}
  const pid='sp:project:'+source.id;if([...workspace.projects,...projects].some(p=>p.id===pid)){duplicates++;continue;}
  projects.push({id:pid,name:source.title.slice(0,200),start:'',deadline:'',color:['#e3b542','#cf7394','#9972c6','#5d9d82'][(projects.length)%4],archived:source.isArchived===true});
 }
 for(const source of Object.values(data.task.entities)){
  if(!object(source)||!id(source.id)||typeof source.title!=='string'||!source.title.trim()){skipped++;continue;}
  const tid='sp:task:'+source.id;if([...workspace.tasks,...tasks].some(t=>t.id===tid)){duplicates++;continue;}
  const pid=id(source.projectId)?'sp:project:'+source.projectId:'';
  const withTime=typeof source.dueWithTime==='number'&&Number.isFinite(source.dueWithTime)&&Math.abs(source.dueWithTime)<8.64e15;
  const plannedDay=withTime?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(source.dueWithTime as number):date(source.dueDay);
  if(withTime)timed++;if(source.parentId)nested++;if(object(source.timeSpentOnDay))dayTotals+=Object.values(source.timeSpentOnDay).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0).reduce((a,b)=>a+b,0);
  tasks.push({id:tid,title:source.title.slice(0,2000),projectId:[...workspace.projects,...projects].some(p=>p.id===pid)?pid:'',date:plannedDay,minutes:Math.min(1440,Math.max(0,Math.round((typeof source.timeEstimate==='number'&&Number.isFinite(source.timeEstimate)?source.timeEstimate:0)/60000))),done:source.isDone===true,completedOn:source.isDone===true&&typeof source.doneOn==='number'&&Number.isFinite(source.doneOn)&&Math.abs(source.doneOn)<8.64e15?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(source.doneOn):undefined});
 }
 const next={...workspace,projects:[...workspace.projects,...projects],tasks:[...workspace.tasks,...tasks]};if(!validWorkspace(next))throw Error('导入内容格式无效或超过本机容量（100 项目 / 5000 事项）');
 return {projects,tasks,skipped,duplicates,dayTotals,nested,timed};
}
export function mergeSuperProductivity(raw:unknown,workspace:Workspace){const p=previewSuperProductivity(raw,workspace);return {...workspace,projects:[...workspace.projects,...p.projects],tasks:[...workspace.tasks,...p.tasks]};}
