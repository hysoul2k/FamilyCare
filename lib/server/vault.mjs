import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
export function vault(keyHex){
 const key=/^[a-f0-9]{64}$/i.test(keyHex||'')?Buffer.from(keyHex,'hex'):null;
 return {
  enabled:!!key,
  seal(value){if(!key)throw Error('Cần cấu hình khóa mã hóa dữ liệu riêng tư trước khi nhập nội dung hoặc cuộc gọi.');const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return {v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')};},
  open(value){if(!key||value?.v!==1)throw Error('Không thể đọc dữ liệu mã hóa.');const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(value.iv,'base64'));decipher.setAuthTag(Buffer.from(value.tag,'base64'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data,'base64')),decipher.final()]).toString('utf8'));}
 };
}
