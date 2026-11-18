export function withinSchedule(schedule,now=Date.now(),timezone='Asia/Ho_Chi_Minh'){
 if(!schedule)return true;
 const p=new Intl.DateTimeFormat('en-US',{timeZone:timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now));const get=t=>p.find(x=>x.type===t)?.value;const day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(get('weekday')),time=get('hour')+':'+get('minute');
 if(schedule.start===schedule.end)return schedule.days.includes(day);
 return schedule.start<schedule.end?schedule.days.includes(day)&&time>=schedule.start&&time<schedule.end:(schedule.days.includes(day)&&time>=schedule.start)||(schedule.days.includes((day+6)%7)&&time<schedule.end);
}
export const OWNER_PERMISSIONS=['child.read','child.write','device.read','device.enroll','device.revoke','policy.read','policy.write','policy.approve','command.lock','location.read','location.refresh','usage.read','calls.read','zone.write','alerts.read','alerts.resolve','insights.read','insights.create','data.import','data.export','audit.read','caregiver.manage'];
export function activeGrant(r,userId,now=Date.now()) {const d=r.data;return r.kind==='invitation'&&d.recipientUserId===userId&&d.status==='active'&&d.expiresAt>now&&withinSchedule(d.schedule,now);}
export function permitted(actor,action,childId){return actor.role==='owner'||actor.grants.some(r=>r.data.childId===childId&&r.data.permissions.includes(action));}
export function publicRecord(r){const data={...r.data};delete data.tokenHash;delete data.content;delete data.messages;delete data.privatePayload;delete data.trainingTexts;delete data.trainingData;return {...r,data};}
export function projectRecords(rows,actor){return rows.filter(r=>{
 const childId=r.kind==='child'?r.id:r.data.childId;
 if(actor.role==='owner')return !['zone_state','ai_model'].includes(r.kind);
 if(r.kind==='child')return actor.grants.some(g=>g.data.childId===r.id);
 if(r.kind==='device')return permitted(actor,'device.read',childId)||permitted(actor,'location.read',childId)||permitted(actor,'usage.read',childId);
 const action={zone:'location.read',alert:'alerts.read',insight:'insights.read',import:'data.import',time_request:'policy.approve',command:'policy.read'}[r.kind];return action&&permitted(actor,action,childId);
 }).map(r=>{const clean=publicRecord(r);if(actor.role!=='owner'&&r.kind==='device'&&!permitted(actor,'policy.read',r.data.childId))clean.data={name:r.data.name,childId:r.data.childId,lastSeen:r.data.lastSeen,status:r.data.status};return clean;});}
