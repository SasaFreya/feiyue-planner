import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'feiyue-tests-'));try{await build({entryPoints:{'model.test':'features/shared/model.test.ts','store.test':'desktop-shell/store.test.ts','integrations.test':'features/integrations/integrations.test.ts'},outdir:dir,bundle:true,platform:'node',format:'cjs',external:['node:sqlite'],outExtension:{'.js':'.cjs'}});const r=spawnSync(process.execPath,['--test',join(dir,'model.test.cjs'),join(dir,'store.test.cjs'),join(dir,'integrations.test.cjs')],{stdio:'inherit'});process.exitCode=r.status??1;}finally{rmSync(dir,{recursive:true});}
