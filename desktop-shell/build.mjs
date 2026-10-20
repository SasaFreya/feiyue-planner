import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..'),out=join(root,'desktop-build');mkdirSync(out,{recursive:true});
mkdirSync(join(out,'native'),{recursive:true});
if(process.platform==='darwin'){const native=spawnSync('swiftc',['-module-cache-path','/tmp/feiyue-swift-cache','-target','arm64-apple-macos13.0','-O',join(root,'desktop-shell/activity-agent.swift'),'-o',join(out,'native/activity-agent')],{stdio:'inherit'});if(native.status)process.exit(native.status);}
const result=spawnSync(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'build','--config','desktop-shell/vite.config.ts'],{cwd:root,stdio:'inherit'});if(result.status)process.exit(result.status);
await build({entryPoints:[join(root,'desktop-shell/main.ts')],outfile:join(out,'main.cjs'),bundle:true,platform:'node',format:'cjs',external:['electron','node:sqlite'],target:'node22'});
await build({entryPoints:[join(root,'desktop-shell/standalone.ts')],outfile:join(out,'standalone.cjs'),bundle:true,platform:'node',format:'cjs',external:['node:sqlite'],target:'node22'});
copyFileSync(join(root,'desktop-shell/preload.cjs'),join(out,'preload.cjs'));
// Distributable builds always start empty; never read the developer's local database.
const seed={workspace:{projects:[],tasks:[],notes:{},capacity:480,feedback:[]},entries:{}};
writeFileSync(join(out,'seed.json'),JSON.stringify(seed));
writeFileSync(join(out,'package.json'),JSON.stringify({name:'feiyue-planner',productName:'飞跃日程规划本',version:'0.3.1',main:'main.cjs',description:'飞跃日程规划本 · 桌面规划与实际计时',author:'Feiyue',private:true}));
console.log('桌面界面与空数据发行包已构建。');
