import {scrypt,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
export const digest=s=>createHash('sha256').update(s).digest('hex');
export const secret=()=>randomBytes(32).toString('hex');
const derive=(password,salt)=>new Promise((resolve,reject)=>scrypt(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024},(e,key)=>e?reject(e):resolve(key)));
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');return `scrypt-32768-8-3$${salt}$${(await derive(password,salt)).toString('hex')}`;}
export async function checkPassword(password,encoded){const [algorithm,salt,stored]=encoded.split('$');if(algorithm!=='scrypt-32768-8-3'||!salt||stored?.length!==128)return false;return timingSafeEqual(await derive(password,salt),Buffer.from(stored,'hex'));}
export function sessionCookie(token,secure=true){return `fc_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token?604800:0}${secure?'; Secure':''}`;}
export function readSession(req){return /(?:^|;\s*)fc_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.get('cookie')||'')?.[1];}
