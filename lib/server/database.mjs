import {createSupabaseDatabase} from './supabase.mjs';

export function selectDatabase(env){
 const provider=env.FC_DATABASE_PROVIDER||'d1';
 if(provider==='supabase')return createSupabaseDatabase({url:env.SUPABASE_URL||env.NEXT_PUBLIC_SUPABASE_URL,secretKey:env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY});
 if(provider!=='d1'||!env.DB)throw Error('Database configuration is unavailable.');
 return env.DB;
}
