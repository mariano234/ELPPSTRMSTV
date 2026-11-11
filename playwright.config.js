import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  workers: 1,
  reporter: 'list',
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node tests/support/serve-build.js',
    url: 'http://127.0.0.1:8788',
    reuseExistingServer: !process.env.CI,
  },
});
