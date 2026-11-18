import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorize, validatePolicy, canUseApp, zonePosition, transitionCommand, analyzeUsage, validateEvent } from '../lib/domain.mjs';

test('tenant isolation, expired grants and caregiver sensitive actions', () => {
  const actor = {userId:'u',familyId:'a',role:'caregiver',childId:'c',permissions:['location.read'],expiresAt:2000};
  assert.equal(authorize(actor,'location.read',{familyId:'b',childId:'c'},1000),false);
  assert.equal(authorize(actor,'location.read',{familyId:'a',childId:'c'},2100),false);
  assert.equal(authorize(actor,'location.read',{familyId:'a',childId:'c'},1000),true);
  assert.equal(authorize(actor,'policy.write',{familyId:'a',childId:'c'},1000),false);
});
test('essential app overrides block; daily and app quota both enforced', () => {
  const p=validatePolicy({dailyLimitMinutes:120,blockedPackages:['game'],essentialPackages:['phone'],appLimits:{video:30},schedules:[],timezone:'Asia/Ho_Chi_Minh'});
  assert.equal(canUseApp(p,'phone',200,0),true);
  assert.equal(canUseApp(p,'game',0,0),false);
  assert.equal(canUseApp(p,'video',50,30),false);
  assert.equal(canUseApp(p,'learn',120,0),false);
  assert.throws(()=>validatePolicy({...p,dailyLimitMinutes:-1}));
});
test('location freshness and accuracy prevent confident false alerts',()=>{
  const z={lat:10,lng:106,radius:200};
  assert.equal(zonePosition({lat:10,lng:106,accuracy:10,capturedAt:1000},z,1100),'inside');
  assert.equal(zonePosition({lat:11,lng:106,accuracy:10,capturedAt:1000},z,1100),'outside');
  assert.equal(zonePosition({lat:10,lng:106,accuracy:150,capturedAt:1000},z,1100),'uncertain');
  assert.equal(zonePosition({lat:10,lng:106,accuracy:10,capturedAt:1000},z,400000),'uncertain');
});
test('command ack is not applied and expired command stays expired',()=>{
  const c={status:'queued',expiresAt:2000};
  assert.equal(transitionCommand(c,'acknowledged',1000),'acknowledged');
  assert.equal(transitionCommand(c,'applied',3000),'expired');
  assert.throws(()=>transitionCommand({...c,status:'failed'},'applied',1000));
});
test('usage baseline abstains on missing evidence and never emits device commands',()=>{
  assert.equal(analyzeUsage([]).observations.length,0);
  const r=analyzeUsage([{id:'e',minutes:150,nightMinutes:45}]);
  assert.equal(r.observations[0].evidenceRefs[0],'e');
  assert.equal(r.commands,undefined);
});
test('telemetry validates location coordinates, time and usage range',()=>{
  assert.throws(()=>validateEvent({eventId:'e',kind:'location',capturedAt:1000,payload:{lat:500,lng:1,accuracy:1}},1000));
  assert.throws(()=>validateEvent({eventId:'e',kind:'usage',capturedAt:1000,payload:{minutes:-5,packageId:'x'}},1000));
  assert.throws(()=>validateEvent({eventId:'e',kind:'usage',capturedAt:9999999,payload:{minutes:5,packageId:'x'}},1000));
});
test('malformed policies cannot reach enforcement clients',()=>{
 const p={dailyLimitMinutes:120,timezone:'Asia/Ho_Chi_Minh',essentialPackages:[],blockedPackages:[],appLimits:{},schedules:[]};
 assert.throws(()=>validatePolicy({...p,timezone:undefined}));assert.throws(()=>validatePolicy({...p,appLimits:[]}));assert.throws(()=>validatePolicy({...p,schedules:[{start:'21:00',end:'07:00',days:[1],allowedPackages:[42]}]}));assert.throws(()=>validatePolicy({...p,restrictedUntil:-1}));
});
test('night usage aggregates incremental segments and approved allowance expires by date',()=>{
 const r=analyzeUsage([{id:'a',minutes:20,nightMinutes:20,localDate:'2026-11-05'},{id:'b',minutes:15,nightMinutes:15,localDate:'2026-11-05'}]);assert.equal(r.observations.length,1);assert.deepEqual(r.observations[0].evidenceRefs,['a','b']);
 const p={...validatePolicy({dailyLimitMinutes:60,timezone:'Asia/Ho_Chi_Minh',essentialPackages:['phone'],blockedPackages:[],appLimits:{},schedules:[]}),allowanceMinutes:15,allowanceDate:'2026-11-05'};
 assert.equal(canUseApp(p,'game',65,65,new Date('2026-11-05T12:00:00Z')),true);assert.equal(canUseApp(p,'game',65,65,new Date('2026-11-06T12:00:00Z')),false);
});
