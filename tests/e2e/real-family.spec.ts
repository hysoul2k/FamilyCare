import {test,expect} from '@playwright/test';
const password='Integration-test-password-2026!';
test('real parent account, child PWA, requests, private import, data deletion',async({page,browser})=>{
 test.setTimeout(120000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const mail='e2e-'+Date.now()+'@integration.test';let familyCreated=false,registered=false;
 const parentApi=async(path:string,body?:any,method=body?'POST':'GET')=>{const r=await page.request.fetch('/api/'+path,{method,data:body});return {status:r.status(),body:await r.json()};};
 let childContext:any;
 try{
  await page.goto('/');await expect(page.getByRole('heading',{name:'Chào mừng đến Family Care'})).toBeVisible();
  await page.getByRole('button',{name:'Tạo tài khoản',exact:true}).click();await page.getByLabel('Tên của bạn').fill('Phụ huynh E2E');await page.getByLabel('Email',{exact:true}).fill(mail);await page.getByLabel('Mật khẩu',{exact:true}).fill(password);await page.locator('.auth-card form').getByRole('button',{name:'Tạo tài khoản'}).click();await expect(page.getByRole('button',{name:'Tạo gia đình',exact:true})).toBeVisible();registered=true;
  expect((await parentApi('bootstrap')).body.records).toEqual([]);
  await page.getByRole('button',{name:'Tạo gia đình',exact:true}).click();await page.getByLabel('Tên gia đình',{exact:true}).fill('Nhà E2E');await page.getByRole('button',{name:'Lưu thay đổi'}).click();await expect(page.getByRole('button',{name:'Thêm trẻ',exact:true})).toBeVisible();familyCreated=true;
  await page.getByRole('button',{name:'Thêm trẻ',exact:true}).click();await page.getByLabel('Tên / biệt danh của con',{exact:true}).fill('Con E2E');await page.getByLabel('Tuổi',{exact:true}).fill('10');await page.getByRole('button',{name:'Lưu thay đổi'}).click();await expect(page.getByRole('heading',{name:'Không gian của Con E2E'})).toBeVisible();
  let bootstrap=(await parentApi('bootstrap')).body;const child=bootstrap.records.find((r:any)=>r.kind==='child');const code=(await parentApi('pairing',{childId:child.id})).body.code;
  childContext=await browser.newContext({baseURL:'http://127.0.0.1:5173',viewport:{width:390,height:844}});const cp=await childContext.newPage();cp.on('pageerror',(e:Error)=>errors.push(e.message));await cp.goto('/child');await cp.getByLabel('Tên thiết bị',{exact:true}).fill('Web con E2E');await cp.getByLabel('Mã ghép',{exact:true}).fill(code);await cp.getByRole('button',{name:'Ghép với gia đình',exact:true}).click();await expect(cp.getByRole('heading',{name:'Quy tắc gia đình'})).toBeVisible();
  await cp.getByLabel('Lý do',{exact:true}).fill('Con cần hoàn thành bài học');await cp.getByRole('button',{name:'Gửi yêu cầu',exact:true}).click();await expect(cp.getByText('pending',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Làm mới',exact:true}).click();await page.getByRole('button',{name:'Thời gian sử dụng',exact:true}).click();await page.getByRole('button',{name:'Đồng ý',exact:true}).click();await expect(page.getByText('approved',{exact:true})).toBeVisible();
  await cp.getByRole('button',{name:'Làm mới',exact:true}).click();await expect(cp.getByText(/Phút bổ sung cho ngày/)).toContainText('15');
  await cp.getByLabel('Lời nhắn (không bắt buộc)').fill('Con cần trao đổi');await cp.getByRole('button',{name:'Gửi SOS cho gia đình'}).click();await page.getByRole('button',{name:'Làm mới',exact:true}).click();await page.getByRole('button',{name:'Thông báo',exact:true}).first().click();await expect(page.getByText('Con cần hỗ trợ',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Góc nhìn AI',exact:true}).click();await page.getByRole('button',{name:'Nhập TXT / JSON được phép'}).click();await page.getByLabel('Nội dung',{exact:true}).fill('Gửi mã OTP để nhận thưởng');await page.getByLabel('Tôi có quyền chia sẻ nội dung này').check();await page.getByRole('button',{name:'Lưu thay đổi'}).click();await expect(page.getByRole('button',{name:'Xác nhận nội dung'})).toBeVisible();await page.getByRole('button',{name:'Xác nhận nội dung'}).click();await page.getByRole('button',{name:'Phân tích nguồn này'}).click();await expect(page.getByText(/quy tắc từ khóa/).first()).toBeVisible();
  await page.getByRole('button',{name:'Tổng quan',exact:true}).click();await page.screenshot({path:'outputs/real-parent-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.locator('.sidebar').evaluate(e=>e.getBoundingClientRect().right)).toBeLessThanOrEqual(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'outputs/real-parent-mobile.png',fullPage:true});await cp.screenshot({path:'outputs/real-child-web.png',fullPage:true});
  expect(errors).toEqual([]);
 }finally{
  test.setTimeout(test.info().timeout+15000);
  if(familyCreated)await parentApi('delete-data',{confirm:'Nhà E2E'});if(registered)await parentApi('auth/delete-account',{password});await childContext?.close();
 }
});
