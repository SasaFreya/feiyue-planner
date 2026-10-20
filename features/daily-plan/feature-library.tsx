'use client';
import {useState} from 'react';
import {Bookmark,CalendarDays,Check,Clock3,Folder,NotebookPen,SlidersHorizontal,ChartNoAxesColumnIncreasing,BookOpen,MessageCircle,ArrowUpRight,Search,Pin,Repeat2,Download,ArrowRightLeft,Monitor} from 'lucide-react';
import {useHub} from '../shared/provider';
import {features,pinnedFeatures,defaultPinned,type FeatureId} from '../shared/feature-registry';

const icons={quotes:Bookmark,today:Check,calendar:CalendarDays,projects:Folder,paper:NotebookPen,reports:Clock3,capacity:SlidersHorizontal,estimates:ChartNoAxesColumnIncreasing,reflection:BookOpen,feedback:MessageCircle,recurring:Repeat2,superproductivity:Download,solidtime:ArrowRightLeft,activitywatch:Monitor};
const tones:Record<FeatureId,string>={quotes:'purple',today:'mint',calendar:'yellow',projects:'pink',paper:'purple',reports:'mint',capacity:'yellow',estimates:'purple',reflection:'pink',feedback:'mint',recurring:'yellow',superproductivity:'purple',activitywatch:'pink'};

export function FeatureLibrary({onOpen}:{onOpen:(id:FeatureId)=>void}){
 const {state,command}=useHub();const pinned=pinnedFeatures(state.settings.pinnedFeatures),[search,setSearch]=useState('');
 const matches=features.filter(f=>(f.name+f.description).includes(search.trim()));
 return <section className="feature-library refined-library"><header className="section-heading"><div><small>YOUR SPACE / 功能库</small><h2>留在手边，或好好收起。</h2><p className="subtle">把常用的留在侧栏，其他功能在这里等你。所有记录都还在。</p></div><span className="library-count"><strong>{pinned.length.toString().padStart(2,'0')}</strong><small>个常用入口</small></span></header>
 <div className="library-toolbar"><label className="library-search"><Search size={15} aria-hidden="true"/><input aria-label="搜索功能" placeholder="想用哪个功能？" value={search} onChange={e=>setSearch(e.target.value)}/></label><span>打开即用 · 随时收起</span></div>
 <div className="library-sections">{['规划与执行','记录与回顾','更多工具','开源扩展'].map((group,index)=>matches.some(f=>f.group===group)&&<section className="feature-group" key={group}><h3><span>{String(index+1).padStart(2,'0')}</span>{group}</h3>{matches.filter(f=>f.group===group).map(f=>{const Icon=icons[f.id],isPinned=pinned.includes(f.id);return <div className="feature-row" key={f.id}><button className="feature-open" onClick={()=>onOpen(f.id)}><span className={`feature-symbol tone-${tones[f.id]}`}><Icon size={17} strokeWidth={1.6} aria-hidden="true"/></span><span className="feature-copy"><strong>{f.name}<ArrowUpRight size={13} aria-hidden="true"/></strong><small>{f.description}</small></span></button><button className="feature-pin" aria-label={`${isPinned?'收起':'常用'} ${f.name}`} aria-pressed={isPinned} onClick={()=>command({type:'settings',patch:{pinnedFeatures:isPinned?pinned.filter(id=>id!==f.id):[...pinned,f.id]}})}><Pin size={12} aria-hidden="true"/>{isPinned?'常用':'放到侧栏'}</button></div>;})}</section>)}</div>
 {!matches.length&&<p className="empty-state">没有找到这个功能，试试“日历”或“时间”。</p>}
 <IntegrationStatus/>
 </section>;
}

export function IntegrationStatus(){return <details className="integration-status"><summary>组件与连接 <span>查看实际接入状态</span></summary><p>功能库收纳的是飞跃自身功能。以下分别标注代码组件、导入适配与外部连接。适配已接入不表示外部服务已经运行。</p><dl>{[
 ['FullCalendar','已接入','日历组件','https://fullcalendar.io/'],['dnd-kit','已接入','清单拖动组件','https://github.com/clauderic/dnd-kit'],['react-resizable-panels','已接入','日历可调分栏','https://github.com/bvaughn/react-resizable-panels'],['rrule','已接入','有限次重复安排，预览后加入日历','https://github.com/jkbrzt/rrule'],['Super Productivity','参考流程 + 备份兼容','专注执行使用飞跃原有任务计时；没有嵌入完整上游应用','https://github.com/super-productivity/super-productivity'],['solidtime','参考交互','项目工时直接读取飞跃实际记录；不是完整 solidtime 应用','https://github.com/solidtime-io/solidtime'],['ActivityWatch','可选外部适配保留','默认改用飞跃内置 macOS 应用记录，无需另开服务；不是嵌入上游完整应用','https://github.com/ActivityWatch/activitywatch'],
 ].map(([name,status,note,url])=><div key={name}><dt><a href={url} target="_blank" rel="noreferrer">{name}</a><small>{note}</small></dt><dd data-connected={status==='已接入'}>{status}</dd></div>)}</dl></details>;}

export function FeaturePreferences(){const {state,command}=useHub();const pinned=pinnedFeatures(state.settings.pinnedFeatures);return <section className="feature-preferences"><h3>常用功能</h3><p className="subtle">选中的功能显示在侧栏，其他功能仍能从“功能库”打开。</p><div className="feature-options">{features.map(f=><label key={f.id}><input type="checkbox" checked={pinned.includes(f.id)} onChange={e=>command({type:'settings',patch:{pinnedFeatures:e.target.checked?[...pinned,f.id]:pinned.filter(id=>id!==f.id)}})}/>{f.name}</label>)}</div><label><input type="checkbox" checked={state.settings.showProjectFilters===true} onChange={e=>command({type:'settings',patch:{showProjectFilters:e.target.checked}})}/> 在侧栏显示项目筛选</label><button onClick={()=>command({type:'settings',patch:{pinnedFeatures:[...defaultPinned],showProjectFilters:false}})}>恢复简约入口</button></section>;}
