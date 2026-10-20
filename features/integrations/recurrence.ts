import {RRule} from 'rrule';
import type {Task} from '../../lib/project-model';
export type RepeatInput={title:string;projectId:string;start:string;frequency:'daily'|'weekly'|'monthly';interval:number;count:number;minutes:number};
export function repeatTasks(input:RepeatInput,seriesId:string):{tasks:Task[];rule:string}{
 const day=new Date(input.start+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.start)||!Number.isFinite(day.getTime())||day.toISOString().slice(0,10)!==input.start)throw Error('请选择有效开始日期');
 if(!input.title.trim()||input.title.length>2000||!Number.isInteger(input.count)||input.count<1||input.count>100||!Number.isInteger(input.interval)||input.interval<1||input.interval>12||!Number.isFinite(input.minutes)||input.minutes<0||input.minutes>1440)throw Error('请填写事项名称；次数 1–100，间隔 1–12，预计分钟 0–1440');
 const frequencies={daily:RRule.DAILY,weekly:RRule.WEEKLY,monthly:RRule.MONTHLY};if(!(input.frequency in frequencies))throw Error('重复频率无效');
 const rule=new RRule({freq:frequencies[input.frequency],dtstart:day,interval:input.interval,count:input.count});
 // Floating UTC represents calendar days, so changing machine timezone cannot move an occurrence.
 return {rule:rule.toString(),tasks:rule.all().map(date=>({id:`repeat:${seriesId}:${date.toISOString().slice(0,10)}`,title:input.title.trim(),projectId:input.projectId,date:date.toISOString().slice(0,10),minutes:input.minutes,done:false,repeatSeriesId:seriesId}))};
}
