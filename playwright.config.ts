import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',workers:1,use:{baseURL:'http://127.0.0.1:5173',headless:true},expect:{timeout:15000},timeout:120000,reporter:'list'});
