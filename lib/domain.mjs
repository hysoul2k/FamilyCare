import {z} from 'zod';
export function authorize(a, action, r, now=Date.now()) {
 if(!a||a.familyId!==r.familyId)return false;
 return a.role==='owner'||(a.childId===r.childId&&a.expiresAt>now&&a.permissions.includes(action));
}
const packageId=z.string().regex(/^[A-Za-z0-9_.-]{1,200}$/);
const policySchema=z.object({
 dailyLimitMinutes:z.number().int().min(0).max(1440),timezone:z.string().min(1).max(100).refine(t=>{try{new Intl.DateTimeFormat('en',{timeZone:t});return true;}catch{return false;}}),
 essentialPackages:z.array(packageId).max(200),blockedPackages:z.array(packageId).max(200),
 appLimits:z.record(packageId,z.number().int().min(0).max(1440)),
 schedules:z.array(z.object({name:z.string().max(100).optional(),start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),end:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),days:z.array(z.number().int().min(0).max(6)).min(1).max(7),allowedPackages:z.array(packageId).max(200)})).max(20),
 version:z.number().int().nonnegative().optional(),restrictedUntil:z.number().int().nonnegative().optional(),allowanceMinutes:z.number().int().min(0).max(1440).optional(),allowanceDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
});
export function validatePolicy(value){return policySchema.parse(value);}
export function canUseApp(p,pkg,total,used,now=new Date()){
 if(p.essentialPackages.includes(pkg))return true;
 if(p.blockedPackages.includes(pkg))return false;
 if(p.restrictedUntil>now.getTime())return false;
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:p.timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const get=t=>parts.find(x=>x.type===t)?.value;
 const day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(get('weekday')),time=get('hour')+':'+get('minute');
 for(const s of p.schedules){const active=s.start<s.end?s.days.includes(day)&&time>=s.start&&time<s.end:(s.days.includes(day)&&time>=s.start)||(s.days.includes((day+6)%7)&&time<s.end);if(active&&!s.allowedPackages.includes(pkg))return false;}
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:p.timezone}).format(now),bonus=p.allowanceDate===date?p.allowanceMinutes||0:0;
 return total<p.dailyLimitMinutes+bonus&&used<(p.appLimits[pkg]??Infinity);
}
export function zonePosition(p,z,now=Date.now()){
 if(now-p.capturedAt>300000||p.capturedAt>now+60000||p.accuracy>100||p.accuracy<0)return 'uncertain';
 const rad=x=>x*Math.PI/180,a=Math.sin(rad(z.lat-p.lat)/2)**2+Math.cos(rad(p.lat))*Math.cos(rad(z.lat))*Math.sin(rad(z.lng-p.lng)/2)**2,d=6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
 return d+p.accuracy<=z.radius?'inside':d-p.accuracy>z.radius?'outside':'uncertain';
}
export function transitionCommand(c,next,now=Date.now()){
 if(c.expiresAt<=now||c.status==='expired')return 'expired';
 if(c.status===next)return next;
 if(!({queued:['sent','acknowledged','failed'],sent:['acknowledged','failed'],acknowledged:['applied','failed']}[c.status]?.includes(next)))throw Error('Trạng thái lệnh không hợp lệ.');
 return next;
}
export function analyzeUsage(rows){
 const days=new Map();for(const r of rows){const key=r.localDate||'unknown',list=days.get(key)||[];list.push(r);days.set(key,list);}
 const observations=[];for(const [date,list] of days){const night=list.filter(r=>Number(r.nightMinutes)>0);const minutes=night.reduce((s,r)=>s+Number(r.nightMinutes),0);if(minutes>=30)observations.push({type:'night_usage',description:`Ghi nhận ${Math.round(minutes)} phút sử dụng ban đêm${date==='unknown'?'':' ngày '+date}. Hãy trao đổi để hiểu bối cảnh.`,evidenceRefs:night.map(r=>r.id),uncertainty:'Thống kê không cho biết mục đích hay cảm xúc của trẻ.'});}
 return {summary:rows.length?'Tóm tắt thống kê từ dữ liệu đã nhận.':'Chưa đủ dữ liệu để phân tích.',observations,modelVersion:'usage-rules-v2',limitations:['Không phải chẩn đoán tâm lý.','Không đọc tin nhắn từ ứng dụng khác.','Các đoạn sử dụng được cộng theo ngày; dữ liệu thiếu không được suy ra là không sử dụng.']};
}
export function validateEvent(e,now=Date.now()){
 if(typeof e.eventId!=='string'||!e.eventId||e.eventId.length>100||!Number.isFinite(e.capturedAt)||e.capturedAt>now+300000||e.capturedAt<now-30*86400000)throw Error('ID hoặc thời gian sự kiện không hợp lệ.');
 const p=e.payload;if(!p||typeof p!=='object')throw Error('Thiếu dữ liệu sự kiện.');
 if(e.kind==='usage'){if(typeof p.packageId!=='string'||p.packageId.length>200||!Number.isFinite(p.minutes)||p.minutes<0||p.minutes>1440||(p.nightMinutes!==undefined&&(!Number.isFinite(p.nightMinutes)||p.nightMinutes<0||p.nightMinutes>p.minutes)))throw Error('Dữ liệu sử dụng không hợp lệ.');}
 else if(e.kind==='location'){if(!Number.isFinite(p.lat)||Math.abs(p.lat)>90||!Number.isFinite(p.lng)||Math.abs(p.lng)>180||!Number.isFinite(p.accuracy)||p.accuracy<0)throw Error('Tọa độ không hợp lệ.');}
 else if(e.kind==='call'){if(!['incoming','outgoing','missed'].includes(p.direction)||typeof p.number!=='string'||p.number.length>30||!Number.isFinite(p.duration)||p.duration<0||p.duration>86400)throw Error('Cuộc gọi không hợp lệ.');}
 else throw Error('Loại sự kiện chưa hỗ trợ.');return e;
}
