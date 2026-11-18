import {spawn} from 'node:child_process';
import {DatabaseSync,backup} from 'node:sqlite';
import {readdirSync,mkdirSync,existsSync,statSync,unlinkSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {maintenance} from '../lib/server/maintenance.mjs';
import {selectDatabase} from '../lib/server/database.mjs';

if(existsSync('.dev.vars'))process.loadEnvFile('.dev.vars');
const remoteDatabase=process.env.FC_DATABASE_PROVIDER==='supabase'?selectDatabase(process.env):null;

const root=process.cwd(),state=resolve(root,'.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),backupDir=resolve(root,'.sites-runtime/backups');
let sweeping=false;
async function sweep(){
 if(remoteDatabase){if(sweeping)return;sweeping=true;try{await maintenance(remoteDatabase);}catch{console.warn('Supabase maintenance deferred; check connection configuration.');}finally{sweeping=false;}return;}
 if(sweeping||!existsSync(state))return;sweeping=true;
 try{for(const file of readdirSync(state).filter(n=>n.endsWith('.sqlite')&&n!=='metadata.sqlite')){
  const sqlite=new DatabaseSync(join(state,file));sqlite.exec('PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000');
  try{
   if(!sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='service_state'").get())continue;
   const wrap=(q,args=[])=>({bind(...v){return wrap(q,v);},async first(){return sqlite.prepare(q).get(...args)||null;},async all(){return {results:sqlite.prepare(q).all(...args)};},async run(){const r=sqlite.prepare(q).run(...args);return {meta:{changes:r.changes}};}});
   const db={prepare:wrap,async batch(queries){sqlite.exec('BEGIN IMMEDIATE');try{const r=[];for(const q of queries)r.push(await q.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
   await maintenance(db);
   mkdirSync(backupDir,{recursive:true});const day=new Date().toISOString().slice(0,10),destination=join(backupDir,`family-care-${day}.sqlite`);
   if(!existsSync(destination)&&typeof backup==='function')await backup(sqlite,destination);
   for(const name of readdirSync(backupDir)){
    if(!/^family-care-\d{4}-\d{2}-\d{2}\.sqlite$/.test(name))continue;
    const target=resolve(backupDir,name);if(!target.startsWith(backupDir+sep))continue;
    if(statSync(target).mtimeMs<Date.now()-30*86400000)unlinkSync(target);
   }
  }finally{sqlite.close();}
 }}catch(e){console.warn('Local maintenance deferred:',e.code||e.name);}finally{sweeping=false;}
}
const child=spawn(process.execPath,['scripts/run-framework.mjs','dev',...process.argv.slice(2)],{stdio:'inherit',windowsHide:true});
const timer=setInterval(()=>void sweep(),60000);timer.unref();setTimeout(()=>void sweep(),15000).unref();
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(timer);child.kill(signal);});
child.on('exit',code=>{clearInterval(timer);process.exitCode=code||0;});
