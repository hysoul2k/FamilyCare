// Removes only accounts created by this project's integration test naming conventions.
import {DatabaseSync} from 'node:sqlite';
import {readdirSync} from 'node:fs';
import {resolve,sep} from 'node:path';
if(!process.argv.includes('--confirm-test-only'))throw Error('Required: --confirm-test-only');
const root=resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),files=readdirSync(root).filter(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite');
if(files.length!==1)throw Error('Database local không duy nhất. Không xóa dữ liệu.');
const path=resolve(root,files[0]);if(!path.startsWith(root+sep))throw Error('Đường dẫn database không hợp lệ.');
const db=new DatabaseSync(path);db.exec('PRAGMA foreign_keys=ON;PRAGMA busy_timeout=10000');
const users=db.prepare('SELECT id FROM accounts WHERE (display_name=? AND email LIKE ?) OR (display_name LIKE ? AND email LIKE ?)').all('Phụ huynh E2E','e2e-%@integration.test','Ki%Android','native-%@integration.test');
db.exec('BEGIN IMMEDIATE');
try{
 for(const user of users){
  for(const family of db.prepare('SELECT id FROM families WHERE owner_id=?').all(user.id)){
   for(const table of ['credentials','events','pairings','records'])db.prepare('DELETE FROM '+table+' WHERE family_id=?').run(family.id);
   db.prepare('DELETE FROM families WHERE id=?').run(family.id);
  }
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);db.prepare('DELETE FROM accounts WHERE id=?').run(user.id);
 }
 db.exec('COMMIT');
 console.log(JSON.stringify({testAccountsRemoved:users.length,remainingAccounts:db.prepare('SELECT count(*) n FROM accounts').get().n,remainingFamilies:db.prepare('SELECT count(*) n FROM families').get().n,remainingEvents:db.prepare('SELECT count(*) n FROM events').get().n}));
}catch(e){db.exec('ROLLBACK');throw e;}finally{db.close();}
