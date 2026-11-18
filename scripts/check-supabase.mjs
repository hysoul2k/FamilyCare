import {existsSync} from 'node:fs';
import {createSupabaseDatabase} from '../lib/server/supabase.mjs';

if(existsSync('.dev.vars'))process.loadEnvFile('.dev.vars');
try{
 const db=createSupabaseDatabase({url:process.env.SUPABASE_URL,secretKey:process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY});
 await db.prepare('SELECT value FROM service_state LIMIT 1').first();
 console.log('Supabase connection and Family Care migration verified. No family data changed.');
}catch{
 console.error('Supabase not ready. Check URL, server secret and applied migration. Credentials are not printed. See docs/supabase-setup.md.');
 process.exitCode=1;
}
