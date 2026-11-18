import {createBrowserClient} from '@supabase/ssr';

// Optional Supabase browser client. Family data remains behind /api and cannot
// be read directly with the publishable key. App auth is still fc_session.
export function createClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw new Error('Supabase public configuration is missing.');
 return createBrowserClient(url,key);
}
