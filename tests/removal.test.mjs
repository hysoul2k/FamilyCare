import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../lib/server/service.mjs';
import {testDatabase} from './helpers/d1.mjs';
import {Store} from '../lib/server/store.mjs';

function client(api){let cookie='';return async(path,body,method=body?'POST':'GET',token)=>{
 const r=await api(new Request('http://localhost/api/'+path,{method,headers:{origin:'http://localhost',cookie,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined}));
 if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};
};}
async function setup(){const db=testDatabase(),api=createApi(db,{dataKey:'ab'.repeat(32)}),owner=client(api);
 await owner('auth/register',{name:'Parent',email:'removal-parent@example.test',password:'Removal-test-password-123'});
 await owner('families',{name:'Removal test family'});
 const child=(await owner('children',{name:'Child',age:10})).body;
 const pair=(await owner('pairing',{childId:child.id})).body;
 const enrolled=await owner('device/enroll',{code:pair.code,name:'Test phone',platform:'Android'});
 const device=enrolled.body;
 const dev=(path,body)=>owner('device/'+path,body,body?'POST':'GET',device.token);
 return {db,api,owner,child,device,dev};
}

test('removal request approval queues OS release; only device completion revokes credential',async()=>{
 const {owner,dev,device}=await setup();
 assert.equal((await dev('heartbeat',{capabilities:{uninstall_protection:'supported'},uninstallProtection:'enabled'})).status,200);
 const body={clientRequestId:crypto.randomUUID(),reason:'Change phone with parent'};
 const requested=await dev('removal-requests',body);assert.equal(requested.status,201);
 assert.equal((await dev('removal-requests',body)).body.id,requested.body.id);
 assert.equal((await dev('removal-requests',{...body,clientRequestId:crypto.randomUUID()})).status,409);
 const before=(await owner('bootstrap')).body;
 assert.equal(before.records.find(r=>r.id===device.deviceId).data.uninstallProtection,'enabled');
 assert.equal(before.records.filter(r=>r.kind==='removal_request').length,1);
 const approved=await owner('removal-requests/'+requested.body.id+'/decision',{decision:'approved'});assert.equal(approved.status,200);
 assert.equal((await owner('removal-requests/'+requested.body.id+'/decision',{decision:'approved'})).status,409);
 assert.equal((await dev('policy')).status,200);
 const commands=(await dev('commands')).body,command=commands.find(c=>c.data.type==='ALLOW_REMOVAL');assert.ok(command);
 assert.equal((await dev('commands/'+command.id+'/results',{status:'applied'})).status,409);
 assert.equal((await dev('commands/'+command.id+'/results',{status:'acknowledged'})).status,200);
 assert.equal((await dev('commands/'+command.id+'/results',{status:'applied'})).status,200);
 assert.equal((await dev('policy')).status,401);
 const after=(await owner('bootstrap')).body;
 assert.equal(after.records.find(r=>r.id===requested.body.id).data.status,'released');
 assert.equal(after.records.find(r=>r.id===device.deviceId).data.status,'revoked');
});

test('uninstall approval is owner-only, capability checked; rejection and failed/expired commands keep credential',async()=>{
 const {api,owner,child,device,dev,db}=await setup();
 const requested=(await dev('removal-requests',{clientRequestId:crypto.randomUUID(),reason:'Ask parent'})).body;
 assert.equal((await owner('removal-requests/'+requested.id+'/decision',{decision:'approved'})).status,409);
 const caregiver=client(api);await caregiver('auth/register',{name:'Carer',email:'removal-carer@example.test',password:'Removal-test-password-123'});
 const invite=await owner('caregivers',{email:'removal-carer@example.test',name:'Carer',role:'caregiver',childId:child.id,permissions:['device.read'],schedule:{start:'00:00',end:'00:00',days:[0,1,2,3,4,5,6]},expiresAt:Date.now()+86400000});
 await caregiver('invitations/accept',{token:invite.body.token});await owner('caregivers/'+invite.body.inviteId+'/approve',{});
 assert.equal((await caregiver('removal-requests/'+requested.id+'/decision',{decision:'rejected'})).status,403);
 assert.equal((await owner('removal-requests/'+requested.id+'/decision',{decision:'rejected'})).status,200);
 assert.equal((await dev('policy')).status,200);
 const again=(await dev('removal-requests',{clientRequestId:crypto.randomUUID(),reason:'Try later'})).body;
 const store=new Store(db),row=await store.record(again.id,(await owner('bootstrap')).body.family.id);
 await store.patch(row.id,row.familyId,{expiresAt:Date.now()-1});
 assert.equal((await owner('removal-requests/'+again.id+'/decision',{decision:'approved'})).status,409);
 await dev('heartbeat',{capabilities:{uninstall_protection:'supported'},uninstallProtection:'enabled'});
 const last=(await dev('removal-requests',{clientRequestId:crypto.randomUUID(),reason:'Try with permission'})).body;
 await owner('removal-requests/'+last.id+'/decision',{decision:'approved'});
 const command=(await dev('commands')).body.find(c=>c.data.type==='ALLOW_REMOVAL');
 assert.equal((await dev('commands/'+command.id+'/results',{status:'failed',errorCode:'OS_DENIED'})).status,200);
 assert.equal((await dev('policy')).status,200);
 const view=(await owner('bootstrap')).body;
 assert.equal(view.records.find(r=>r.id===device.deviceId).data.uninstallProtection,'enabled');
});

test('an expired removal command cannot revoke the device credential',async()=>{
 const {db,owner,dev}=await setup();
 await dev('heartbeat',{capabilities:{uninstall_protection:'supported'},uninstallProtection:'enabled'});
 const request=(await dev('removal-requests',{clientRequestId:crypto.randomUUID(),reason:'Expiry test'})).body;
 const approved=await owner('removal-requests/'+request.id+'/decision',{decision:'approved'});
 const family=(await owner('bootstrap')).body.family;
 await new Store(db).patch(approved.body.commandId,family.id,{expiresAt:Date.now()-1});
 const result=await dev('commands/'+approved.body.commandId+'/results',{status:'applied'});
 assert.equal(result.status,200);assert.equal(result.body.status,'expired');assert.equal(result.body.credentialRevoked,false);
 assert.equal((await dev('policy')).status,200);
});
