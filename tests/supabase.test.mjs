import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createSupabaseDatabase} from '../lib/server/supabase.mjs';
import {createApi} from '../lib/server/service.mjs';
import {Store} from '../lib/server/store.mjs';

const projectUrl='https://ybrqqcxpzkogurvhbzlx.supabase.co';
test('migration works and can rerun as a non-superuser project owner',async t=>{
 const pg=new PGlite();t.after(()=>pg.close());
 await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE project_owner LOGIN CREATEROLE; GRANT CREATE ON DATABASE postgres TO project_owner; GRANT ALL ON SCHEMA public TO project_owner WITH GRANT OPTION; SET ROLE project_owner;');
 const migration=await readFile(new URL('../supabase/migrations/202611180001_family_care.sql',import.meta.url),'utf8');
 await pg.exec(migration);
 await pg.exec(migration);
 const result=await pg.query("SELECT rolname FROM pg_roles WHERE oid=(SELECT proowner FROM pg_proc WHERE oid='public.fc_execute(jsonb)'::regprocedure)");
 assert.equal(result.rows[0].rolname,'fc_backend');
});
async function database(t){
 const pg=new PGlite();
 await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
 await pg.exec(await readFile(new URL('../supabase/migrations/202611180001_family_care.sql',import.meta.url),'utf8'));
 t.after(()=>pg.close());
 const requests=[];
 const fetcher=async(url,options)=>{
  requests.push({url,options});
  try{const input=JSON.parse(options.body);const result=await pg.query('SELECT public.fc_execute($1::jsonb) result',[JSON.stringify(input.statements)]);return Response.json(result.rows[0].result);}
  catch(error){if(process.env.FC_TEST_DEBUG)console.error(error.message);return Response.json({code:error.code,message:error.message},{status:400});}
 };
 const db=createSupabaseDatabase({url:projectUrl,secretKey:'test-server-secret',fetcher});
 return {pg,db,requests};
}
function client(api){let cookie='';return async(path,body,method=body?'POST':'GET',authorization)=>{
 const response=await api(new Request('https://family.test/api/'+path,{method,headers:{origin:'https://family.test',cookie,'content-type':'application/json','idempotency-key':crypto.randomUUID(),...(authorization?{authorization:'Bearer '+authorization}:{})},body:body?JSON.stringify(body):undefined}));
 if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
 return {status:response.status,body:await response.json()};
};}
async function household(t){const context=await database(t),api=createApi(context.db,{dataKey:'ab'.repeat(32)}),owner=client(api);
 assert.equal((await owner('auth/register',{name:'Parent',email:'parent@example.test',password:'Integration-password-123'})).status,201);
 assert.equal((await owner('families',{name:'Test family'})).status,201);
 const child=(await owner('children',{name:'Test child',age:10})).body;
 return {...context,api,owner,child};
}

test('Supabase transaction rolls back, binds hostile text and protects SQL RPC/table access',async t=>{
 const {db,pg,requests}=await database(t);const s=new Store(db);
 await s.run('INSERT INTO accounts VALUES(?,?,?,?,?)',['owner','owner@example.test','Owner','test-hash',Date.now()]);
 const hostile="name '); DELETE FROM families; -- ? $1 ";
 await s.run('INSERT INTO families(id,owner_id,name,created_at) VALUES(?,?,?,?)',['f','owner',hostile,Date.now()]);
 assert.equal((await s.first('SELECT * FROM families WHERE id=?',['f'])).name,hostile);
 await assert.rejects(s.batch([['INSERT INTO service_state(key,value) VALUES(?,?)',['x','1']],['INSERT INTO service_state(key,value) VALUES(?,?)',['x','2']]]));
 assert.equal(await s.first('SELECT * FROM service_state WHERE key=?',['x']),null);
 assert.equal(requests[0].url,projectUrl+'/rest/v1/rpc/fc_execute');
 assert.equal(requests[0].options.headers.apikey,'test-server-secret');
 assert.ok(!requests[0].options.body.includes(hostile.replaceAll("'","''")));
 for(const role of ['anon','authenticated']){
  await pg.exec('SET ROLE '+role);
  await assert.rejects(pg.query('SELECT public.fc_execute($1::jsonb)',['[]']),/permission denied/);
  await assert.rejects(pg.query('SELECT * FROM family_care.families'),/permission denied/);
  await pg.exec('RESET ROLE');
 }
});

test('Supabase real parent/device lifecycle, JSON patches, CAS, usage, commands and revocation',async t=>{
 const {db,owner,child}=await household(t);
 const pair=(await owner('pairing',{childId:child.id})).body;
 const enroll={code:pair.code,name:'Android test',platform:'Android'};
 const result=await owner('device/enroll',enroll);assert.equal(result.status,201,JSON.stringify(result));const device=result.body;
 assert.equal((await owner('device/enroll',enroll)).status,409);
 const dev=(path,body)=>owner('device/'+path,body,body?'POST':'GET',device.token);
 assert.equal((await dev('heartbeat',{capabilities:{lock:'supported',usage:'supported'},battery:70,installedApps:[{packageId:'com.school',name:'School'}]})).status,200);
 const updated={...device.policy,dailyLimitMinutes:90};
 assert.equal((await owner('devices/'+device.deviceId+'/policy',{expectedVersion:1,policy:updated},'PUT')).status,200);
 assert.equal((await owner('devices/'+device.deviceId+'/policy',{expectedVersion:1,policy:updated},'PUT')).status,409);
 assert.equal((await dev('policy')).body.dailyLimitMinutes,90);
 const event={eventId:'usage-1',kind:'usage',capturedAt:Date.now(),payload:{packageId:'com.school',minutes:8.5,nightMinutes:0.5}};
 assert.equal((await dev('events',{events:[event]})).body.inserted,1);
 assert.equal((await dev('events',{events:[event]})).body.inserted,0);
 assert.equal((await owner('zones',{childId:child.id,name:'Home',lat:10,lng:106,radius:200})).status,201);
 const now=Date.now(),points=[['in',-90000,10],['out1',-60000,10.1],['out2',-25000,10.1]].map(([eventId,offset,lat])=>({eventId,kind:'location',capturedAt:now+offset,payload:{lat,lng:106,accuracy:5}}));
 assert.equal((await dev('events',{events:points})).status,200);
 assert.equal((await dev('events',{events:points})).body.inserted,0);
 const boot=await owner('bootstrap');assert.equal(boot.status,200,JSON.stringify(boot));assert.equal(boot.body.events[0].payload.minutes,8.5);
 assert.equal(boot.body.records.filter(r=>r.kind==='alert'&&r.data.type==='geofence').length,1);
 const command=await owner('devices/'+device.deviceId+'/commands',{type:'LOCK_SCREEN'});assert.equal(command.status,201);
 assert.equal((await dev('commands/'+command.body.id+'/results',{status:'acknowledged'})).status,200);
 assert.equal((await dev('commands/'+command.body.id+'/results',{status:'applied'})).status,200);
 const request=await dev('time-requests',{minutes:15,reason:'Finish class'});assert.equal(request.status,201);
 assert.equal((await owner('time-requests/'+request.body.id+'/decision',{decision:'approved'})).status,200);
 assert.equal((await owner('time-requests/'+request.body.id+'/decision',{decision:'approved'})).status,409);
 assert.equal((await dev('policy')).body.allowanceMinutes,15);
 assert.equal((await owner('insights',{childId:child.id})).status,201);
 await owner('devices/'+device.deviceId+'/revoke',{});
 assert.equal((await dev('policy')).status,401);
 assert.equal((await dev('events',{events:[{...event,eventId:'late-http'}]})).status,401);
 await assert.rejects(new Store(db).run('INSERT INTO events VALUES(?,?,?,?,?,?,?)',['late',device.deviceId,boot.body.family.id,'late','usage',Date.now(),'{}']));
});

test('Supabase isolation, caregiver acceptance/approval/revocation, encrypted imports and delete',async t=>{
 const {api,owner,child,pg}=await household(t);const other=client(api);
 await other('auth/register',{name:'Teacher',email:'teacher@example.test',password:'Integration-password-123'});
 const family=(await owner('bootstrap')).body.family;
 assert.equal((await other('bootstrap?familyId='+family.id)).status,403);
 const invitation=await owner('caregivers',{email:'teacher@example.test',name:'Teacher',role:'caregiver',childId:child.id,permissions:['location.read'],schedule:{start:'00:00',end:'00:00',days:[0,1,2,3,4,5,6]},expiresAt:Date.now()+86400000});assert.equal(invitation.status,201);
 assert.equal((await other('invitations/accept',{token:invitation.body.token})).status,200);
 assert.equal((await owner('caregivers/'+invitation.body.inviteId+'/approve',{})).status,200);
 assert.equal((await other('bootstrap?familyId='+family.id)).status,200);
 assert.equal((await other('children?familyId='+family.id,{name:'Denied',age:9})).status,403);
 const imported=await owner('imports',{childId:child.id,source:'manual',consent:true,content:'private-message Gửi mã OTP để nhận thưởng'});assert.equal(imported.status,201);
 const raw=await pg.query('SELECT data FROM family_care.records WHERE id=$1',[imported.body.id]);assert.ok(!raw.rows[0].data.includes('private-message'));
 assert.equal((await owner('imports/'+imported.body.id+'/confirm',{})).status,200);
 assert.equal((await owner('insights',{childId:child.id,importId:imported.body.id})).status,201);
 assert.equal((await owner('records/'+imported.body.id,undefined,'DELETE')).status,200);
 assert.equal((await owner('bootstrap')).body.records.filter(r=>r.kind==='insight').length,0);
 await owner('caregivers/'+invitation.body.inviteId+'/revoke',{});
 assert.equal((await other('bootstrap?familyId='+family.id)).status,403);
 assert.equal((await owner('export',{})).status,200);
 assert.equal((await owner('delete-data',{confirm:'Test family'})).status,200);
 assert.equal((await owner('auth/delete-account',{password:'Integration-password-123'})).status,200);
});

test('Supabase credentials/config fail closed; transport errors never expose secret or SQL',async()=>{
 assert.throws(()=>createSupabaseDatabase({url:'http://example.test',secretKey:'secret'}));
 assert.throws(()=>createSupabaseDatabase({url:projectUrl,secretKey:''}));
 const db=createSupabaseDatabase({url:projectUrl,secretKey:'secret',fetcher:async()=>Response.json({message:'secret SQL details'},{status:403})});
 await assert.rejects(db.prepare('SELECT 1').first(),error=>!error.message.includes('secret')&&!error.message.includes('SQL details'));
});
