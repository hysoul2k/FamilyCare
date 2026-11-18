import {zonePosition} from '../domain.mjs';
export function advanceZone(state,position,capturedAt){
 if(capturedAt<=(state.lastCapturedAt||0))return state;
 if(position==='uncertain')return {...state,lastCapturedAt:capturedAt,candidate:null,candidateAt:null};
 if(!state.stable)return {stable:position,lastCapturedAt:capturedAt,candidate:null,candidateAt:null};
 if(position===state.stable)return {...state,lastCapturedAt:capturedAt,candidate:null,candidateAt:null};
 if(state.candidate!==position||capturedAt-(state.candidateAt||0)>300000)return {...state,lastCapturedAt:capturedAt,candidate:position,candidateAt:capturedAt};
 if(capturedAt-state.candidateAt<30000)return {...state,lastCapturedAt:capturedAt};
 return {stable:position,lastCapturedAt:capturedAt,candidate:null,candidateAt:null,transitionAt:capturedAt};
}
export async function processLocations(store,familyId,device,points,now){
 const zones=(await store.list(familyId,'zone')).filter(z=>z.data.childId===device.data.childId);
 for(const z of zones){const stateId='zone-state-'+z.id+'-'+device.id;
  const initialInsert=store.recordInsert(familyId,'zone_state',{revision:0},stateId,now);await store.run(initialInsert[0].replace('INSERT INTO','INSERT OR IGNORE INTO'),initialInsert[1]);
  // Claim state and publish corresponding alerts in one atomic batch. Retry competing writers.
  for(let attempt=0;attempt<4;attempt++){
   const initial=await store.record(stateId,familyId);if(!initial)break;let state=initial.data;const alerts=[];
   for(const point of [...points].sort((a,b)=>a.capturedAt-b.capturedAt)){
    const next=advanceZone(state,zonePosition({...point.payload,capturedAt:point.capturedAt},z.data,now),point.capturedAt);
    if(next.transitionAt&&next.transitionAt!==state.transitionAt){const rid='zone-alert-'+z.id+'-'+device.id+'-'+point.eventId;
     alerts.push({id:rid,data:{childId:device.data.childId,deviceId:device.id,zoneId:z.id,type:'geofence',title:next.stable==='outside'?'Con đã rời vùng an toàn':'Con đã vào vùng an toàn',detail:z.data.name,evidenceRefs:[point.eventId],read:false,status:'open',capturedAt:point.capturedAt}});
    }state=next;
   }
   const marker=crypto.randomUUID(),revision=(initial.data.revision||0)+1;state={...state,revision,writeMarker:marker};
   const statements=[["UPDATE records SET data=? WHERE id=? AND family_id=? AND coalesce(json_extract(data,'$.revision'),0)=?",[JSON.stringify(state),stateId,familyId,initial.data.revision||0]],
    ...alerts.map(a=>["INSERT OR IGNORE INTO records(id,family_id,kind,data,created_at) SELECT ?,?,'alert',?,? WHERE EXISTS(SELECT 1 FROM records WHERE id=? AND family_id=? AND json_extract(data,'$.writeMarker')=?)",[a.id,familyId,JSON.stringify(a.data),now,stateId,familyId,marker]])];
   if((await store.batch(statements))[0].meta.changes)break;
  }
 }
}
