import {DatabaseSync} from 'node:sqlite';import {readdirSync,readFileSync} from 'node:fs';
export function testDatabase(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync(new URL('../../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../../drizzle/'+f,import.meta.url),'utf8'));
 const wrap=(q,args=[])=>({bind(...v){return wrap(q,v);},async first(){return sqlite.prepare(q).get(...args)||null;},async all(){return {results:sqlite.prepare(q).all(...args)};},async run(){const r=sqlite.prepare(q).run(...args);return {meta:{changes:r.changes},results:[]};},_q:q,_args:args});
 return {prepare:wrap,sqlite,async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
}
