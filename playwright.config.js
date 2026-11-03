import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e', timeout:15000, fullyParallel:false, workers:1,
 use:{baseURL:'http://127.0.0.1:4173',headless:true,trace:'retain-on-failure'},
 webServer:{command:'node scripts/servidor-e2e.mjs',url:'http://127.0.0.1:4173/tests/e2e/fixtures/inspecao-harness.html',reuseExistingServer:false,timeout:15000},
 reporter:[['list']]
});
