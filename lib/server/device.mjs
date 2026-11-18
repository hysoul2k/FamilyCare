import {z} from 'zod';import {digest,secret} from './auth.mjs';import {enrollmentStatements} from '../transactions.mjs';import {validateEvent,transitionCommand} from '../domain.mjs';import {processLocations} from './geofence.mjs';
const uuid=()=>crypto.randomUUID();
import {requestRemoval,completeRemoval} from './removal.mjs';
export async function handleDevice({store,req,path,body,now,err,response,secure}){
 if(path==='device/enroll'&&req.method==='POST'){
  const v=z.object({code:z.string().min(20).max(200),name:z.string().trim().min(1).max(100),platform:z.enum(['Android','Web/iOS','iOS']).default('Android')}).parse(body),hash=digest(v.code);
  const pairing=await store.first('SELECT * FROM pairings WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?',[hash,now]);if(!pairing)err('Mã ghép không hợp lệ, đã dùng hoặc hết hạn.',409);
  const deviceId=uuid(),token=secret(),policy={version:1,dailyLimitMinutes:120,timezone:'Asia/Ho_Chi_Minh',essentialPackages:['com.android.dialer'],blockedPackages:[],appLimits:{},schedules:[],allowanceMinutes:0,allowanceDate:null,restrictedUntil:0};
  const data={name:v.name,platform:v.platform,childId:pairing.child_id,capabilities:{},lastSeen:now,policy,appliedPolicyVersion:0};
  const result=await store.batch(enrollmentStatements({hash,now,deviceId,tokenHash:digest(token),data}));if(!result[0].meta.changes)err('Mã đã được sử dụng.',409);return response({deviceId,token,policy,serverTime:now},201);
 }
 const rawToken=req.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64,128})$/)?.[1];if(!rawToken)err('Thiếu credential thiết bị.',401);
 const credential=await store.first('SELECT * FROM credentials WHERE token_hash=? AND revoked_at IS NULL',[digest(rawToken)]);if(!credential)err('Thiết bị đã bị thu hồi hoặc credential không hợp lệ.',401);
 const d=await store.record(credential.device_id,credential.family_id);if(!d||d.data.status==='revoked')err('Thiết bị không còn hoạt động.',401);const fid=d.familyId;
 if(path==='device/unpair'&&req.method==='POST'){
  await store.batch([['UPDATE credentials SET revoked_at=? WHERE device_id=?',[now,d.id]],["UPDATE records SET data=json_set(data,'$.status','revoked') WHERE id=? AND family_id=?",[d.id,fid]]]);return response({ok:true,revoked:true});
 }
 if(path==='device/policy'&&req.method==='GET')return response({...d.data.policy,serverTime:now});
 if(path==='device/heartbeat'&&req.method==='POST'){
  const v=z.object({capabilities:z.record(z.enum(['supported','permission_required','enrollment_required','unsupported','temporarily_unavailable'])),battery:z.number().min(0).max(100).optional(),installedApps:z.array(z.object({packageId:z.string().min(1).max(200),name:z.string().max(200)})).max(1000).optional(),appliedPolicyVersion:z.number().int().min(0).max(d.data.policy.version).optional(),policyError:z.string().max(200).nullable().optional()}).parse(body);
  const protection=z.enum(['enabled','disabled','unsupported','permission_required','unknown']).optional().parse(body.uninstallProtection);
  const values={lastSeen:now,...v,...(protection?{uninstallProtection:protection}:{})};await store.patch(d.id,fid,values);return response({ok:true,serverTime:now});
 }
 if(path==='device/commands'&&req.method==='GET')return response((await store.list(fid,'command')).filter(r=>r.data.deviceId===d.id&&['queued','sent','acknowledged'].includes(r.data.status)&&r.data.expiresAt>now));
 if(/^device\/commands\/[^/]+\/results$/.test(path)&&req.method==='POST'){
  const r=await store.record(path.split('/')[2],fid);if(!r||r.kind!=='command'||r.data.deviceId!==d.id)err('Không tìm thấy lệnh.',404);
  const next=z.enum(['acknowledged','applied','failed']).parse(body.status);let status;try{status=transitionCommand(r.data,next,now);}catch(e){err(e.message,409);}
  if(next==='applied'&&r.data.type==='LOCK_SCREEN'&&d.data.capabilities?.lock!=='supported')err('Thiết bị chưa có khả năng thực thi lệnh này.',409);
  if(r.data.type==='ALLOW_REMOVAL')return completeRemoval({store,device:d,command:r,status,tokenHash:digest(rawToken),errorCode:body.errorCode,now,err,response});
  const result=await store.run("UPDATE records SET data=json_set(data,'$.status',?,'$.resultAt',?,'$.errorCode',?) WHERE id=? AND family_id=? AND json_extract(data,'$.status')=? AND EXISTS(SELECT 1 FROM credentials WHERE token_hash=? AND revoked_at IS NULL)",[status,now,typeof body.errorCode==='string'?body.errorCode.slice(0,100):null,r.id,fid,r.data.status,digest(rawToken)]);if(!result.meta.changes)err('Lệnh đã thay đổi hoặc credential bị thu hồi.',409);
  return response({status});
 }
 if(path==='device/events'&&req.method==='POST'){
  const batch=z.array(z.any()).min(1).max(100).parse(body.events);for(const e of batch)try{validateEvent(e,now);}catch(error){err(error.message);}
  const result=await store.batch(batch.map(e=>['INSERT OR IGNORE INTO events(id,device_id,family_id,event_id,kind,captured_at,payload) VALUES(?,?,?,?,?,?,?)',[uuid(),d.id,fid,e.eventId,e.kind,e.capturedAt,JSON.stringify(['call','location'].includes(e.kind)?{privatePayload:secure.seal(e.payload)}:e.payload)]]));
  if(batch.some(e=>e.kind==='location')){
   const retained=await store.all("SELECT * FROM events WHERE family_id=? AND device_id=? AND kind='location' AND captured_at>? ORDER BY captured_at ASC LIMIT 1000",[fid,d.id,now-600000]);
   await processLocations(store,fid,d,retained.map(e=>({eventId:e.event_id,capturedAt:e.captured_at,payload:JSON.parse(e.payload).privatePayload?secure.open(JSON.parse(e.payload).privatePayload):JSON.parse(e.payload)})),now);
  }
  return response({accepted:batch.map(e=>e.eventId),inserted:result.reduce((s,r)=>s+(r.meta.changes||0),0)});
 }
 if(path==='device/removal-requests'&&req.method==='GET')return response((await store.list(fid,'removal_request')).filter(r=>r.data.deviceId===d.id).slice(0,20));
 if(path==='device/removal-requests'&&req.method==='POST')return requestRemoval({store,device:d,body,now,err,response});
 if(path==='device/time-requests'&&req.method==='GET')return response((await store.list(fid,'time_request')).filter(r=>r.data.deviceId===d.id).slice(0,20));
 if(path==='device/time-requests'&&req.method==='POST'){
  const v=z.object({minutes:z.union([z.literal(5),z.literal(15),z.literal(30)]),reason:z.string().trim().min(1).max(500),clientRequestId:z.string().uuid().optional()}).parse(body);
  const pending=(await store.list(fid,'time_request')).filter(r=>r.data.deviceId===d.id&&r.data.status==='pending'&&r.data.expiresAt>now);if(pending.length>=3)err('Con đã có 3 yêu cầu đang chờ. Hãy đợi phụ huynh trả lời.',429);
  const id=v.clientRequestId?digest(d.id+v.clientRequestId):uuid(),existing=await store.record(id,fid);if(existing)return response({id:existing.id,...existing.data});
  const data={childId:d.data.childId,deviceId:d.id,minutes:v.minutes,reason:v.reason,status:'pending',expiresAt:now+1800000};await store.insert(fid,'time_request',data,id);return response({id,...data},201);
 }
 if(path==='device/sos'&&req.method==='POST'){
  const message=z.string().max(500).default('Con cần người lớn hỗ trợ.').parse(body.message);const recent=await store.first("SELECT id FROM records WHERE family_id=? AND kind='alert' AND json_extract(data,'$.deviceId')=? AND json_extract(data,'$.type')='sos' AND created_at>?",[fid,d.id,now-30000]);if(recent)return response({id:recent.id,status:'already_received'});
  const r=await store.insert(fid,'alert',{childId:d.data.childId,deviceId:d.id,type:'sos',title:'Con cần hỗ trợ',detail:message,status:'open',read:false});return response({id:r.id,status:'received_by_server'},201);
 }
 if(path==='device/release'&&req.method==='GET'){
  return response({revoked:false});
 }
 err('Không tìm thấy chức năng thiết bị.',404);
}
