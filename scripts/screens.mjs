// Снимает страницу на контрольных ширинах и ищет горизонтальное переполнение.
// Запуск: сначала `npm run dev`, затем `node scripts/screens.mjs [ширины через запятую] [папка]`.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const widths = (process.argv[2] || '1600,1440,1280,1024,768,430,390,360').split(',').map(Number);
const dir = process.argv[3] || 'screens';
const url = process.env.URL || 'http://localhost:4321/';
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();
for (const width of widths) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; });
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
  });
  const report = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const inScroller = (el) => el.closest('.cases__track, .marquee');
    const over = [];
    for (const el of document.querySelectorAll('main *, header *, footer *')) {
      if (inScroller(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > vw + 1 || r.left < -1)) {
        const cs = getComputedStyle(el);
        let clipped = false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          if (getComputedStyle(p).overflowX !== 'visible') { clipped = true; break; }
        }
        if (!clipped && cs.position !== 'fixed') over.push(`${el.className || el.tagName} [${Math.round(r.left)}..${Math.round(r.right)}]`);
      }
    }
    const small = [...document.querySelectorAll('.benefit,.service,.tile,.tariff,.case')].map((e) => Math.round(e.getBoundingClientRect().width));
    return { scrollW: document.documentElement.scrollWidth, vw, height: document.documentElement.scrollHeight, over: [...new Set(over)].slice(0, 12), minCard: Math.min(...small) };
  });
  await page.screenshot({ path: `${dir}/w${width}.png`, fullPage: true });
  console.log(width, JSON.stringify(report), errors.length ? 'ERRORS: ' + errors.join(' | ') : '');
  await ctx.close();
}
await browser.close();
