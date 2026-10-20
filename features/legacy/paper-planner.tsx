"use client";
import { useEffect, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { EntryField } from "@/components/planner/entry-field";
import { moveEntries, canUndo, type Entry, type Move } from "@/lib/planner-model";
import { ChevronLeft, ChevronRight, BookOpen, RotateCcw, Plus, Undo2, X, Sparkles } from "lucide-react";
import {useHub} from "@/features/shared/provider";
import {ProjectWorkspace,type Section} from "@/components/planner/project-workspace";
import {DayPanel} from "@/features/calendar/day-panel";
import {TaskEditor} from "@/features/daily-plan/task-editor";
import type {Task} from "@/lib/project-model";
type View = "week" | "months" | "year" | "calendar";
const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse = (s: string) => new Date(`${s}T12:00:00`);
const today = () => new Intl.DateTimeFormat("sv-SE", {timeZone:"Asia/Shanghai"}).format(new Date());
const add = (d: Date,n: number) => { const v=new Date(d); v.setDate(v.getDate()+n); return v; };
const monday = (d: Date) => add(d,-((d.getDay()+6)%7));
export function PaperPlanner() {
 const hub=useHub();
 const [panelDate,setPanelDate]=useState(today),[panelEditing,setPanelEditing]=useState<Task|null|undefined>();
 const [date,setDate]=useState("2026-10-01"), [view,setView]=useState<View>("week");
 const entries=hub.state.entries,ready=hub.ready,error=hub.error,pendingCount=hub.pending;
 const values=useRef(entries); values.current=entries;
 const [picked,setPicked]=useState<string|null>(null), [activeId,setActiveId]=useState<string|null>(null), [lastMove,setLastMove]=useState<Move|null>(null), [notice,setNotice]=useState("");
 const [section,setSection]=useState<Section|"paper">("paper");
 const theme=hub.state.settings.theme;
 function changeTheme(next:"spring"|"minimal"){hub.command({type:'settings',patch:{theme:next}});}
 const [extraRows,setExtraRows]=useState<Record<string,number>>({});
 const lastDragEnd=useRef(0);
 const sensors=useSensors(useSensor(MouseSensor,{activationConstraint:{distance:6}}),useSensor(TouchSensor,{activationConstraint:{delay:180,tolerance:6}}),useSensor(KeyboardSensor));
 const weekGrid=useRef<HTMLDivElement>(null);
 useEffect(()=>{setPicked(null);if(view!=="week"||!weekGrid.current||window.innerWidth>760)return;const grid=weekGrid.current, day=grid.children[(parse(date).getDay()+6)%7] as HTMLElement;if(day)grid.scrollLeft=day.offsetLeft-(grid.children[0] as HTMLElement).offsetLeft;},[date,view]);
 const selected=parse(date), start=monday(selected), days=Array.from({length:7},(_,i)=>add(start,i)), year=selected.getFullYear();
 function load(){hub.retry();}
 useEffect(()=>{setDate(today());},[]);
 useEffect(()=>{
  const context=(document as Document & {modelContext?:{registerTool:(tool:unknown,options:unknown)=>void|Promise<void>}}).modelContext;
  if(!context?.registerTool)return;
  const lifecycle=new AbortController();
  function validate(input:unknown){const d=(input as {date?:string})?.date;if(typeof d!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number(d.slice(0,4))<1900||Number(d.slice(0,4))>2100||Number.isNaN(parse(d).getTime())||iso(parse(d))!==d)throw Error("需要 1900–2100 年内的有效日期");return d;}
  const schema={type:"object",properties:{date:{type:"string",description:"YYYY-MM-DD"}},required:["date"],additionalProperties:false};
  const tools=[{name:"read_planner_day",title:"读取某天安排",description:"读取规划本中指定日期的待办、时间安排、随记和年度事项。",inputSchema:schema,annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input:unknown){const d=validate(input);return{date:d,entries:Object.fromEntries(Object.entries(values.current).filter(([key])=>key.startsWith(d+":"))) };}},
  {name:"open_planner_week",title:"翻到指定周",description:"切换到指定日期所在的周计划，不修改安排。",inputSchema:schema,annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(input:unknown){const d=validate(input);setDate(d);setView("week");await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return{date:d,view:"week",weekStart:iso(monday(parse(d)))};}}];
  for(const tool of tools){try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(console.error);}catch(e){console.error(e);}}
  return()=>lifecycle.abort();
 },[]);
 function flush(){if(hub.error)hub.retry();}
 function apply(patches:Record<string,Entry>){hub.command({type:'entries',patch:patches});}
 function update(key:string,patch:Partial<Entry>){apply({[key]:{...(values.current[key]||{text:"",done:false}),...patch}});}
 function move(source:string,target:string){
  const change=moveEntries(values.current,source,target);setPicked(null);if(!change)return;
  const occupied=!!values.current[target]?.text.trim();hub.command({type:'paperMove',source,target});setLastMove(change);
  setNotice(occupied?"两项已交换位置":"事项已移动");
 }
 function undo(){if(!lastMove)return;if(!canUndo(values.current,lastMove)){setNotice("这些事项已有新修改，保留当前内容。");setLastMove(null);return;}const keys=Object.keys(lastMove.before);hub.command({type:'paperMove',source:keys[0],target:keys[1]});setLastMove(null);setNotice("已撤销移动");}
 function pick(id:string){if(Date.now()-lastDragEnd.current<300)return;setPicked(current=>current===id?null:id);setNotice("");}
 function field(id:string,label:string,placeholder="",checkbox=false){return <EntryField key={id} id={id} label={label} placeholder={placeholder} checkbox={checkbox} entry={entries[id]||{text:"",done:false}} ready={ready} picked={picked} update={update} flush={()=>void flush()} pick={pick} move={move}/>;}
 function showInbox(){const grid=weekGrid.current;if(grid)grid.scrollTo({left:grid.scrollWidth,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});}
 function navigate(n:number){const d=new Date(selected);if(view==="week")d.setDate(d.getDate()+n*7);else d.setFullYear(d.getFullYear()+n);setDate(iso(d));}
 function openDay(d:Date){setDate(iso(d));setView("week");}
 function miniCalendar(month:number){const first=new Date(year,month,1,12),count=new Date(year,month+1,0).getDate();return <div className="mini-calendar"><div className="mini-weekdays">{weekdays.map((w,i)=><span className={i===0||i===6?"red":""} key={w}>{w}</span>)}</div><div className="mini-days">{Array.from({length:first.getDay()},(_,i)=><span key={`blank-${i}`}/>)}{Array.from({length:count},(_,i)=>{const d=new Date(year,month,i+1,12),key=iso(d),hasEntry=Object.keys(entries).some(k=>k.startsWith(key+":")&&entries[k].text.trim());return <button className={`${d.getDay()===0||d.getDay()===6?"red":""} ${key===today()?"calendar-today":""} ${hasEntry?"has-entry":""}`} aria-label={`${key}，查看周计划${hasEntry?"，有记录":""}`} key={key} onClick={()=>openDay(d)}>{i+1}</button>;})}</div></div>;}
 const weekKey=iso(start);
 const inboxRows=Math.max(8,extraRows[weekKey]||0,...Object.keys(entries).filter(key=>key.startsWith(`${weekKey}:inbox:`)).map(key=>Number(key.split(":")[2])+1));
 const period=`${start.getMonth()+1}月${start.getDate()}日 — ${days[6].getMonth()+1}月${days[6].getDate()}日`;
 return <DndContext sensors={sensors} collisionDetection={closestCenter}
  accessibility={{screenReaderInstructions:{draggable:"按空格开始移动，方向键调整位置，再按空格放下，按 Escape 取消。"}}}
  onDragStart={({active})=>{setActiveId(String(active.id));setPicked(null);setNotice("");}}
  onDragCancel={()=>{setActiveId(null);lastDragEnd.current=Date.now();}}
  onDragEnd={({active,over})=>{setActiveId(null);lastDragEnd.current=Date.now();if(over)move(String(active.id),String(over.id));}}
 ><main className="planner" onKeyDown={event=>{if(event.key==="Escape")setPicked(null);}}><header className="masthead"><div className="brand"><BookOpen size={24} strokeWidth={1.5}/><h1>飞跃日程规划本</h1><span className="edition">把想做的事，放进好日子</span></div><div className="masthead-actions"><div className="theme-switch" role="group" aria-label="规划本风格"><button aria-pressed={theme==="spring"} onClick={()=>changeTheme("spring")}>春日彩色</button><button aria-pressed={theme==="minimal"} onClick={()=>changeTheme("minimal")}>简约</button></div><div className="save-status" role="status">{!ready?"正在读取…":pendingCount?`待保存 ${pendingCount} 处`:"已保存"}</div></div></header>
 {error&&<div className="error" role="alert">{error}<button onClick={()=>ready?void flush():void load()}><RotateCcw size={16}/>重试</button></div>}
 <div className="app-mode-switch"><button aria-pressed={section==="paper"} onClick={()=>setSection("paper")}>纸本规划</button><button aria-pressed={section!=="paper"} onClick={()=>setSection("today")}>项目与日常</button><button onClick={()=>setSection("settings")}>设置 · 反馈</button></div><div hidden={section==="paper"}><ProjectWorkspace section={section==="paper"?"today":section} setSection={setSection} theme={theme} setTheme={changeTheme}/></div><div hidden={section!=="paper"}><Tabs value={view} onValueChange={v=>{setView(v as View);setPicked(null);}} className="planner-tabs"><div className="toolbar"><TabsList className="view-tabs" aria-label="规划本视图"><TabsTrigger value="week">周计划</TabsTrigger><TabsTrigger value="months">月度事项</TabsTrigger><TabsTrigger value="year">年度纵览</TabsTrigger><TabsTrigger value="calendar">全年日历</TabsTrigger></TabsList><div className="date-controls"><button className="today-button" onClick={()=>setDate(today())}>今天</button><input type="date" value={date} min="1900-01-01" max="2100-12-31" aria-label="跳转日期" onChange={e=>{if(e.target.value)setDate(e.target.value);}}/></div></div>
 <div className="page-title"><div><div className="eyebrow">{year} · {view==="week"?"WEEKLY PLAN":view==="months"?"MONTHLY EVENTS":view==="year"?"YEAR PLAN":"CALENDAR"}</div><h2>{view==="week"?period:`${year} 年`}</h2></div><div className="turn-page">{view==="week"&&<button className="inbox-jump" onClick={showInbox}>自由页</button>}<button onClick={()=>navigate(-1)} aria-label={view==="week"?"上一周":"上一年"}><ChevronLeft size={20}/></button><span>{view==="week"?"每周一页":"全年一页"}</span><button onClick={()=>navigate(1)} aria-label={view==="week"?"下一周":"下一年"}><ChevronRight size={20}/></button></div></div>
 <div className="interaction-bar"><span role="status" aria-live="polite">{picked?"已拿起事项 · 点一下目标位置即可放下":notice||"握住事项右侧的小把手，拖到想安排的位置"}</span><div>{picked&&<button onClick={()=>setPicked(null)}><X size={14}/>取消移动</button>}{lastMove&&<button onClick={undo}><Undo2 size={14}/>撤销移动</button>}</div></div>
 <TabsContent value="week"><div className="paper"><div className="paper-caption"><span>本周安排</span><span>先在自由页收集，再拖进每天</span></div><div className="week-grid" ref={weekGrid}>{days.map((d,i)=><section className={`day-column ${d.getDay()===0||d.getDay()===6?"weekend":""} ${iso(d)===today()?"is-today":""}`} data-tone={i%5} key={iso(d)}><header className="day-heading"><span className="day-number">{pad(d.getDate())}</span><div><span>星期{weekdays[d.getDay()]}</span><small>{d.getMonth()+1} 月{iso(d)===today()&&" · 今天"}</small></div></header><div className="day-todos">{Array.from({length:Math.max(5,...Object.keys(entries).filter(k=>k.startsWith(`${iso(d)}:todo:`)).map(k=>Number(k.split(":")[2])+1))},(_,i)=>field(`${iso(d)}:todo:${i}`,`${iso(d)} 待办 ${i+1}`,i===0?"写下待办…":"",true))}</div><div className="timeline">{Array.from({length:20},(_,i)=>i+5).map(hour=><div className="time-slot" key={hour}><span>{pad(hour)}</span>{field(`${iso(d)}:time:${hour}`,`${iso(d)} ${hour} 点安排`)}</div>)}</div><div className="day-notes"><span className="notes-label">随记</span><textarea aria-label={`${iso(d)} 随记`} disabled={!ready} placeholder="想法、记录、留白…" value={entries[`${iso(d)}:note:0`]?.text||""} maxLength={2000} onChange={e=>update(`${iso(d)}:note:0`,{text:e.target.value})} onBlur={()=>void flush()}/></div></section>)}<aside className="free-column" data-tone="3"><div className="paper-day-panel"><label>当天内容 <input type="date" value={panelDate} onChange={e=>setPanelDate(e.target.value)}/></label><DayPanel date={panelDate} onEdit={setPanelEditing}/></div>{panelEditing!==undefined&&<TaskEditor task={panelEditing??undefined} date={panelDate} onClose={()=>setPanelEditing(undefined)}/>}<header className="free-heading"><div><Sparkles size={17}/><h3>自由页</h3></div><p>重要的事，先放在这里</p></header><div className="inbox-list"><div className="notes-label">待分配 · 提醒</div>{Array.from({length:inboxRows},(_,i)=>field(`${weekKey}:inbox:${i}`,`${weekKey} 自由页事项 ${i+1}`,i===0?"写下想到的事…":"",true))}<button className="add-inbox" disabled={!ready||inboxRows>=100} onClick={()=>setExtraRows({...extraRows,[weekKey]:inboxRows+1})}><Plus size={16}/>再添一项</button></div><div className="free-notes"><label htmlFor="week-free-notes">随便写写</label><textarea id="week-free-notes" disabled={!ready} maxLength={10000} placeholder={'本周重点、灵感、备忘…\n\n不必马上安排，先记下来。'} value={entries[`${weekKey}:weeknote:0`]?.text||""} onChange={event=>update(`${weekKey}:weeknote:0`,{text:event.target.value})} onBlur={()=>void flush()}/></div><p className="free-tip">这里的事项，可以拖到任意一天。</p></aside></div></div><p className="footnote">让每一天，发生一点美好的事。</p></TabsContent>
 <TabsContent value="months"><div className="paper"><div className="paper-caption"><span>十二个月的重点事项</span><span>每月六项，留给真正重要的事</span></div><div className="quarter-grid">{Array.from({length:4},(_,q)=><div className="quarter" key={q}><div className="quarter-heading">第{["一","二","三","四"][q]}季度 <span>{q*3+1} — {q*3+3} 月</span></div>{Array.from({length:3},(_,j)=>q*3+j).map(m=><section className="month-card" data-tone={m%5} key={m}><div className="month-card-head"><h3><strong>{m+1}</strong><span>月</span></h3>{miniCalendar(m)}</div><div className="month-goals">{Array.from({length:6},(_,i)=>field(`${year}-${pad(m+1)}:goal:${i}`,`${year} 年 ${m+1} 月事项 ${i+1}`,i===0?"这个月，想完成…":"",true))}</div></section>)}</div>)}</div></div></TabsContent>
 <TabsContent value="year"><div className="paper"><div className="paper-caption"><span>年度纵览</span><span>按日期记录重要安排 · 横向查看十二个月</span></div><Table className="year-table"><TableHeader><TableRow><TableHead className="day-index">日</TableHead>{Array.from({length:12},(_,m)=><TableHead key={m}>{m+1} 月</TableHead>)}</TableRow></TableHeader><TableBody>{Array.from({length:31},(_,i)=>i+1).map(day=><TableRow key={day}><TableHead className="day-index" scope="row">{day}</TableHead>{Array.from({length:12},(_,m)=>{const d=new Date(year,m,day,12),valid=d.getMonth()===m;return <TableCell key={m} className={!valid?"invalid-day":d.getDay()===0||d.getDay()===6?"holiday-cell":""}>{valid&&<div className="year-cell"><button className="weekday-link" onClick={()=>openDay(d)} aria-label={`${iso(d)} 查看周计划`}>{weekdays[d.getDay()]}</button>{field(`${iso(d)}:year:0`,`${iso(d)} 年度安排`)}</div>}</TableCell>;})}</TableRow>)}</TableBody></Table></div></TabsContent>
 <TabsContent value="calendar"><div className="paper"><div className="paper-caption"><span>全年日历</span><span>点击日期，翻到对应周计划</span></div><div className="calendar-grid">{Array.from({length:12},(_,m)=><section className="calendar-month" data-tone={m%5} key={m}><h3><strong>{m+1}</strong> 月</h3>{miniCalendar(m)}</section>)}</div></div></TabsContent></Tabs></div></main><DragOverlay dropAnimation={{duration:200,easing:"cubic-bezier(.2,.8,.2,1)"}}>{activeId&&<div className="drag-preview"><Sparkles size={16}/>{entries[activeId]?.text}</div>}</DragOverlay></DndContext>;
}
