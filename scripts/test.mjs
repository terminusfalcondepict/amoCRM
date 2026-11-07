// Проверка интерактива: аккордеон, перетаскивание кейсов, форма, якоря. Запуск при работающем `npm run dev`.
import { chromium } from 'playwright';
const url = process.env.URL || 'http://localhost:4321/';
const b = await chromium.launch();
const ok = (n, c) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + n); if (!c) process.exitCode = 1; };
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url, { waitUntil: 'networkidle' });
// аккордеон
const steps = p.locator('.step');
ok('этап 1 открыт изначально', await steps.nth(0).evaluate((e) => e.classList.contains('is-open')));
await steps.nth(2).locator('button').click();
ok('клик открывает этап 3 и закрывает этап 1', await steps.nth(2).evaluate((e) => e.classList.contains('is-open')) && !(await steps.nth(0).evaluate((e) => e.classList.contains('is-open'))));
ok('aria-expanded обновляется', (await steps.nth(2).locator('button').getAttribute('aria-expanded')) === 'true');
await p.waitForTimeout(100);
ok('текст этапа 3 видим', await steps.nth(2).locator('.step__desc').isVisible());
await steps.nth(2).locator('button').click();
ok('повторный клик закрывает этап', !(await steps.nth(2).evaluate((e) => e.classList.contains('is-open'))));
// перетаскивание
const track = p.locator('.cases__track');
await track.scrollIntoViewIfNeeded();
const box = await track.boundingBox();
const before = await track.evaluate((e) => e.scrollLeft);
await p.mouse.move(box.x + 900, box.y + 300); await p.mouse.down(); await p.mouse.move(box.x + 500, box.y + 300, { steps: 8 }); await p.mouse.up();
const after = await track.evaluate((e) => e.scrollLeft);
ok(`перетаскивание мышью сдвигает кейсы (${before} → ${after})`, after > before + 100);
ok('прокрутка страницы не сломана', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 1440);
// кнопки к форме
await p.locator('.hero .btn').click(); await p.waitForTimeout(300);
ok('кнопка в hero ведёт к форме', p.url().endsWith('#consultation') && await p.locator('.form').isVisible());
// форма
const form = p.locator('[data-lead-form]');
await form.locator('button[type=submit]').click();
ok('пустая форма показывает ошибки', await form.locator('.form__error').first().isVisible() && await form.locator('.form__success').isHidden());
await form.locator('[name=name]').fill('Иван');
await form.locator('[name=phone]').pressSequentially('89991234567');
ok('маска телефона', (await form.locator('[name=phone]').inputValue()) === '+ 7 999 (123) 45 - 67');
await form.locator('button[type=submit]').click(); await p.waitForTimeout(100);
ok('заполненная форма показывает успех', await form.locator('.form__success').isVisible());
ok('нет ошибок в консоли', errs.length === 0);
// касание: прокрутка кейсов пальцем на телефоне работает нативно
const m = await (await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true })).newPage();
await m.goto(url, { waitUntil: 'networkidle' });
const ov = await m.locator('.cases__track').evaluate((e) => [getComputedStyle(e).overflowX, e.scrollWidth > e.clientWidth]);
ok('на телефоне кейсы прокручиваются', ov[0] === 'auto' && ov[1]);
// бургер-меню
await m.goto(url, { waitUntil: 'networkidle' });
const burger = m.locator('[data-burger]'), menu = m.locator('[data-mobile-menu]');
ok('бургер виден на телефоне, обычное меню скрыто', await burger.isVisible() && !(await m.locator('.nav').isVisible()));
ok('меню закрыто изначально', !(await menu.isVisible()));
await m.evaluate(() => window.scrollTo({ top: 3000, behavior: 'instant' })); await m.waitForTimeout(100);
const bb = await burger.boundingBox();
ok(`бургер остаётся на экране при прокрутке (y=${Math.round(bb.y)})`, bb.y >= 0 && bb.y < 40);
await burger.tap(); await m.waitForTimeout(350);
ok('тап открывает меню', await menu.isVisible() && (await burger.getAttribute('aria-expanded')) === 'true');
ok('страница за меню не прокручивается', await m.evaluate(() => getComputedStyle(document.documentElement).overflowY === 'hidden'));
await burger.tap(); await m.waitForTimeout(350);
ok('повторный тап закрывает меню', !(await menu.isVisible()));
ok('позиция прокрутки сохраняется', Math.abs(await m.evaluate(() => scrollY) - 3000) < 5);
await burger.tap(); await m.waitForTimeout(350);
await m.keyboard.press('Escape'); await m.waitForTimeout(350);
ok('Esc закрывает меню', !(await menu.isVisible()));
await burger.tap(); await m.waitForTimeout(350);
await menu.locator('a[href="#cases"]').tap(); await m.waitForTimeout(1500);
const casesTop = await m.locator('#cases').evaluate((e) => e.getBoundingClientRect().top);
ok(`пункт меню закрывает меню и ведёт к разделу (top=${Math.round(casesTop)})`, !(await menu.isVisible()) && Math.abs(casesTop) < 60);
const d = await (await b.newContext({ viewport: { width: 1024, height: 800 } })).newPage();
await d.goto(url, { waitUntil: 'networkidle' });
ok('на планшете бургера нет', !(await d.locator('[data-burger]').isVisible()) && await d.locator('.nav').isVisible());
await b.close();
