import {compilePostgres} from './postgres-sql.mjs';

export function createSupabaseDatabase({url,secretKey,fetcher=fetch}){
 const project=new URL(url);
 if(project.protocol!=='https:'||project.username||project.password||project.pathname!=='/'||project.search||project.hash||!secretKey||secretKey.startsWith('sb_publishable_'))throw Error('Supabase server configuration is incomplete.');
 const endpoint=project.origin+'/rest/v1/rpc/fc_execute';
 async function execute(statements){
  let response;
  try{response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey:secretKey,...(secretKey.startsWith('eyJ')?{Authorization:'Bearer '+secretKey}:{})},body:JSON.stringify({statements}),signal:AbortSignal.timeout(20000)});}catch{throw Error('Database connection unavailable.');}
  if(!response.ok)throw Error('Database operation failed.');
  const result=await response.json();if(!Array.isArray(result)||result.length!==statements.length)throw Error('Invalid database response.');return result;
 }
 function statement(sql,params=[]){return {bind(...values){return statement(sql,values);},compiled:()=>compilePostgres(sql,params),async first(){return (await execute([this.compiled()]))[0].results[0]||null;},async all(){return (await execute([this.compiled()]))[0];},async run(){return (await execute([this.compiled()]))[0];}};}
 return {dialect:'postgres',provider:'Supabase/PostgreSQL',prepare:statement,async batch(statements){return execute(statements.map(s=>s.compiled()));}};
}
