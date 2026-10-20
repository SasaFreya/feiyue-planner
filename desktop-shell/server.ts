import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {importStorage} from './import-storage';
import {nativeActivity} from './native-activity';
import {openStore} from './store';
import {handleIntegrationRequest} from './integrations';
const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
export async function startServer({dir,assets,seed,legacyPath,port=17863,activityHelper,chooseDirectory}:{dir:string;assets:string;seed?:Parameters<typeof openStore>[1];legacyPath?:string;port?:number;activityHelper?:string;chooseDirectory?:()=>Promise<string|null>}){
 const imports=importStorage(dir,chooseDirectory);let activity:ReturnType<typeof nativeActivity>|undefined;let store:ReturnType<typeof openStore>;const token=randomBytes(32).toString('hex');let currentPort=port;
 const server=createServer(async(req:IncomingMessage,res:ServerResponse)=>{
  const host=req.headers.host??'';const localHost=/^(127\.0\.0\.1|localhost):\d+$/.test(host);if(!localHost){res.writeHead(403);res.end('Host not allowed');return;}
  const url=new URL(req.url??'/',`http://${host}`);const origin=req.headers.origin;const originValid=!origin||origin===`http://${host}`;
  const json=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(url.pathname.startsWith('/api/')){
   if(await imports(req,res))return;
   if(await activity?.handle(req,res))return;
   if(await handleIntegrationRequest(req,res))return;
   if(!originValid||req.headers['sec-fetch-site']==='cross-site'){json(403,{error:'请求来源无效'});return;}
   if(url.pathname==='/api/state'&&req.method==='GET'){json(200,store.read());return;}
   if(url.pathname==='/api/state'&&req.method==='POST'){
    if(req.headers['x-feiyue-request']!=='1'){json(403,{error:'缺少来源校验'});return;}
    try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>3000000)throw Error('内容过大');}const input=JSON.parse(raw);if(typeof input.id!=='string'||input.id.length>100||!Number.isSafeInteger(input.version))throw Error('操作格式无效');const result=store.execute(input.command,input.id,input.version);json(result.conflict?409:200,result.state);}catch(e){json(400,{error:(e as Error).message});}return;
   }
   json(404,{error:'接口不存在'});return;
  }
  const file=resolve(assets,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(resolve(assets)+ '/')){res.writeHead(403);res.end();return;}
  try{const path=existsSync(file)&&extname(file)?file:join(assets,'index.html');res.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff','Set-Cookie':`feiyue=${token}; HttpOnly; SameSite=Strict; Path=/`});res.end(readFileSync(path));}catch{res.writeHead(404);res.end('Not found');}
 });
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{currentPort=(server.address() as {port:number}).port;resolve();});});
 try{store=openStore(dir,seed,legacyPath);if(activityHelper)activity=nativeActivity(dir,activityHelper);}catch(e){server.close();throw e;}
 return {store,server,url:`http://127.0.0.1:${currentPort}`,close:()=>{activity?.close();server.close();store.close();}};
}
