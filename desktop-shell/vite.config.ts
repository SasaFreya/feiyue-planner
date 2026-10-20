import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
import {importStorage} from './import-storage';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {handleIntegrationRequest} from './integrations';
const apiTarget=process.env.FEIYUE_PREVIEW_API??'http://127.0.0.1:17863';
export default defineConfig({root:resolve(import.meta.dirname),plugins:[react(),{name:'feiyue-local-integrations',configureServer(server){const imports=importStorage(process.env.FEIYUE_IMPORT_CONFIG_DIR??join(homedir(),'Library/Application Support/FeiyuePlanner'));server.middlewares.use(async(req,res,next)=>{if(!await imports(req,res)&&!await handleIntegrationRequest(req,res))next();});}}],resolve:{alias:{'@':resolve(import.meta.dirname,'..')}},build:{outDir:resolve(import.meta.dirname,'../desktop-build/ui'),emptyOutDir:true},server:{host:'127.0.0.1',port:17865,strictPort:true,proxy:{'/api/native-activity':{target:apiTarget,changeOrigin:true,configure(proxy){proxy.on('proxyReq',(outgoing,incoming)=>{if(incoming.headers.origin===`http://${incoming.headers.host}`)outgoing.setHeader('Origin',new URL(apiTarget).origin);});}},'/api/state':{target:apiTarget,changeOrigin:true,configure(proxy){proxy.on('proxyReq',(outgoing,incoming)=>{
 // Rewrite only this preview's own same-origin requests; external origins remain rejected.
 if(incoming.headers.origin===`http://${incoming.headers.host}`)outgoing.setHeader('Origin',new URL(apiTarget).origin);
});}}}},publicDir:resolve(import.meta.dirname,'../public')});
