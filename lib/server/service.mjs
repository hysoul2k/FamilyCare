import {z} from 'zod';
import {Store} from './store.mjs';
import {vault} from './vault.mjs';
import {digest,secret,hashPassword,checkPassword,sessionCookie,readSession} from './auth.mjs';
import {permitted,activeGrant,OWNER_PERMISSIONS,projectRecords,publicRecord} from './access.mjs';
import {maintenance} from './maintenance.mjs';
import {viewTelemetry} from './telemetry.mjs';
import {handleDevice} from './device.mjs';
import {decideRemoval} from './removal.mjs';
import {validatePolicy,analyzeUsage} from '../domain.mjs';
import {policyStatements} from '../transactions.mjs';
import {parseImport,analyzeContent,trainClassifier,classifyMessages,evaluateClassifier} from '../analysis.mjs';

const uuid=()=>crypto.randomUUID();
const name=z.string().trim().min(1).max(100),email=z.string().trim().email().max(254).transform(v=>v.toLowerCase());
const err=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const response=(data,status=200,extra={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const obj=row=>row?JSON.parse(row.data):null;
export function createApi(db,options={}){
 const secure=vault(options.dataKey);
 const store=new Store(db);
 return async function(req){const requestId=uuid();try{return await handle(req);}catch(e){const status=e instanceof z.ZodError?400:e.status||500;return response({message:status>=500?'Dịch vụ tạm thời không sẵn sàng.':e instanceof z.ZodError?'Dữ liệu nhập không hợp lệ.':e.message,requestId},status);}}
 async function handle(req){
  const url=new URL(req.url),path=url.pathname.replace(/^\/api\//,''),now=Date.now();
  if(req.method!=='GET'&&((req.headers.get('origin')&&req.headers.get('origin')!==url.origin)||req.headers.get('sec-fetch-site')==='cross-site'))err('Nguồn yêu cầu không hợp lệ.',403);
  let body={};if(!['GET','HEAD'].includes(req.method)){
   const reader=req.body?.getReader();let count=0,chunks=[];if(reader){for(;;){const {value,done}=await reader.read();if(done)break;count+=value.byteLength;if(count>524288){await reader.cancel();err('Dữ liệu vượt giới hạn 512 KB.',413);}chunks.push(value);}}
   try{body=count?JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))):{};}catch{err('Nội dung JSON không hợp lệ.');}
  }
  const ctx={store,req,url,path,body,now,err,response,secure};
  if(path==='health'){await store.first('SELECT value FROM service_state LIMIT 1');return response({ok:true,mode:'real-data',database:db.provider||'SQLite/D1'});}
  if(path.startsWith('device/'))return handleDevice(ctx);
  if(path.startsWith('auth/'))return auth(ctx);
  const token=readSession(req),session=token?await store.first('SELECT a.id,a.email,a.display_name FROM sessions s JOIN accounts a ON a.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',[digest(token),now]):null;
  if(!session)err('Hãy đăng nhập để quản lý gia đình.',401);
  const user={userId:session.id,email:session.email,displayName:session.display_name};
  const owned=await store.all('SELECT * FROM families WHERE owner_id=?',[user.userId]);
  const rawGrants=await store.all("SELECT * FROM records WHERE kind='invitation' AND json_extract(data,'$.recipientUserId')=? AND json_extract(data,'$.status')='active'",[user.userId]);
  const allGrants=rawGrants.map(r=>store.row(r)).filter(r=>activeGrant(r,user.userId,now));
  const familyIds=[...new Set([...owned.map(f=>f.id),...allGrants.map(g=>g.familyId)])];
  const familyList=[];for(const id of familyIds){const f=await store.first('SELECT * FROM families WHERE id=?',[id]);if(f)familyList.push({id:f.id,name:f.name,ownerId:f.owner_id});}
  const selected=url.searchParams.get('familyId')||owned[0]?.id||familyIds[0];
  if(selected&&!familyIds.includes(selected))err('Bạn không có quyền truy cập gia đình này hoặc đã ngoài ca chăm sóc.',403);
  const rawFamily=selected?await store.first('SELECT * FROM families WHERE id=?',[selected]):null;
  const family=rawFamily?{id:rawFamily.id,name:rawFamily.name,ownerId:rawFamily.owner_id}:null;
  const grants=allGrants.filter(g=>g.familyId===selected),role=rawFamily?.owner_id===user.userId?'owner':grants.some(g=>g.data.role==='parent')?'parent':'caregiver';
  const actor={userId:user.userId,familyId:selected,role,grants};
  const requirePermission=(action,childId)=>{if(!family||!permitted(actor,action,childId))err('Bạn không có quyền thực hiện thao tác này.',403);};
  const owner=()=>{if(role!=='owner'||!family)err('Chỉ chủ gia đình được thực hiện thao tác này.',403);};
  const find=async(id,kind)=>{const r=await store.record(z.string().max(150).parse(id),selected);if(!r||(kind&&r.kind!==kind))err('Không tìm thấy dữ liệu.',404);return r;};
  const audit=(action,resourceId)=>store.recordInsert(selected,'audit',{action,resourceId,actor:user.displayName},uuid(),now);

  if(path==='invitations/accept'&&req.method==='POST'){
   const token=z.string().min(32).max(200).parse(body.token),hash=digest(token);
   const row=await store.first("SELECT * FROM records WHERE kind='invitation' AND json_extract(data,'$.tokenHash')=?",[hash]);const invite=store.row(row);
   if(!invite||invite.data.expiresAt<=now||invite.data.status!=='pending'||invite.data.email!==user.email)err('Lời mời không hợp lệ, hết hạn hoặc không dành cho tài khoản này.',409);
   if(!await store.update(invite,{...invite.data,status:'requested',recipientUserId:user.userId,requestedAt:now}))err('Lời mời đã thay đổi.',409);
   return response({ok:true,message:'Đã gửi yêu cầu tham gia. Chủ gia đình cần duyệt trước khi chia sẻ dữ liệu.'});
  }
  if(path==='bootstrap'&&req.method==='GET'){
   await maintenance(db,now);
   if(!family)return response({user,family:null,role:'owner',permissions:OWNER_PERMISSIONS,families:familyList,records:[],events:[]});
   const rows=(await store.list(selected)).filter(r=>!r.data.expiresAt||r.kind==='command'||r.kind==='time_request'||r.data.expiresAt>now);const devices=rows.filter(r=>r.kind==='device');
   const projected=projectRecords(rows,actor);const visibleDevices=projected.filter(r=>r.kind==='device');
   const requestedId=url.searchParams.get('deviceId'),selectedDevice=requestedId?devices.find(d=>d.id===requestedId):devices.find(d=>visibleDevices.some(v=>v.id===d.id)&&d.data.status!=='revoked');
   if(requestedId&&(!selectedDevice||!visibleDevices.some(d=>d.id===requestedId)))err('Kh?ng c? quy?n xem thi?t b? n?y.',403);
   const timezone=selectedDevice?.data.policy?.timezone||'Asia/Ho_Chi_Minh',date=url.searchParams.get('date')||new Intl.DateTimeFormat('en-CA',{timeZone:timezone}).format(now);
   let telemetry={events:[],view:{deviceId:null,date}};if(selectedDevice)try{telemetry=await viewTelemetry(store,{familyId:selected,deviceId:selectedDevice.id,date,timezone,allowed:action=>permitted(actor,action,selectedDevice.data.childId),decode:decodeEvent});}catch(e){err(e.message);}
   return response({user,family,role,permissions:role==='owner'?OWNER_PERMISSIONS:[...new Set(grants.flatMap(g=>g.data.permissions))],families:familyList,records:projected.map(r=>present(r,rows)),...telemetry});
  }
  if(path==='families'&&req.method==='POST'){
   if(owned.length)err('Tài khoản đã sở hữu một gia đình.',409);const id=uuid();await store.run('INSERT INTO families(id,owner_id,name,created_at) VALUES(?,?,?,?)',[id,user.userId,name.parse(body.name),now]);return response({id,name:body.name,ownerId:user.userId},201);
  }
  if(!family)err('Hãy tạo hoặc tham gia gia đình trước.',409);
  if(path==='children'&&req.method==='POST'){
   owner();const v=z.object({name,age:z.number().int().min(0).max(17)}).parse(body),id=uuid();await store.batch([store.recordInsert(selected,'child',{...v,color:'mint'},id,now),audit('child.create',id)]);return response({id,...v},201);
  }
  if(path==='pairing'&&req.method==='POST'){
   const child=await find(body.childId,'child');requirePermission('device.enroll',child.id);const code=secret();await store.run('INSERT INTO pairings(token_hash,family_id,child_id,expires_at) VALUES(?,?,?,?)',[digest(code),selected,child.id,now+600000]);return response({code,expiresAt:now+600000},201);
  }
  if(/^devices\/[^/]+\/policy$/.test(path)&&req.method==='PUT'){
   const device=await find(path.split('/')[1],'device');requirePermission('policy.write',device.data.childId);if(device.data.status==='revoked')err('Thiết bị đã bị thu hồi.',409);
   if(body.expectedVersion!==device.data.policy.version)err('Chính sách đã thay đổi. Hãy tải lại.',409);
   let policy;try{policy=validatePolicy(body.policy);}catch(e){err(e.message);}policy={...policy,version:device.data.policy.version+1};
   if(policy.restrictedUntil!=null&&(!Number.isFinite(policy.restrictedUntil)||policy.restrictedUntil>now+7*86400000))err('Thời hạn hạn chế không hợp lệ.');
   // Bonus is server-owned; policy edits cannot manufacture an approved allowance.
   policy.allowanceMinutes=device.data.policy.allowanceMinutes||0;policy.allowanceDate=device.data.policy.allowanceDate||null;
   const commandId=uuid(),result=await store.batch(policyStatements({familyId:selected,deviceId:device.id,before:JSON.stringify(device.data),policy,marker:uuid(),commandId,now,actor:user.displayName}));
   if(!result[0].meta.changes)err('Chính sách đã thay đổi đồng thời.',409);return response({policy,commandId});
  }
  if(/^devices\/[^/]+\/commands$/.test(path)&&req.method==='POST'){
   const device=await find(path.split('/')[1],'device'),type=z.enum(['LOCK_SCREEN','REFRESH_LOCATION']).parse(body.type);requirePermission(type==='LOCK_SCREEN'?'command.lock':'location.refresh',device.data.childId);
   if(device.data.status==='revoked'||device.data.capabilities?.[type==='LOCK_SCREEN'?'lock':'location']!=='supported')err('Thiết bị chưa hỗ trợ hoặc chưa cấp quyền chức năng này.',409);
   const key=z.string().uuid().parse(req.headers.get('idempotency-key')),id=digest(selected+device.id+key),old=await store.record(id,selected);if(old){if(old.data.type!==type)err('Khóa yêu cầu đã dùng cho nội dung khác.',409);return response(old);}
   const data={deviceId:device.id,childId:device.data.childId,type,status:'queued',expiresAt:now+300000};await store.batch([store.recordInsert(selected,'command',data,id,now),audit('command.create',id)]);return response({id,...data},201);
  }
  if(/^devices\/[^/]+\/revoke$/.test(path)&&req.method==='POST'){
   const d=await find(path.split('/')[1],'device');requirePermission('device.revoke',d.data.childId);await store.batch([
    ['UPDATE credentials SET revoked_at=? WHERE device_id=?',[now,d.id]],
    ["UPDATE records SET data=json_set(data,'$.status','revoked') WHERE id=? AND family_id=?",[d.id,selected]],
    ["UPDATE records SET data=json_set(data,'$.status','canceled') WHERE family_id=? AND kind='command' AND json_extract(data,'$.deviceId')=? AND json_extract(data,'$.status') IN ('queued','sent')",[selected,d.id]],audit('device.revoke',d.id)]);return response({ok:true});
  }
  if(path==='zones'&&req.method==='POST'){
   const v=z.object({childId:z.string(),name,lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180),radius:z.number().min(100).max(50000)}).parse(body);await find(v.childId,'child');requirePermission('zone.write',v.childId);const r=await store.insert(selected,'zone',v);await store.run(...audit('zone.create',r.id));return response({id:r.id,...v},201);
  }
  if(path==='caregivers'&&req.method==='POST'){
   owner();const v=z.object({email,name,role:z.enum(['parent','caregiver']),childId:z.string(),permissions:z.array(z.enum(OWNER_PERMISSIONS)).max(25),schedule:z.object({start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),end:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),days:z.array(z.number().int().min(0).max(6)).min(1)}),expiresAt:z.number().min(now+60000).max(now+366*86400000)}).parse(body);await find(v.childId,'child');
   if(v.role==='caregiver'&&v.permissions.some(p=>!['child.read','device.read','location.read','usage.read','alerts.read','alerts.resolve'].includes(p)))err('Giáo viên/bảo mẫu chỉ được cấp quyền chăm sóc cơ bản.');
   if(v.permissions.some(p=>['caregiver.manage','audit.read','data.export'].includes(p)))err('Quyền quản trị gia đình không được chuyển qua lời mời.');
   const token=secret(),r=await store.insert(selected,'invitation',{...v,status:'pending',tokenHash:digest(token)});await store.run(...audit('caregiver.invite',r.id));return response({inviteId:r.id,token,acceptUrl:url.origin+'/?invite='+token},201);
  }
  if(/^caregivers\/[^/]+\/(approve|revoke)$/.test(path)&&req.method==='POST'){
   owner();const r=await find(path.split('/')[1],'invitation'),approve=path.endsWith('/approve');if(approve&&(r.data.status!=='requested'||r.data.expiresAt<=now))err('Lời mời chưa được nhận hoặc đã hết hạn.',409);
   if(!await store.update(r,{...r.data,status:approve?'active':'revoked',updatedAt:now}))err('Lời mời đã thay đổi.',409);await store.run(...audit(approve?'caregiver.approve':'caregiver.revoke',r.id));return response({ok:true});
  }
  if(/^removal-requests\/[^/]+\/decision$/.test(path)&&req.method==='POST'){
   owner();const request=await find(path.split('/')[1],'removal_request');return decideRemoval({store,request,body,actorId:user.userId,now,err,response});
  }
  if(/^time-requests\/[^/]+\/decision$/.test(path)&&req.method==='POST'){
   const r=await find(path.split('/')[1],'time_request');requirePermission('policy.approve',r.data.childId);if(r.data.status!=='pending'||r.data.expiresAt<=now)err('Yêu cầu đã được xử lý hoặc hết hạn.',409);
   const decision=z.enum(['approved','rejected']).parse(body.decision),d=await find(r.data.deviceId,'device');if(d.data.status==='revoked')err('Thiết bị đã bị thu hồi.',409);
   const marker=uuid(),date=new Intl.DateTimeFormat('en-CA',{timeZone:d.data.policy.timezone}).format(now),p={...d.data.policy};if(decision==='approved'){p.allowanceMinutes=(p.allowanceDate===date?p.allowanceMinutes||0:0)+r.data.minutes;p.allowanceDate=date;p.version++;}
   const statements=[['UPDATE records SET data=json_set(data,\'$.status\',?,\'$.decisionMarker\',?,\'$.decidedAt\',?,\'$.decidedBy\',?) WHERE id=? AND family_id=? AND json_extract(data,\'$.status\')=\'pending\' AND json_extract(data,\'$.expiresAt\')>? AND EXISTS(SELECT 1 FROM records WHERE id=? AND json_extract(data,\'$.policy.version\')=?)',[decision,marker,now,user.userId,r.id,selected,now,d.id,d.data.policy.version]]];
   const guard="EXISTS(SELECT 1 FROM records WHERE id=? AND family_id=? AND json_extract(data,'$.decisionMarker')=?)";
   if(decision==='approved'){
    statements.push([`UPDATE records SET data=json_set(data,'$.policy',json(?)) WHERE id=? AND family_id=? AND ${guard}`,[JSON.stringify(p),d.id,selected,r.id,selected,marker]]);
    const commandId=uuid(),command={deviceId:d.id,childId:r.data.childId,type:'SYNC_POLICY',policyVersion:p.version,status:'queued',expiresAt:now+86400000};statements.push([`INSERT INTO records(id,family_id,kind,data,created_at) SELECT ?,?,'command',?,? WHERE ${guard}`,[commandId,selected,JSON.stringify(command),now,r.id,selected,marker]]);
   }
   const result=await store.batch(statements);if(!result[0].meta.changes)err('Yêu cầu đã được xử lý đồng thời, hãy tải lại.',409);await store.run(...audit('time_request.'+decision,r.id));return response({ok:true,decision});
  }
  if(/^alerts\/[^/]+\/(read|resolve)$/.test(path)&&req.method==='POST'){
   const r=await find(path.split('/')[1],'alert');requirePermission(path.endsWith('resolve')?'alerts.resolve':'alerts.read',r.data.childId);await store.patch(r.id,selected,path.endsWith('resolve')?{status:'resolved',resolvedAt:now,read:true}:{read:true});return response({ok:true});
  }
  if(path==='imports'&&req.method==='POST'){
   const v=z.object({childId:z.string(),source:z.enum(['zalo','facebook','instagram','manual']),consent:z.literal(true),content:z.string().max(262144)}).parse(body);await find(v.childId,'child');requirePermission('data.import',v.childId);let parsed;try{parsed=parseImport(v);}catch(e){err(e.message);}
   const r=await store.insert(selected,'import',{childId:v.childId,source:v.source,status:'awaiting_confirmation',privatePayload:secure.seal(parsed.messages),count:parsed.count,consent:{userId:user.userId,grantedAt:now,purpose:'analysis'},expiresAt:now+86400000});await store.run(...audit('import.create',r.id));return response(present(publicRecord(r),[r]),201);
  }
  if(/^imports\/[^/]+\/confirm$/.test(path)&&req.method==='POST'){
   const r=await find(path.split('/')[1],'import');requirePermission('data.import',r.data.childId);if(r.data.expiresAt<=now)err('Dữ liệu nhập đã hết hạn.',409);if(!await store.update(r,{...r.data,status:'ready'}))err('Dữ liệu nhập đã thay đổi.',409);return response({ok:true});
  }
  if(path==='insights'&&req.method==='POST'){
   const child=await find(body.childId,'child');requirePermission('insights.create',child.id);const devices=(await store.list(selected,'device')).filter(d=>d.data.childId===child.id),ids=new Set(devices.map(d=>d.id));
   const telemetry=await store.all("SELECT min(id) id,device_id,min(captured_at) captured_at,sum(json_extract(payload,'$.minutes')) minutes,sum(coalesce(json_extract(payload,'$.nightMinutes'),0)) night_minutes,count(*) event_count FROM events WHERE family_id=? AND kind='usage' AND captured_at>? GROUP BY device_id,cast(captured_at/3600000 AS INTEGER)",[selected,now-7*86400000]);
   let report=analyzeUsage(telemetry.filter(r=>ids.has(r.device_id)).map(r=>({id:r.id,minutes:r.minutes,nightMinutes:r.night_minutes,eventCount:r.event_count,localDate:new Intl.DateTimeFormat('en-CA',{timeZone:devices.find(d=>d.id===r.device_id)?.data.policy?.timezone||'Asia/Ho_Chi_Minh'}).format(r.captured_at)}))),imported=null;
   if(body.importId){imported=await find(body.importId,'import');if(imported.data.childId!==child.id||imported.data.status!=='ready'||imported.data.expiresAt<=now)err('Nguồn nhập chưa được xác nhận hoặc hết hạn.',409);const messages=secure.open(imported.data.privatePayload);report=analyzeContent(messages);const model=(await store.list(selected,'ai_model')).find(m=>m.data.childId===child.id);if(model)report.observations.push(...classifyMessages(secure.open(model.data.privatePayload),messages));}
   const r=await store.insert(selected,'insight',{childId:child.id,...report,importId:imported?.id||null,evidenceSource:imported?.data.source||'device_usage',expiresAt:now+90*86400000});await store.run(...audit('insight.create',r.id));return response(present(publicRecord(r),[r]),201);
  }
  if(/^insights\/[^/]+\/feedback$/.test(path)&&req.method==='POST'){
   const r=await find(path.split('/')[1],'insight');requirePermission('insights.read',r.data.childId);const v=z.object({verdict:z.enum(['helpful','incorrect']),note:z.string().max(2000).optional()}).parse(body);await store.insert(selected,'insight_feedback',{childId:r.data.childId,insightId:r.id,userId:user.userId,...v});return response({ok:true});
  }
  if(path==='models/train'&&req.method==='POST'){
   owner();const child=await find(body.childId,'child');if(body.consent!==true)err('Cần xác nhận quyền sử dụng dữ liệu để huấn luyện.');let model,metrics;try{model=trainClassifier(body.samples);metrics=evaluateClassifier(model,body.testSamples);}catch(e){err(e.message);}
   const r=await store.insert(selected,'ai_model',{childId:child.id,privatePayload:secure.seal(model),metrics,trainedBy:user.userId,consentAt:now});await store.run(...audit('model.train',r.id));return response({id:r.id,metrics,modelVersion:model.version||'naive-bayes-v1'},201);
  }
  if(path==='export'&&req.method==='POST'){
   owner();const rows=(await store.list(selected)).filter(r=>(!r.data.expiresAt||r.data.expiresAt>now)&&!(r.kind==='insight'&&r.createdAt<now-90*86400000)),telemetry=await store.all('SELECT * FROM events WHERE family_id=? AND captured_at>=? ORDER BY captured_at DESC LIMIT 10000',[selected,now-30*86400000]);await store.run(...audit('data.export',selected));return response({family,records:rows.filter(r=>r.kind!=='ai_model').map(r=>{const p=publicRecord(r);if(r.kind==='import'&&r.data.privatePayload)p.data.messages=secure.open(r.data.privatePayload);return p;}),events:telemetry.map(e=>({...e,payload:decodeEvent(e)})),exportedAt:now,limit:10000});
  }
  if(path==='delete-data'&&req.method==='POST'){
   owner();if(body.confirm!==family.name)err('Tên xác nhận chưa đúng.');await store.batch([['DELETE FROM credentials WHERE family_id=?',[selected]],['DELETE FROM events WHERE family_id=?',[selected]],['DELETE FROM pairings WHERE family_id=?',[selected]],['DELETE FROM records WHERE family_id=?',[selected]],['DELETE FROM families WHERE id=?',[selected]]]);return response({ok:true});
  }
  if(/^records\/[^/]+$/.test(path)&&req.method==='DELETE'){
   const r=await find(path.split('/')[1]);const action={zone:'zone.write',import:'data.import',insight:'insights.create',ai_model:'insights.create'}[r.kind];if(!action)err('Không được xóa loại dữ liệu này.',403);requirePermission(action,r.data.childId);
   const statements=[['DELETE FROM records WHERE id=? AND family_id=?',[r.id,selected]]];if(r.kind==='import')statements.push(["DELETE FROM records WHERE family_id=? AND kind='insight' AND json_extract(data,'$.importId')=?",[selected,r.id]]);await store.batch([...statements,audit(r.kind+'.delete',r.id)]);return response({ok:true});
  }
  err('Không tìm thấy chức năng.',404);
 }
 function decodeEvent(e){const p=JSON.parse(e.payload);return p.privatePayload?secure.open(p.privatePayload):p;}
 function present(clean,originals){if(clean.kind==='import'){const original=originals.find(r=>r.id===clean.id);if(original?.data.privatePayload)clean.data.preview=secure.open(original.data.privatePayload).slice(0,5);}return clean;}
 async function auth({req,path,body,url,now}){
  if(path==='auth/logout'&&req.method==='POST'){const token=readSession(req);if(token)await store.run('DELETE FROM sessions WHERE token_hash=?',[digest(token)]);return response({ok:true},200,{'Set-Cookie':sessionCookie('',url.protocol==='https:')});}
  if(path==='auth/delete-account'&&req.method==='POST'){
   const token=readSession(req),account=token?await store.first('SELECT a.* FROM accounts a JOIN sessions s ON s.user_id=a.id WHERE s.token_hash=? AND s.expires_at>?',[digest(token),now]):null;
   if(!account)err('Hãy đăng nhập trước.',401);const password=z.string().min(12).max(256).parse(body.password);if(!await checkPassword(password,account.password_hash))err('Mật khẩu không đúng.',401);
   if(await store.first('SELECT id FROM families WHERE owner_id=?',[account.id]))err('Hãy xóa dữ liệu gia đình trước khi xóa tài khoản.',409);
   await store.batch([["UPDATE records SET data=json_set(data,'$.status','revoked') WHERE kind='invitation' AND json_extract(data,'$.recipientUserId')=?",[account.id]],['DELETE FROM sessions WHERE user_id=?',[account.id]],['DELETE FROM accounts WHERE id=?',[account.id]]]);return response({ok:true},200,{'Set-Cookie':sessionCookie('',url.protocol==='https:')});
  }
  if(!['auth/register','auth/login'].includes(path)||req.method!=='POST')err('Không tìm thấy chức năng.',404);
  const ipKey=digest('auth-ip:'+(options.trustProxy?req.headers.get('cf-connecting-ip')||'unknown':'local'));await store.run('INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<? THEN ? ELSE reset_at END',[ipKey,now+60000,now,now,now+60000]);if((await store.first('SELECT count FROM rate_limits WHERE key=?',[ipKey])).count>30)err('Quá nhiều lần thử từ kết nối này. Hãy đợi một phút.',429);
  const v=z.object({email,password:z.string().min(12).max(256),name:name.optional()}).parse(body);const key=digest('auth:'+v.email+':'+(options.trustProxy?req.headers.get('cf-connecting-ip')||'unknown':'local'));
  await store.run('INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<? THEN ? ELSE reset_at END',[key,now+60000,now,now,now+60000]);if((await store.first('SELECT count FROM rate_limits WHERE key=?',[key])).count>10)err('Quá nhiều lần thử. Hãy đợi một phút.',429);
  let account=await store.first('SELECT * FROM accounts WHERE email=?',[v.email]);
  if(path==='auth/register'){
   if(account)err('Không thể tạo tài khoản với email này.',409);if(!v.name)err('Hãy nhập họ tên.');const id=uuid(),encoded=await hashPassword(v.password);await store.run('INSERT INTO accounts(id,email,display_name,password_hash,created_at) VALUES(?,?,?,?,?)',[id,v.email,v.name,encoded,now]);account={id,email:v.email,display_name:v.name};
  }else if(!account||!await checkPassword(v.password,account.password_hash))err('Email hoặc mật khẩu không đúng.',401);
  const old=readSession(req);if(old)await store.run('DELETE FROM sessions WHERE token_hash=?',[digest(old)]);const token=secret();await store.run('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)',[digest(token),account.id,now+7*86400000,now]);
  return response({user:{userId:account.id,email:account.email,displayName:account.display_name}},path==='auth/register'?201:200,{'Set-Cookie':sessionCookie(token,url.protocol==='https:')});
 }
}
