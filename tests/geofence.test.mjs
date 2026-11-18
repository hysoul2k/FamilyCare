import {test} from 'node:test';import assert from 'node:assert/strict';import {advanceZone} from '../lib/server/geofence.mjs';
test('first point establishes initial position, transition needs two separated points',()=>{
 let s=advanceZone({},'inside',1000);assert.equal(s.transitionAt,undefined);s=advanceZone(s,'outside',2000);assert.equal(s.stable,'inside');s=advanceZone(s,'outside',12000);assert.equal(s.stable,'inside');s=advanceZone(s,'outside',33000);assert.equal(s.stable,'outside');assert.equal(s.transitionAt,33000);
});
test('old uncertain replay cannot reset a newer candidate',()=>{
 const state={stable:'inside',candidate:'outside',candidateAt:30000,lastCapturedAt:30000};const next=advanceZone(state,'uncertain',1000);assert.deepEqual(next,state);
});
