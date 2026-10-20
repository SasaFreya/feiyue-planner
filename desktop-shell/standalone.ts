import {join} from 'node:path';
import {homedir} from 'node:os';
import {readFileSync,existsSync} from 'node:fs';
import {startServer} from './server';
const seedPath=join(__dirname,'seed.json');
startServer({dir:process.env.FEIYUE_DATA_DIR??join(homedir(),'Library/Application Support/FeiyuePlanner'),assets:join(__dirname,'ui'),seed:existsSync(seedPath)?JSON.parse(readFileSync(seedPath,'utf8')):undefined,legacyPath:join(homedir(),'Library/Application Support/FeiyueDesktop/schedule.json')}).then(s=>{console.log(`飞跃统一规划本：${s.url}`);process.on('SIGINT',()=>{s.close();process.exit(0);});}).catch(e=>{console.error(e);process.exit(1);});
