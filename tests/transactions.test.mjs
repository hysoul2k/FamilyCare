import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {enrollmentStatements,policyStatements} from '../lib/transactions.mjs';
function setup(){const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE pairings(token_hash TEXT PRIMARY KEY,family_id TEXT,child_id TEXT,expires_at INTEGER,consumed_at INTEGER); CREATE TABLE records(id TEXT PRIMARY KEY,family_id TEXT,kind TEXT,data TEXT,created_at INTEGER);CREATE TABLE credentials(token_hash TEXT PRIMARY KEY,device_id TEXT,family_id TEXT); INSERT INTO pairings VALUES('p','f','c',2000,NULL);`);return db;}
function run(db,statements){db.exec('BEGIN');try{const out=statements.map(([q,args])=>db.prepare(q).run(...args));db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}
test('enrollment consumes once and device and credential creation are atomic',()=>{
 const db=setup();const s=enrollmentStatements({hash:'p',now:1000,deviceId:'d',tokenHash:'t',data:{name:'Phone'}});run(db,s);run(db,enrollmentStatements({hash:'p',now:1000,deviceId:'d2',tokenHash:'t2',data:{}}));
 assert.equal(db.prepare('SELECT count(*) n FROM records').get().n,1);assert.equal(db.prepare('SELECT count(*) n FROM credentials').get().n,1);
});
test('enrollment failure rolls back token consumption',()=>{
 const db=setup();db.exec("INSERT INTO credentials VALUES('t','other','f')");assert.throws(()=>run(db,enrollmentStatements({hash:'p',now:1000,deviceId:'d',tokenHash:'t',data:{}})));assert.equal(db.prepare('SELECT consumed_at FROM pairings').get().consumed_at,null);assert.equal(db.prepare('SELECT count(*) n FROM records').get().n,0);
});
test('policy update creates command and audit atomically and losing CAS does nothing',()=>{
 const db=setup(),before=JSON.stringify({policy:{version:1}});db.prepare('INSERT INTO records VALUES(?,?,?,?,?)').run('d','f','device',before,0);
 const args={familyId:'f',deviceId:'d',before,policy:{version:2},marker:'m',commandId:'cmd',now:1000,actor:'a'};
 run(db,policyStatements(args));run(db,policyStatements({...args,marker:'m2',commandId:'cmd2'}));
 assert.equal(db.prepare("SELECT count(*) n FROM records WHERE kind='command'").get().n,1);assert.equal(db.prepare("SELECT count(*) n FROM records WHERE kind='audit'").get().n,1);
});
test('policy CAS compares version instead of JSON numeric formatting',()=>{
 const db=setup();db.prepare('INSERT INTO records VALUES(?,?,?,?,?)').run('d','f','device','{"policy":{"version":1},"lastSeen":1000.0}',0);
 const out=run(db,policyStatements({familyId:'f',deviceId:'d',before:'{"policy":{"version":1},"lastSeen":1000}',policy:{version:2},marker:'m',commandId:'cmd',now:1000,actor:'a'}));assert.equal(out[0].changes,1);
});
