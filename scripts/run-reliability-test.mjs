#!/usr/bin/env node
/**
 * Пуска finding-reliability.html срещу локален Vite dev server.
 * Изисква: playwright chromium (npx playwright install chromium)
 */
import { spawn } from 'node:child_process'
import { copyFileSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.env.TEST_BASE || 'http://127.0.0.1:5199'
const port = new URL(base).port || '5199'

copyFileSync('test/finding-reliability.html', 'public/__reliability.html')

let server
const needServer = process.env.SKIP_SERVER !== '1'

if (needServer) {
  server = spawn('npx', ['vite', '--port', port, '--host', '127.0.0.1'], {
    stdio: 'pipe',
    shell: true,
  })
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Vite startup timeout')), 30000)
    server.stdout?.on('data', d => {
      if (String(d).includes('Local:')) {
        clearTimeout(t)
        resolve()
      }
    })
    server.stderr?.on('data', d => console.error(String(d)))
    server.on('error', reject)
  })
  await new Promise(r => setTimeout(r, 800))
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto(`${base}/__reliability.html`, { waitUntil: 'networkidle', timeout: 120000 })
await page.waitForFunction(() => window.__done, null, { timeout: 120000 })
const text = await page.evaluate(() => window.__done)
const ok = await page.evaluate(() => window.__ok)
console.log(text)
console.log(`\nRESULT: ${ok ? 'PASS' : 'FAIL'}`)
await browser.close()
if (server) server.kill('SIGTERM')
process.exit(ok ? 0 : 1)
