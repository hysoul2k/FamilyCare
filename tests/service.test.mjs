import {test} from 'node:test';import assert from 'node:assert/strict';import {testDatabase} from './helpers/d1.mjs';import {createApi} from '../lib/server/service.mjs';
function client(api){let cookie='';return async(path,body,method=body?'POST':'GET')=>{const r=await api(new Request('http://localhost/api/'+path,{method,headers:{cookie,origin:'http://localhost','content-type':'application/json','idempotency-key':crypto.randomUUID()},body:body?JSON.stringify(body):undefined}));if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};};}
async function account(c,email='parent@example.test'){return c('auth/register',{name:'Phụ huynh',email,password:'A real test password 123!'});}
test('real accounts have no seeded family and sessions revoke on logout',async()=>{const c=client(createApi(testDatabase()));assert.equal((await c('bootstrap')).status,401);assert.equal((await account(c)).status,201);assert.equal((await c('bootstrap')).body.family,null);assert.equal((await c('families',{name:'Gia đình thật'})).status,201);assert.equal((await c('bootstrap')).body.records.length,0);await c('auth/logout',{});assert.equal((await c('bootstrap')).status,401);});
test('two real accounts are tenant isolated and invites require owner approval',async()=>{
 const api=createApi(testDatabase()),owner=client(api),other=client(api);await account(owner);await account(other,'care@example.test');await owner('families',{name:'Nhà A'});const ch=await owner('children',{name:'Trẻ',age:10});const f=(await owner('bootstrap')).body.family;
 assert.equal((await other('bootstrap?familyId='+f.id)).status,403);
 const inv=await owner('caregivers',{email:'care@example.test',name:'Cô giáo',role:'caregiver',childId:ch.body.id,permissions:['location.read'],schedule:{start:'00:00',end:'23:59',days:[0,1,2,3,4,5,6]},expiresAt:Date.now()+86400000});assert.equal(inv.status,201);
 assert.equal((await other('invitations/accept',{token:inv.body.token})).status,200);assert.equal((await other('bootstrap?familyId='+f.id)).status,403);
 await owner('caregivers/'+inv.body.inviteId+'/approve',{});let b=await other('bootstrap?familyId='+f.id);assert.equal(b.status,200);assert.equal(b.body.role,'caregiver');assert.ok(!b.body.records.some(r=>r.kind==='import'||r.kind==='audit'));
 assert.equal((await other('children?familyId='+f.id,{name:'Không được',age:8})).status,403);await owner('caregivers/'+inv.body.inviteId+'/revoke',{});assert.equal((await other('bootstrap?familyId='+f.id)).status,403);
});
test('real pairing, permission-aware lock, time approval once, event idempotency',async()=>{
 const api=createApi(testDatabase()),c=client(api);await account(c);await c('families',{name:'Nhà'});const ch=(await c('children',{name:'Con',age:9})).body;const p=(await c('pairing',{childId:ch.id})).body;
 let r=await api(new Request('http://localhost/api/device/enroll',{method:'POST',body:JSON.stringify({code:p.code,name:'Phone',platform:'Android'})}));assert.equal(r.status,201);const d=await r.json();
 const dev=async(path,body)=>{const res=await api(new Request('http://localhost/api/device/'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+d.token},body:body?JSON.stringify(body):undefined}));return {status:res.status,body:await res.json()};};
 assert.equal((await c('devices/'+d.deviceId+'/commands',{type:'LOCK_SCREEN'})).status,409);
 const req=await dev('time-requests',{minutes:15,reason:'Hoàn thành bài học'});assert.equal(req.status,201);assert.equal((await c('time-requests/'+req.body.id+'/decision',{decision:'approved'})).status,200);assert.equal((await c('time-requests/'+req.body.id+'/decision',{decision:'approved'})).status,409);assert.equal((await dev('policy')).body.allowanceMinutes,15);
 const event={eventId:'u1',kind:'usage',capturedAt:Date.now(),payload:{packageId:'com.school',minutes:8}};await dev('events',{events:[event]});await dev('events',{events:[event]});assert.equal((await c('bootstrap')).body.events.length,1);
 await c('devices/'+d.deviceId+'/revoke',{});assert.equal((await dev('policy')).status,401);
});
