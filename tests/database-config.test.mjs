import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectDatabase} from '../lib/server/database.mjs';
test('runtime keeps D1 explicitly and never silently falls back from misconfigured Supabase',()=>{
 const local={prepare(){}};
 assert.equal(selectDatabase({DB:local}),local);
 assert.throws(()=>selectDatabase({DB:local,FC_DATABASE_PROVIDER:'unknown'}));
 assert.throws(()=>selectDatabase({DB:local,FC_DATABASE_PROVIDER:'supabase',SUPABASE_URL:'https://ybrqqcxpzkogurvhbzlx.supabase.co'}));
 assert.throws(()=>selectDatabase({FC_DATABASE_PROVIDER:'supabase',SUPABASE_URL:'https://ybrqqcxpzkogurvhbzlx.supabase.co',SUPABASE_SECRET_KEY:'sb_publishable_not_a_server_key'}));
 const remote=selectDatabase({FC_DATABASE_PROVIDER:'supabase',SUPABASE_URL:'https://ybrqqcxpzkogurvhbzlx.supabase.co',SUPABASE_SECRET_KEY:'server-only-test'});
 assert.equal(remote.provider,'Supabase/PostgreSQL');
});
