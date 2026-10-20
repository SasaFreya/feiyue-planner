export const features=[
 {id:'today',name:'今天',description:'每天的事项、顺序、勾选与计时。',group:'规划与执行'},
 {id:'calendar',name:'日历',description:'在日、周、月、年之间查看计划和实际时间。',group:'规划与执行'},
 {id:'projects',name:'项目与分类',description:'管理项目、任务和颜色。',group:'规划与执行'},
 {id:'paper',name:'笔记与心愿',description:'每日感想、周随笔、月度心愿和以往备忘。',group:'记录与回顾'},
 {id:'quotes',name:'句子收藏',description:'留住触动你的话，也可以记下来源。',group:'记录与回顾'},
 {id:'reports',name:'时间记录',description:'按事项或项目查看日、周、月、年工时，补录与修正时段。',group:'记录与回顾'},
 {id:'capacity',name:'项目管理',description:'在轻量看板中管理项目事项、截止日期与投入，按需分配安排。',group:'更多工具'},
 {id:'estimates',name:'预计与完成',description:'根据事项预计分钟查看完成趋势，与实际计时分开。',group:'更多工具'},
 {id:'reflection',name:'导出与回响之书',description:'按周翻阅记录，打印或导出日程。',group:'更多工具'},
 {id:'feedback',name:'使用反馈',description:'记录使用问题、建议和反馈，保存在本机。',group:'更多工具'},
 {id:'recurring',name:'重复安排',description:'用 rrule 生成课程、练习和固定回顾，先预览再加入日历。',group:'开源扩展'},
 {id:'superproductivity',name:'专注执行',description:'选中已有事项直接正计时或倒计时，完成后同步日历。',group:'开源扩展'},
 {id:'activitywatch',name:'电脑活动回顾',description:'在飞跃里开启应用活动记录，闲置自动排除，查看每天分布。',group:'开源扩展'},
] as const;
export type FeatureId=typeof features[number]['id'];
export const defaultPinned:FeatureId[]=['today','calendar','paper'];
export function pinnedFeatures(value?:string[]):FeatureId[]{return value===undefined?[...defaultPinned]:value.filter((id,i)=>isFeature(id)&&value.indexOf(id)===i) as FeatureId[];}
export function isFeature(id:string):id is FeatureId{return features.some(f=>f.id===id);}
