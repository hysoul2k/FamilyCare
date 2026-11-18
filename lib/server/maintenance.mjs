import {Store} from './store.mjs';
export async function maintenance(db,now=Date.now()){
 const s=new Store(db),last=await s.first("SELECT value FROM service_state WHERE key='maintenance'");if(last&&Number(last.value)>now-60000)return;
 // All deletions are idempotent. A crash can repeat the bounded sweep safely.
 await s.batch([
 ["DELETE FROM sessions WHERE expires_at<?",[now]],
 ["DELETE FROM rate_limits WHERE reset_at<?",[now]],
 ["DELETE FROM pairings WHERE expires_at<?",[now-86400000]],
 ["DELETE FROM events WHERE captured_at<?",[now-30*86400000]],
 ["DELETE FROM records WHERE kind='import' AND json_extract(data,'$.expiresAt')<?",[now]],
 ["DELETE FROM records WHERE kind='insight' AND created_at<?",[now-90*86400000]],
 ["DELETE FROM records WHERE kind='audit' AND created_at<?",[now-180*86400000]],
 ["UPDATE records SET data=json_set(data,'$.status','expired') WHERE kind='time_request' AND json_extract(data,'$.status')='pending' AND json_extract(data,'$.expiresAt')<?",[now]],
 ["UPDATE records SET data=json_set(data,'$.status','expired') WHERE kind='command' AND json_extract(data,'$.status') IN ('queued','sent','acknowledged') AND json_extract(data,'$.expiresAt')<?",[now]],
 ["INSERT INTO service_state(key,value) VALUES('maintenance',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[String(now)]]
 ]);
}
