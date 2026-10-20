'use client';
import {useState} from 'react';
import {useHub,useClock,duration} from '../shared/provider';
import {activeSession,prepareSessionCorrection,type Session} from '../shared/model';

// Keep the original timestamp when its displayed value is unchanged (including milliseconds).
const local=(at:number)=>new Date(at+8*3600000).toISOString().slice(0,19);
const parse=(value:string,original:number)=>value===local(original)?original:Date.parse(value+'+08:00');

export function SessionEditor({session,onClose,onSaved}:{session:Session|null;onClose:()=>void;onSaved?:(previous:Session|null)=>void}){
 const {state,command}=useHub(),now=useClock();
 const [start]=useState(()=>session?.start??Date.now()-1800000),[end,setEnd]=useState(()=>session?.end??Date.now());
 const [startText,setStartText]=useState(()=>local(start)),[endText,setEndText]=useState(()=>local(end));
 const [baseline,setBaseline]=useState(session);
 const [taskId,setTaskId]=useState(()=>session?.taskId??state.workspace.tasks[0]?.id??''),[switchId,setSwitchId]=useState(''),[error,setError]=useState('');
 const current=session?state.sessions.find(x=>x.id===session.id):undefined;
 const running=current?.end===null;
 const target=state.workspace.tasks.find(t=>t.id===taskId);
 function save(){
  try{
   if(session&&(!current||JSON.stringify(current)!==JSON.stringify(baseline)))throw Error('这条记录已在其他窗口更新，请关闭后重新打开。');
   const next=prepareSessionCorrection(state,baseline,{taskId,start:parse(startText,start),end:parse(endText,end)},Date.now());
   command({type:'session',session:next});onSaved?.(session);onClose();
  }catch(e){setError((e as Error).message);}
 }
 return <div className="editor-backdrop"><section className="task-editor session-editor" role="dialog" aria-modal="true" aria-label={session?'修正实际记录':'补录时间'}><header><h3>{session?'修正实际记录':'补录时间'}</h3><button onClick={onClose}>关闭</button></header>
  {running?<>
   <p>正在记录：<strong>{state.workspace.tasks.find(t=>t.id===current.taskId)?.title??current.titleSnapshot}</strong></p>
   <p className="session-duration">{duration(now-current.start)}</p>
   <p className="subtle">现在开始做另一件事，可以直接切换；前一段会自动结束。需要改之前记错的时间，请先暂停。</p>
   <label>接下来做什么<select value={switchId} onChange={e=>setSwitchId(e.target.value)}><option value="">选择事项</option>{state.workspace.tasks.filter(t=>!t.done&&t.id!==current.taskId).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
   <div className="session-actions"><button disabled={!switchId} onClick={()=>{command({type:'start',id:switchId,at:Date.now()});onClose();}}>切换并开始</button><button onClick={()=>{const at=Date.now();command({type:'pause',at});setBaseline({...current,end:at,heartbeat:at,review:undefined});setEnd(at);setEndText(local(at));}}>暂停后修正</button></div>
  </>:<form onSubmit={e=>{e.preventDefault();save();}}>
   <p className="subtle">这段时间实际做了别的事？选择正确事项，也可以调整起止时间。日历与时间统计会一起更新，原计划和完成状态保留。</p>
   <label>实际做的事项<select value={taskId} onChange={e=>setTaskId(e.target.value)} required>{!target&&<option value={taskId} disabled>{session?.titleSnapshot??'请选择事项'}（原事项已移除）</option>}{state.workspace.tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
   <p className="subtle">计入项目：{state.workspace.projects.find(p=>p.id===(session&&session.taskId===taskId?session.projectId:target?.projectId))?.name??'未分类'}{session&&session.taskId!==taskId?' · 整段改记到此事项':''}</p>
   <label>开始（北京时间）<input type="datetime-local" step="1" required value={startText} onChange={e=>setStartText(e.target.value)}/></label>
   <label>结束（北京时间）<input type="datetime-local" step="1" required value={endText} onChange={e=>setEndText(e.target.value)}/></label>
   <p className="subtle">实际时长：{duration(Math.max(0,parse(endText,end)-parse(startText,start))||0)}</p>
   {error&&<p role="alert">{error}</p>}
   <button className="primary-button" disabled={!target}>保存时间记录</button>
  </form>}
 </section></div>;
}
