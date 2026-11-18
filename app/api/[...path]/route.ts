import {env} from 'cloudflare:workers';
import {createApi} from '@/lib/server/service.mjs';
import {selectDatabase} from '@/lib/server/database.mjs';
export const dynamic='force-dynamic';
async function handle(req:Request){let db;try{db=selectDatabase(env);}catch{return Response.json({message:'Database chưa được cấu hình đầy đủ.'},{status:503,headers:{'Cache-Control':'no-store'}});}return createApi(db,{dataKey:env.FC_DATA_KEY,trustProxy:!import.meta.env.DEV})(req);}
export const GET=handle;export const POST=handle;export const PUT=handle;export const DELETE=handle;export const PATCH=handle;
