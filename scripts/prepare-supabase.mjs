import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';

// Never overwrite a supplied value or rotate an existing encryption key.
const destination='.dev.vars';
let content=existsSync(destination)?readFileSync(destination,'utf8'):'';
for(const [key,value] of Object.entries({FC_DATABASE_PROVIDER:'d1',SUPABASE_URL:'https://ybrqqcxpzkogurvhbzlx.supabase.co',SUPABASE_SECRET_KEY:'',FC_DATA_KEY:randomBytes(32).toString('hex')})){
 if(!new RegExp('^'+key+'\\s*=','m').test(content))content+=(content.endsWith('\n')||!content?'':'\n')+key+'='+value+'\n';
}
writeFileSync(destination,content,{mode:0o600});
console.log('Local configuration prepared; existing values preserved. Set SUPABASE_SECRET_KEY privately, apply migration, run npm run supabase:check, then set FC_DATABASE_PROVIDER=supabase.');
