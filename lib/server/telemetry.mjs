export function dateWindow(date,timezone){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Ngày dữ liệu không hợp lệ.');
 const [year,month,day]=date.split('-').map(Number),base=Date.UTC(year,month-1,day);if(new Date(base).toISOString().slice(0,10)!==date)throw Error('Ngày dữ liệu không tồn tại.');
 const midnight=target=>{let guess=target;for(let i=0;i<4;i++){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(guess),get=k=>Number(parts.find(x=>x.type===k).value),represented=Date.UTC(get('year'),get('month')-1,get('day'),get('hour'),get('minute'),get('second'));guess+=target-represented;}return guess;};
 return {start:midnight(base),end:midnight(base+86400000)};
}
export async function viewTelemetry(store,{familyId,deviceId,date,timezone,allowed,decode}){
 const {start,end}=dateWindow(date,timezone),events=[];let callsTruncated=false;
 if(allowed('usage.read')){
  const rows=await store.all("SELECT min(id) id,min(captured_at) captured_at,json_extract(payload,'$.packageId') package_id,sum(json_extract(payload,'$.minutes')) minutes,sum(coalesce(json_extract(payload,'$.nightMinutes'),0)) night_minutes,count(*) segment_count FROM events WHERE family_id=? AND device_id=? AND kind='usage' AND captured_at>=? AND captured_at<? GROUP BY json_extract(payload,'$.packageId'),cast((captured_at-?)/3600000 AS INTEGER)",[familyId,deviceId,start,end,start]);
  for(const r of rows)events.push({id:r.id,deviceId,kind:'usage',capturedAt:r.captured_at,aggregated:true,eventCount:r.segment_count,payload:{packageId:r.package_id,minutes:r.minutes,nightMinutes:r.night_minutes}});
 }
 if(allowed('location.read')){const row=await store.first("SELECT * FROM events WHERE family_id=? AND device_id=? AND kind='location' ORDER BY captured_at DESC LIMIT 1",[familyId,deviceId]);if(row)events.push({id:row.id,deviceId,kind:'location',capturedAt:row.captured_at,payload:decode(row)});}
 if(allowed('calls.read')){const rows=await store.all("SELECT * FROM events WHERE family_id=? AND device_id=? AND kind='call' AND captured_at>=? AND captured_at<? ORDER BY captured_at DESC LIMIT 1001",[familyId,deviceId,start,end]);callsTruncated=rows.length>1000;for(const r of rows.slice(0,1000))events.push({id:r.id,deviceId,kind:'call',capturedAt:r.captured_at,payload:decode(r)});}
 return {events,view:{deviceId,date,usageAggregated:true,callsTruncated}};
}
