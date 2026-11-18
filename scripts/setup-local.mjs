import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {existsSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
function run(args){const r=spawnSync(process.execPath,args,{stdio:'inherit',windowsHide:true});if(r.status!==0)process.exit(r.status||1);}
if(!existsSync('.dev.vars'))writeFileSync('.dev.vars','FC_DATA_KEY='+randomBytes(32).toString('hex')+'\n',{mode:0o600});
if(!existsSync('dist/server/wrangler.json'))run(['scripts/run-framework.mjs','build']);
run(['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--command','SELECT 1']);
const folder=resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const files=readdirSync(folder).filter(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite');if(files.length!==1)throw Error('Không xác định duy nhất database local. Kiểm tra binding DB trước khi chạy migration.');
const db=new DatabaseSync(join(folder,files[0]));db.exec('PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000;CREATE TABLE IF NOT EXISTS fc_local_migrations(name TEXT PRIMARY KEY,applied_at INTEGER NOT NULL)');
try{
 const legacy={ '0000_omniscient_blob.sql':['table','families'],'0001_mutation_guards.sql':['trigger','events_active_device'],'0002_real_accounts_and_jobs.sql':['trigger','credentials_active_family'],'0003_accounts.sql':['table','accounts'] };
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()){
  if(db.prepare('SELECT name FROM fc_local_migrations WHERE name=?').get(file))continue;
  const known=legacy[file],already=known&&db.prepare('SELECT name FROM sqlite_master WHERE type=? AND name=?').get(...known);
  db.exec('BEGIN IMMEDIATE');try{if(!already)db.exec(readFileSync(join('drizzle',file),'utf8'));db.prepare('INSERT INTO fc_local_migrations VALUES(?,?)').run(file,Date.now());db.exec('COMMIT');console.log((already?'Đã nhận diện migration cũ: ':'Đã áp dụng migration: ')+file);}catch(e){db.exec('ROLLBACK');throw e;}
 }
}finally{db.close();}
console.log('Database local sẵn sàng. Không tạo tài khoản, trẻ hoặc sự kiện mẫu.');
