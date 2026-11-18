import {createInterface} from 'node:readline/promises';
const input=createInterface({input:process.stdin,output:process.stdout});
console.log('Bộ mô phỏng giao thức. Không có khả năng điều khiển OS; không báo applied giả.');
const base=await input.question('Backend URL (local preview hoặc gateway đã xác thực): ');
const code=await input.question('Mã ghép một lần: ');input.close();
let token;
async function api(path,body){const r=await fetch(new URL('/api/'+path,base),{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,redirect:'error'});if(!r.ok)throw Error(`HTTP ${r.status}: không thể thực hiện ${path}`);return r.json();}
const enrolled=await api('device/enroll',{code,name:'Mô phỏng giao thức · Không phải Android thật'});token=enrolled.token;
await api('device/heartbeat',{capabilities:{lock:'unsupported',location:'unsupported',app_block:'unsupported',usage:'unsupported'}});
console.log('Đã ghép bộ mô phỏng. Credential chỉ giữ trong bộ nhớ.');
async function sync(){const policy=await api('device/policy');console.log('Desired policy version:',policy?.version);const commands=await api('device/commands');for(const c of commands){if(c.data.status!=='acknowledged')await api(`device/commands/${c.id}/results`,{status:'acknowledged'});await api(`device/commands/${c.id}/results`,{status:'failed',errorCode:'SIMULATOR_NO_OS_ENFORCEMENT'});}console.log('Đã đối soát lệnh. Chờ 10 giây trước lần tiếp theo.');}
await sync();setInterval(()=>sync().catch(e=>{console.error(e.message);process.exitCode=1;}),10000);
