// Compiler for the small, internal SQLite dialect used by Store. Values always
// remain in a bound JSON array ($1), never interpolated into SQL text.
const numericPaths=new Set(['minutes','nightMinutes','expiresAt','revision','policy.version']);
const quote=value=>"'"+value.replaceAll("'","''")+"'";

export function compilePostgres(sql,params=[]){
 if(!Array.isArray(params)||params.some(v=>v!==null&&!['string','number','boolean'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v)))throw Error('Invalid database parameters.');
 const tokens=sql.match(/'(?:''|[^'])*'|\?|[A-Za-z_][A-Za-z_0-9.]*|\d+(?:\.\d+)?|::|<>|!=|>=|<=|[^\s]/g)||[];
 let index=0,parameter=0;
 const bind=()=>{if(parameter>=params.length)throw Error('Missing SQL parameter.');const n=parameter++,value=params[n],type=typeof value==='number'?(Number.isSafeInteger(value)?'bigint':'double precision'):typeof value==='boolean'?'boolean':'text';return `(($1->>${n})::${type})`;};
 function expression(stop){const out=[];while(index<tokens.length&&!stop.includes(tokens[index])){
  const token=tokens[index++],lower=token.toLowerCase();
  if(token==='?'){out.push(bind());continue;}
  if(tokens[index]==='('){
   index++;const args=[];if(tokens[index]!==')'){for(;;){args.push(expression([',',')']));if(tokens[index]!==',')break;index++;}}
   if(tokens[index++]!==')')throw Error('Invalid SQL expression.');
   if(lower==='json_extract'){
    if(args.length!==2||!/^'\$\.[A-Za-z0-9_.]+'$/.test(args[1]))throw Error('Unsupported JSON path.');
    const path=args[1].slice(3,-1),extract=`((${args[0]})::jsonb #>> ${quote('{'+path.split('.').join(',')+'}')})`;
    out.push(numericPaths.has(path)?`(${extract}::double precision)`:extract);
   }else if(lower==='json')out.push(`((${args[0]})::jsonb)`);
   else if(lower==='json_set'){
    if(args.length<3||args.length%2!==1)throw Error('Invalid JSON mutation.');
    const pairs=[];for(let n=1;n<args.length;n+=2){const value=args[n+1];pairs.push(`jsonb_build_array((${args[n]})::text,${/^\(\(.+\)::jsonb\)$/.test(value)?value:`to_jsonb(${value.startsWith("'")?'('+value+')::text':value})`})`);}
    out.push(`family_care.json_set(${args[0]},jsonb_build_array(${pairs.join(',')}))`);
   }else out.push(`${token}(${args.join(',')})`);
  }else if(token==='('){out.push('('+expression([')'])+')');if(tokens[index++]!==')')throw Error('Invalid SQL group.');}
  else out.push(lower==='integer'?'BIGINT':token);
 }return out.join(' ');}
 let compiled=expression([]);
 if(/^INSERT INTO rate_limits\(/i.test(compiled))compiled=compiled.replaceAll('WHEN reset_at','WHEN rate_limits.reset_at').replaceAll('ELSE count','ELSE rate_limits.count').replaceAll('ELSE reset_at','ELSE rate_limits.reset_at');
 if(parameter!==params.length)throw Error('SQL parameter count mismatch.');
 if(/^INSERT OR IGNORE INTO /i.test(compiled))compiled=compiled.replace(/^INSERT OR IGNORE INTO /i,'INSERT INTO ')+' ON CONFLICT DO NOTHING';
 return {sql:compiled,params};
}
