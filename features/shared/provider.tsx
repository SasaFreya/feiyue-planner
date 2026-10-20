'use client';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {initialState,reduce,activeSession,type State,type Command} from './model';
type Context={state:State;ready:boolean;pending:number;error:string;command:(c:Command)=>void;retry:()=>void};
const Hub=createContext<Context|null>(null);
export function HubProvider({children}:{children:ReactNode}){
 const [state,setState]=useState(initialState),[ready,setReady]=useState(false),[pending,setPending]=useState(0),[error,setError]=useState('');
 const base=useRef<State>(initialState()),queue=useRef<{id:string;command:Command}[]>([]),busy=useRef(false),mounted=useRef(true),channel=useRef<BroadcastChannel|null>(null);
 function project(){let s=base.current;for(const q of queue.current){try{s=reduce(s,q.command);}catch{}}if(mounted.current){setState(s);setPending(queue.current.length);}}
 async function refresh(){if(busy.current)return;try{const r=await fetch('/api/state',{cache:'no-store'});if(!r.ok)throw Error('读取失败，请重试');const incoming=await r.json() as State;if(incoming.version>=base.current.version)base.current=incoming;if(mounted.current){setReady(true);setError('');project();}}catch(e){if(mounted.current)setError(String((e as Error).message));}}
 async function flush(){if(busy.current||!queue.current.length)return;busy.current=true;try{while(queue.current.length){const q=queue.current[0];const r=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json','X-Feiyue-Request':'1'},body:JSON.stringify({...q,version:base.current.version})});const result=await r.json() as State & {error?:string};if(r.status===409){base.current=result;project();continue;}if(!r.ok)throw Error(result.error||'保存失败');base.current=result;queue.current.shift();project();channel.current?.postMessage('changed');}if(mounted.current)setError('');}catch(e){if(mounted.current)setError((e as Error).message+'，修改仍在待保存队列中');}finally{busy.current=false;}}
 function command(c:Command){try{let current=base.current;for(const q of queue.current)current=reduce(current,q.command);reduce(current,c);queue.current.push({id:crypto.randomUUID(),command:c});project();void flush();}catch(e){setError((e as Error).message);}}
 useEffect(()=>{mounted.current=true;void refresh();const bc=new BroadcastChannel('feiyue-unified');channel.current=bc;bc.onmessage=()=>{void refresh();};const poll=setInterval(()=>void refresh(),2500);const heartbeat=setInterval(()=>{const a=activeSession(base.current);if(a&&!queue.current.length){queue.current.push({id:crypto.randomUUID(),command:{type:'heartbeat',at:Date.now()}});void flush();}},15000);const unload=(e:BeforeUnloadEvent)=>{if(queue.current.length){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',unload);return()=>{mounted.current=false;bc.close();clearInterval(poll);clearInterval(heartbeat);window.removeEventListener('beforeunload',unload);};},[]);
 return <Hub.Provider value={{state,ready,pending,error,command,retry:()=>{void refresh();void flush();}}}>{children}</Hub.Provider>;
}
export function useHub(){const c=useContext(Hub);if(!c)throw Error('需要共享数据上下文');return c;}
export function useClock(){const [now,setNow]=useState(Date.now);useEffect(()=>{const i=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(i);},[]);return now;}
export function duration(ms:number){const sec=Math.max(0,Math.floor(ms/1000));return `${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor(sec/60)%60).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;}
