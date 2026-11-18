import {z} from 'zod';
import {digest} from './auth.mjs';

export async function requestRemoval({store,device,body,now,err,response}){
 const value=z.object({clientRequestId:z.string().uuid(),reason:z.string().trim().min(1).max(500)}).parse(body);
 const id=digest(device.id+':removal:'+value.clientRequestId),familyId=device.familyId;
 const existing=await store.record(id,familyId);if(existing)return response({id:existing.id,...existing.data});
 const data={childId:device.data.childId,deviceId:device.id,reason:value.reason,status:'pending',expiresAt:now+86400000};
 const result=await store.run("INSERT INTO records(id,family_id,kind,data,created_at) SELECT ?,?,'removal_request',?,? WHERE NOT EXISTS(SELECT 1 FROM records WHERE family_id=? AND kind='removal_request' AND json_extract(data,'$.deviceId')=? AND json_extract(data,'$.status') IN ('pending','approved') AND json_extract(data,'$.expiresAt')>?)",[id,familyId,JSON.stringify(data),now,familyId,device.id,now]);
 if(!result.meta.changes)err('Đã có yêu cầu gỡ đang chờ xử lý.',409);
 return response({id,...data},201);
}

export async function decideRemoval({store,request,body,actorId,now,err,response}){
 const decision=z.enum(['approved','rejected']).parse(body.decision),familyId=request.familyId;
 if(request.data.status!=='pending'||request.data.expiresAt<=now)err('Yêu cầu đã được xử lý hoặc hết hạn.',409);
 const device=await store.record(request.data.deviceId,familyId);
 if(!device||device.data.status==='revoked')err('Thiết bị không còn hoạt động.',409);
 if(decision==='approved'&&(device.data.capabilities?.uninstall_protection!=='supported'||device.data.uninstallProtection!=='enabled'))err('Thiết bị chưa xác nhận cơ chế chống gỡ. Không thể cấp lệnh gỡ qua hệ điều hành.',409);
 const marker=crypto.randomUUID(),expiresAt=decision==='approved'?now+600000:request.data.expiresAt;
 const data={...request.data,status:decision,decidedBy:actorId,decidedAt:now,expiresAt,decisionMarker:marker};
 const statements=[["UPDATE records SET data=? WHERE id=? AND family_id=? AND json_extract(data,'$.status')='pending' AND json_extract(data,'$.expiresAt')>?",[JSON.stringify(data),request.id,familyId,now]]];
 const guard="EXISTS(SELECT 1 FROM records WHERE id=? AND family_id=? AND json_extract(data,'$.decisionMarker')=?)";
 const commandId=crypto.randomUUID();
 if(decision==='approved')statements.push([`INSERT INTO records(id,family_id,kind,data,created_at) SELECT ?,?,'command',?,? WHERE ${guard}`,[commandId,familyId,JSON.stringify({childId:request.data.childId,deviceId:device.id,type:'ALLOW_REMOVAL',requestId:request.id,status:'queued',expiresAt}),now,request.id,familyId,marker]]);
 statements.push([`INSERT INTO records(id,family_id,kind,data,created_at) SELECT ?,?,'audit',?,? WHERE ${guard}`,[crypto.randomUUID(),familyId,JSON.stringify({action:'device.removal.'+decision,resourceId:request.id,actor:actorId}),now,request.id,familyId,marker]]);
 const result=await store.batch(statements);if(!result[0].meta.changes)err('Yêu cầu đã thay đổi. Hãy tải lại.',409);
 return response({ok:true,decision,...(decision==='approved'?{commandId,expiresAt}:{}),message:decision==='approved'?'Đã duyệt; chờ thiết bị xác nhận tắt bảo vệ chống gỡ.':'Đã từ chối yêu cầu.'});
}

export async function completeRemoval({store,device,command,status,tokenHash,errorCode,now,err,response}){
 if(status==='applied'&&device.data.capabilities?.uninstall_protection!=='supported')err('Thiết bị chưa hỗ trợ cơ chế này.',409);
 const marker=crypto.randomUUID(),familyId=device.familyId;
 const data={...command.data,status,resultAt:now,resultMarker:marker,errorCode:typeof errorCode==='string'?errorCode.slice(0,180):null};
 const resultGuard="EXISTS(SELECT 1 FROM records WHERE id=? AND family_id=? AND json_extract(data,'$.resultMarker')=?)";
 const request=await store.record(command.data.requestId,familyId);
 if(!request||request.data.deviceId!==device.id||request.data.status!=='approved')err('Không có phê duyệt gỡ hợp lệ.',409);
 const statements=[["UPDATE records SET data=? WHERE id=? AND family_id=? AND json_extract(data,'$.status')=? AND EXISTS(SELECT 1 FROM credentials WHERE token_hash=? AND revoked_at IS NULL)",[JSON.stringify(data),command.id,familyId,command.data.status,tokenHash]]];
 if(status==='applied'){
  statements.push([`UPDATE records SET data=? WHERE id=? AND family_id=? AND ${resultGuard}`,[JSON.stringify({...request.data,status:'released',releasedAt:now}),request.id,familyId,command.id,familyId,marker]]);
  statements.push([`UPDATE records SET data=? WHERE id=? AND family_id=? AND ${resultGuard}`,[JSON.stringify({...device.data,status:'revoked',uninstallProtection:'disabled',managementReleasedAt:now}),device.id,familyId,command.id,familyId,marker]]);
  statements.push([`UPDATE credentials SET revoked_at=? WHERE device_id=? AND family_id=? AND ${resultGuard}`,[now,device.id,familyId,command.id,familyId,marker]]);
 }else if(['failed','expired'].includes(status)){
  statements.push([`UPDATE records SET data=? WHERE id=? AND family_id=? AND ${resultGuard}`,[JSON.stringify({...request.data,status,errorCode:data.errorCode}),request.id,familyId,command.id,familyId,marker]]);
 }
 const result=await store.batch(statements);if(!result[0].meta.changes)err('Lệnh đã thay đổi hoặc thiết bị bị thu hồi.',409);
 return response({status,credentialRevoked:status==='applied'});
}
