import {test,expect} from '@playwright/test';

test('manager home-screen install contract opens management and serves its icons',async({page,request})=>{
 const response=await request.get('/manifest.webmanifest');expect(response.ok()).toBe(true);
 const manifest=await response.json();expect(manifest.start_url).toBe('/');expect(manifest.display).toBe('standalone');
 expect(manifest.id).toBe('family-care-parent');
 for(const icon of manifest.icons)expect((await request.get(icon.src)).ok()).toBe(true);
 await page.setViewportSize({width:390,height:844});
 await page.goto('/install');
 await expect(page.getByRole('heading',{name:'iPhone và iPad',exact:true})).toBeVisible();
 await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content','yes');
 await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content',/viewport-fit=cover/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.getByRole('link',{name:'Tải APK quản lý Android'})).toHaveAttribute('href','/downloads/family-care-parent-debug.apk');
});
