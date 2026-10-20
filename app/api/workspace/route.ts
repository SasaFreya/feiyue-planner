import {env} from 'cloudflare:workers';
import {emptyWorkspace,validWorkspace} from '@/lib/project-model';
const key='workspace:v1';
function database(){if(!env.DB)throw Error('Missing database');return env.DB;}
export async function GET(){try{const row=await database().prepare('SELECT text FROM planner_entries WHERE key = ?').bind(key).first<{text:string}>();return Response.json(row?JSON.parse(row.text):emptyWorkspace(),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'无法读取项目数据'},{status:503});}}
export async function PUT(request:Request){if(request.headers.get('Sec-Fetch-Site')==='cross-site')return Response.json({error:'请求来源无效'},{status:403});try{const raw=await request.text();if(raw.length>2000000)return Response.json({error:'内容过大'},{status:413});const state=JSON.parse(raw);if(!validWorkspace(state))return Response.json({error:'内容格式无效'},{status:400});await database().prepare('INSERT INTO planner_entries (key,text,done) VALUES (?,?,0) ON CONFLICT(key) DO UPDATE SET text=excluded.text').bind(key,raw).run();return Response.json({saved:true});}catch{return Response.json({error:'保存失败，请重试'},{status:503});}}
