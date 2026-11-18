export function enrollmentStatements({hash,now,deviceId,tokenHash,data}){
 return [
 ["INSERT INTO records(id,family_id,kind,data,created_at) SELECT ?,family_id,'device',?,? FROM pairings WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?",[deviceId,JSON.stringify(data),now,hash,now]],
 ["INSERT INTO credentials(token_hash,device_id,family_id) SELECT ?,id,family_id FROM records WHERE id=?",[tokenHash,deviceId]],
 ["UPDATE pairings SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL AND EXISTS(SELECT 1 FROM records WHERE id=?)",[now,hash,deviceId]]
 ];
}
export function policyStatements({familyId,deviceId,before,policy,marker,commandId,now,actor}){
 const guard="EXISTS(SELECT 1 FROM records WHERE id=? AND family_id=? AND json_extract(data,'$.policyChangeId')=?)";
 return [
 ["UPDATE records SET data=json_set(data,'$.policy',json(?),'$.policyChangeId',?) WHERE id=? AND family_id=? AND json_extract(data,'$.policy.version')=?",[JSON.stringify(policy),marker,deviceId,familyId,JSON.parse(before).policy.version]],
 [`INSERT INTO records(id,family_id,kind,data,created_at) SELECT ?,?,'command',?,? WHERE ${guard}`,[commandId,familyId,JSON.stringify({deviceId,childId:JSON.parse(before).childId,type:'SYNC_POLICY',policyVersion:policy.version,status:'queued',expiresAt:now+86400000}),now,deviceId,familyId,marker]],
 [`INSERT INTO records(id,family_id,kind,data,created_at) SELECT ?,?,'audit',?,? WHERE ${guard}`,[commandId+'-audit',familyId,JSON.stringify({action:'policy.update',resourceId:deviceId,actor}),now,deviceId,familyId,marker]]
 ];
}
