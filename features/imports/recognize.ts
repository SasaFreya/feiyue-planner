export type Candidate={id:string;title:string;date:string;owner:'me'|'others'|'unclear';assignees:string[];reason:string;evidence:string};
const day=(ms:number)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(ms);
export function extractDate(text:string,base:string){const explicit=text.match(/(20\d{2})[年/-](\d{1,2})[月/-](\d{1,2})日?/);const short=text.match(/(?<!\d)(\d{1,2})月(\d{1,2})日/);let value=explicit?`${explicit[1]}-${explicit[2].padStart(2,'0')}-${explicit[3].padStart(2,'0')}`:short?`${base.slice(0,4)}-${short[1].padStart(2,'0')}-${short[2].padStart(2,'0')}`:'';if(!value){const offset=text.includes('后天')?2:text.includes('明天')?1:text.includes('今天')?0:null;if(offset!==null)value=day(Date.parse(base+'T12:00:00+08:00')+offset*86400000);}if(value){const at=Date.parse(value+'T12:00:00+08:00');if(!Number.isFinite(at)||day(at)!==value)return '';}return value;}
export function recognize(text:string,identity:string,base:string):Candidate[]{
 const normalized=text.replace(/\r/g,'').replace(/[\u2005\u2006\u2009\u200a\u00a0]/g,' ');const lines=normalized.split('\n');const messages:{text:string;base:string}[]=[];let buffer:string[]=[],anchor=base;function flush(){const t=buffer.join('\n').trim();if(t&&t!=='&')messages.push({text:t,base:anchor});buffer=[];}
 for(const line of lines){const header=line.trim().match(/^(20\d{2})年(\d{1,2})月(\d{1,2})日\s+\d{1,2}:\d{2}$/);if(header){flush();anchor=`${header[1]}-${header[2].padStart(2,'0')}-${header[3].padStart(2,'0')}`;}else if(line.trim()==='&'){flush();}else buffer.push(line);}flush();
 const result:Candidate[]=[];let writing:Candidate|undefined;
 for(const msg of messages){const content=msg.text;const mentions=[...content.matchAll(/@([^@\s，,。！？；;]+)(?=\s|@|[，,。！？；;]|$)/g)].map(m=>m[1]);const assignment=content.match(/(?:那就|就)?请\s*(.+?)(?:来写|撰写|负责|完成|提交)/);const action=/(试用|建议|写一篇|撰写|提交|完成|汇报|参加|开会|会议|作业|报名|整理|交付|截止|负责|评测)/.test(content);if(!action&&!assignment)continue;
 if(/有没有时间指导|有时间指导/.test(content))continue;
 if(assignment&&writing){const assignees=assignment[1].split(/[+＋、和与,，\s]+/).map(x=>x.replace(/^@/, '').trim()).filter(Boolean);writing.assignees=assignees;writing.owner=identity&&assignees.includes(identity)?'me':'others';writing.reason=writing.owner==='me'?'后续消息明确指派给你':'后续消息将此事指派给其他人，不默认生成你的安排';writing.evidence+='\n后续指派：'+content;continue;}
 const owner:Candidate['owner']=identity&&mentions.includes(identity)?'me':mentions.length?'others':'unclear';const candidate:Candidate={id:`candidate-${result.length}`,title:content.replace(/@[^@\s，,。！？；;]+/g,'').replace(/\s+/g,' ').trim().slice(0,300),date:extractDate(content,msg.base),owner,assignees:mentions,reason:owner==='me'?'原文明确提到你，是否承担仍需确认':owner==='others'?'原文提到其他人，未明确指派给你':'没有明确指派对象，请确认是否与你有关',evidence:content};
 if(/谁有时间|谁可以|谁能|有没有人/.test(content)){candidate.owner='unclear';candidate.reason='这是公开征询，不能直接认定由你承担';}
 if(/写一篇|撰写/.test(content))writing=candidate;
 result.push(candidate);
 }
 return result.slice(0,50);
}
