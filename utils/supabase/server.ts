import 'server-only';
import {createServerClient} from '@supabase/ssr';
import type {cookies} from 'next/headers';

// Optional helper for future Supabase Auth features. Does not replace the
// existing application's session cookie or grant access to private family data.
export function createClient(cookieStore:Awaited<ReturnType<typeof cookies>>){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw new Error('Supabase public configuration is missing.');
 return createServerClient(url,key,{cookies:{getAll:()=>cookieStore.getAll(),setAll(values){
  for(const {name,value,options} of values)cookieStore.set(name,value,options);
 }}});
}
