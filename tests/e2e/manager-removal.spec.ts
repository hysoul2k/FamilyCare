import {test,expect} from '@playwright/test';

test('manager approves removal but sees awaiting-device confirmation until OS result',async({page})=>{
 let status='pending',decisions=0;
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/removal-requests/request-1/decision'){
   expect(route.request().postDataJSON()).toEqual({decision:'approved'});decisions++;status='approved';
   return route.fulfill({json:{ok:true,decision:'approved'}});
  }
  if(path==='/api/bootstrap')return route.fulfill({json:{user:{displayName:'Manager test',email:'manager@example.test'},family:{id:'family-1',name:'Test family'},role:'owner',permissions:[],events:[],records:[
   {id:'child-1',kind:'child',createdAt:Date.now(),data:{name:'Child test',age:10}},
   {id:'device-1',kind:'device',createdAt:Date.now(),data:{childId:'child-1',name:'Test phone',platform:'Android',lastSeen:Date.now(),uninstallProtection:'enabled',capabilities:{uninstall_protection:'supported'},policy:{version:1,timezone:'Asia/Ho_Chi_Minh',dailyLimitMinutes:120,blockedPackages:[],appLimits:{},schedules:[],essentialPackages:[]}}},
   {id:'request-1',kind:'removal_request',createdAt:Date.now(),data:{childId:'child-1',deviceId:'device-1',reason:'Replace test phone',status,expiresAt:Date.now()+600000}}
  ]}});
  return route.fulfill({status:404,json:{message:'Unexpected test request'}});
 });
 await page.goto('/');await page.getByRole('button',{name:'Thiết bị của con',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Yêu cầu gỡ ứng dụng'})).toBeVisible();
 await expect(page.getByText('Replace test phone')).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Cho phép gỡ',exact:true}).click();
 await expect(page.getByText('Đã duyệt · chờ thiết bị xác nhận', {exact:true})).toBeVisible();
 expect(decisions).toBe(1);
 await expect(page.getByRole('button',{name:'Cho phép gỡ',exact:true})).toHaveCount(0);
});
