// usage: node _tools/shot.mjs <index.html> <outPrefix> <width> <height> [scrollY,...]  (scrollY may be "sel:#id")
import { createRequire } from 'node:module'; const { chromium } = createRequire('/')('playwright');
import path from 'node:path';
const [file, out, w, h, list] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errs = []; page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 300)); }); page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
await page.goto('file://' + path.resolve(file)); await page.waitForTimeout(2500);
let i = 0;
for (const s of (list || '0').split(',')) {
  if (s.startsWith('js:')) { await page.evaluate(s.slice(3)); await page.waitForTimeout(2500); }
  else if (s.startsWith('sel:')) await page.evaluate((q) => { const el = document.querySelector(q); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 70); }, s.slice(4));
  else if (s.startsWith('p:')) await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), +s.slice(2));
  else await page.evaluate((y) => window.scrollTo(0, y), +s);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}-${String(i++).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 72, timeout: 120000, animations: 'disabled' });
}
console.log('docH', await page.evaluate(() => document.documentElement.scrollHeight), 'overflowX', await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
console.log('WIDE', await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed').slice(0, 6).map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right)).join(' | ')));
if (errs.length) console.log('CONSOLE:\n' + [...new Set(errs)].slice(0, 12).join('\n'));
await browser.close();
