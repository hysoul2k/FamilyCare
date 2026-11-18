export class Store{
 constructor(db){this.db=db;}
 statement(q,args=[]){return this.db.prepare(q).bind(...args);}
 async first(q,args=[]){return this.statement(q,args).first();}
 async all(q,args=[]){return (await this.statement(q,args).all()).results;}
 async run(q,args=[]){return this.statement(q,args).run();}
 async batch(statements){return this.db.batch(statements.map(([q,args])=>this.statement(q,args)));}
 row(row){return row?{id:row.id,familyId:row.family_id,kind:row.kind,data:JSON.parse(row.data),createdAt:row.created_at}:null;}
 recordInsert(familyId,kind,data,id=crypto.randomUUID(),now=Date.now()){
  return ['INSERT INTO records(id,family_id,kind,data,created_at) VALUES(?,?,?,?,?)',[id,familyId,kind,JSON.stringify(data),now]];
 }
 async record(id,familyId){return this.row(await this.first('SELECT * FROM records WHERE id=? AND family_id=?',[id,familyId]));}
 async list(familyId,kind){return (await this.all('SELECT * FROM records WHERE family_id=?'+(kind?' AND kind=?':'')+' ORDER BY created_at DESC LIMIT 5000',kind?[familyId,kind]:[familyId])).map(r=>this.row(r));}
 async insert(familyId,kind,data,id=crypto.randomUUID(),now=Date.now()){const s=this.recordInsert(familyId,kind,data,id,now);await this.run(...s);return {id,familyId,kind,data,createdAt:now};}
 async update(record,data){const equal=this.db.dialect==='postgres'?'data::jsonb=?::jsonb':'data=?';const result=await this.run('UPDATE records SET data=? WHERE id=? AND family_id=? AND '+equal,[JSON.stringify(data),record.id,record.familyId,JSON.stringify(record.data)]);return result.meta.changes>0;}
 async patch(id,familyId,values){const paths=Object.keys(values).flatMap(k=>['$.'+k,JSON.stringify(values[k])]);const sets=Object.keys(values).map(()=>"?,json(?)").join(',');return this.run(`UPDATE records SET data=json_set(data,${sets}) WHERE id=? AND family_id=?`,[...paths,id,familyId]);}
}
