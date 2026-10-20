import {app,BrowserWindow,ipcMain,Menu,Tray,nativeImage,powerMonitor,shell,dialog} from 'electron';
import {join} from 'node:path';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {startServer} from './server';
import {activeSession} from '../features/shared/model';
let main:BrowserWindow,ball:BrowserWindow,widget:BrowserWindow,tray:Tray;
let service:Awaited<ReturnType<typeof startServer>>|undefined;let origin='';let shuttingDown=false;let dragStart:{x:number;y:number;bounds:Electron.Rectangle}|undefined;
const dataDir=process.env.FEIYUE_DATA_DIR??join(app.getPath('appData'),'FeiyuePlanner');
if(!app.requestSingleInstanceLock())app.quit();
else {
 app.on('second-instance',()=>{main?.show();main?.focus();});
 app.whenReady().then(async()=>{
  const base=__dirname,assets=join(base,'ui');const seedPath=join(base,'seed.json');
  try{service=await startServer({dir:dataDir,assets,chooseDirectory:async()=>{const result=await dialog.showOpenDialog({title:'选择飞跃附件默认保存位置',properties:['openDirectory','createDirectory']});return result.canceled?null:result.filePaths[0]??null;},activityHelper:join(process.resourcesPath,'activity-agent'),seed:existsSync(seedPath)?JSON.parse(readFileSync(seedPath,'utf8')):undefined,legacyPath:join(app.getPath('appData'),'FeiyueDesktop','schedule.json')});origin=service.url;}catch(e){await dialog.showMessageBox({type:'error',message:'飞跃无法启动',detail:(e as Error).message});app.quit();return;}
  const create=(options:Electron.BrowserWindowConstructorOptions)=>new BrowserWindow({...options,show:false,webPreferences:{preload:join(base,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  main=create({width:1320,height:900,minWidth:780,minHeight:600,title:'飞跃日程规划本',backgroundColor:'#fffcf7'});
  main.on('close',e=>{if(!shuttingDown){e.preventDefault();main.hide();}});
  ball=create({width:90,height:90,frame:false,transparent:true,hasShadow:false,alwaysOnTop:true,resizable:false,skipTaskbar:true,backgroundColor:'#00000000'});
  widget=create({width:350,height:480,minWidth:320,minHeight:360,frame:false,alwaysOnTop:true,skipTaskbar:true,resizable:true,backgroundColor:'#fffcf7'});
  const {screen}=await import('electron');const frame=screen.getPrimaryDisplay().workArea;ball.setPosition(frame.x+frame.width-125,frame.y+frame.height-150);
  try{const pos=JSON.parse(readFileSync(join(dataDir,'position.json'),'utf8'));if(screen.getAllDisplays().some(d=>pos.x>=d.workArea.x&&pos.y>=d.workArea.y&&pos.x+90<=d.workArea.x+d.workArea.width&&pos.y+90<=d.workArea.y+d.workArea.height))ball.setPosition(pos.x,pos.y);}catch{}
  ball.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});widget.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
  ball.on('close',e=>{if(!shuttingDown)e.preventDefault();});widget.on('close',e=>{if(!shuttingDown){e.preventDefault();widget.hide();}});
  await Promise.all([main.loadURL(origin),ball.loadURL(origin+'/?mode=ball'),widget.loadURL(origin+'/?mode=widget')]);
  await ball.webContents.insertCSS('html,body,#root{background:transparent!important;overflow:hidden!important}');ball.showInactive();main.show();
  for(const win of [main,ball,widget]){win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith(origin+'/')&&url!==origin)e.preventDefault();});}
  const image=nativeImage.createFromPath(join(assets,'avatar.png')).resize({width:18,height:18});tray=new Tray(image);tray.setToolTip('飞跃日程规划本');tray.setContextMenu(Menu.buildFromTemplate([{label:'打开完整规划',click:()=>{main.show();main.focus();}},{label:'显示今日清单',click:()=>toggle(true)},{label:'找回悬浮头像',click:()=>{ball.setPosition(frame.x+frame.width-125,frame.y+frame.height-150);ball.showInactive();}},{label:'在浏览器打开同一规划本',click:()=>shell.openExternal(origin)},{label:'打开数据与备份文件夹',click:()=>shell.openPath(dataDir)},{type:'separator'},{label:'退出飞跃（暂停计时）',click:()=>app.quit()}]));
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'飞跃',submenu:[{label:'关于飞跃',click:()=>dialog.showMessageBox({message:'飞跃日程规划本',detail:'桌面与浏览器共享本机数据。关闭主窗口后计时继续，退出或睡眠自动暂停。'})},{type:'separator'},{role:'quit'}]},{label:'编辑',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},{label:'窗口',submenu:[{role:'minimize'},{role:'zoom'},{label:'完整规划',click:()=>main.show()}]}]));
  const allowed=(event:Electron.IpcMainEvent)=>[ball,widget,main].some(w=>w.webContents.id===event.sender.id);
  ipcMain.on('feiyue:window',(event,action)=>{if(!allowed(event))return;if(action==='toggle')toggle();if(action==='hide')widget.hide();if(action==='main'||action==='projects'){main.show();main.focus();if(action==='projects')main.webContents.send('feiyue:navigate','projects');}});
  ipcMain.on('feiyue:drag',(event,action,x,y)=>{if(event.sender.id!==ball.webContents.id||!Number.isFinite(x)||!Number.isFinite(y))return;if(action==='begin')dragStart={x,y,bounds:ball.getBounds()};if(action==='move'&&dragStart){ball.setPosition(Math.round(dragStart.bounds.x+x-dragStart.x),Math.round(dragStart.bounds.y+y-dragStart.y));widget.hide();}if(action==='end'){dragStart=undefined;const bounds=ball.getBounds();writeFileSync(join(dataDir,'position.json'),JSON.stringify({x:bounds.x,y:bounds.y}));}});
  function pause(review=false){if(service&&activeSession(service.store.read()))service.store.execute({type:'pause',at:Date.now(),review},crypto.randomUUID());}
  powerMonitor.on('suspend',()=>pause());powerMonitor.on('shutdown',()=>pause());
  app.on('before-quit',()=>{shuttingDown=true;pause();service?.close();});
 }).catch(e=>{dialog.showErrorBox('飞跃启动失败',String(e));app.quit();});
}
function toggle(force=false){if(widget.isVisible()&&!force){widget.hide();return;}const {screen}=require('electron') as typeof import('electron');const frame=screen.getDisplayMatching(ball.getBounds()).workArea,b=ball.getBounds(),w=widget.getBounds();const x=Math.max(frame.x,Math.min(b.x-w.width-12,frame.x+frame.width-w.width)),y=Math.max(frame.y,Math.min(b.y+b.height-w.height,frame.y+frame.height-w.height));widget.setPosition(x,y);widget.show();widget.focus();}
app.on('window-all-closed',()=>{});
app.on('activate',()=>{main?.show();});
