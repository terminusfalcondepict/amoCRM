// Проверка админки: вход, редактирование разделов, кейсы, SEO, сохранение в Supabase, выход.
// Запуск при работающем `npm run dev`: node scripts/test-admin.mjs
// Пароль берётся из .env.local и нигде не выводится. SHOTS=папка — сохранить снимки экрана.
// Тест пишет в настоящую базу из .env.local: в начале запоминает контент, в конце возвращает его как было.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const base = (process.env.URL || 'http://localhost:4321').replace(/\/$/, '');
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const PASSWORD = env.ADMIN_PASSWORD;
const shots = process.env.SHOTS;

const ok = (n, c) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + n); if (!c) process.exitCode = 1; };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
// 401 и 422 — ожидаемые ответы на проверки неверного пароля и неверных данных
p.on('console', (m) => { if (m.type() === 'error' && !/\b(401|422)\b/.test(m.text())) errs.push(m.text()); });
const shot = async (name) => { if (shots) await p.screenshot({ path: `${shots}/${name}.png`, fullPage: true }); };
const toast = () => p.locator('.adm-toast').last().textContent();
const bar = p.locator('[data-savebar]');

// ---------- Вход ----------
await p.goto(`${base}/admin`);
ok('без входа /admin ведёт на страницу входа', p.url().endsWith('/admin/login'));
await shot('01-login');
await p.fill('input[name=password]', 'неверный-пароль');
await p.click('button[type=submit]');
ok('неверный пароль показывает ошибку', await p.locator('#login-error').isVisible());
await p.fill('input[name=password]', PASSWORD);
await p.click('button[type=submit]');
await p.waitForSelector('.adm-section__title');
ok('верный пароль открывает админку', p.url().includes('/admin#hero'));
const cookie = (await ctx.cookies()).find((c) => c.name === 'admin_session');
ok('cookie сессии httpOnly и SameSite=Strict', cookie?.httpOnly && cookie?.sameSite === 'Strict');

// ---------- API ----------
const api = (method, section, value, headers = {}) => p.evaluate(async ([m, sec, v, hd]) => {
  const r = await fetch(`/admin/api/content/${sec}`, { method: m, headers: { 'Content-Type': 'application/json', ...hd },
    body: m === 'GET' ? undefined : JSON.stringify({ value: v }) });
  return { status: r.status, body: await r.json().catch(() => null) };
}, [method, section, value, headers]);
const dbData = async () => (await api('GET', 'all')).body.data;
const original = await dbData();
ok('API отдаёт контент из базы', original?.cases?.length >= 1 && original.services.length === 4 && original.seo.length >= 1 && !!original.hero.ctaText);
const anon = await b.newContext();
ok('API без входа отвечает 401', (await anon.request.get(`${base}/admin/api/content/all`)).status() === 401);
await anon.close();
ok('API отклоняет запрос с чужого сайта', (await ctx.request.put(`${base}/admin/api/content/hero`, {
  headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, data: { value: { ctaText: 'x' } } })).status() === 403);
ok('сервер не принимает слишком длинный текст', (await api('PUT', 'hero', { ctaText: 'x'.repeat(40) })).status === 422);
ok('сервер не даёт удалить все кейсы', (await api('PUT', 'cases', [])).status === 422);

async function restore() {
  for (const sec of ['hero', 'services', 'seo', 'cases']) {
    const r = await api('PUT', sec, original[sec]);
    ok(`данные раздела «${sec}» возвращены как были`, r.status === 200);
  }
}

// ---------- Главный экран ----------
ok('панель сохранения скрыта без правок', await bar.isHidden());
const cta = p.getByLabel('Текст кнопки');
await cta.fill('');
ok('панель сохранения появилась после правки', await bar.isVisible());
await p.click('[data-save]');
ok('пустое поле не сохраняется и подсвечивается', (await cta.getAttribute('aria-invalid')) !== null && (await toast()).includes('Исправьте'));
await cta.fill('Это слишком длинный текст для кнопки');
ok('счётчик символов краснеет при превышении', await p.locator('.adm-field__count.is-over').isVisible());
await cta.fill('Получить консультацию');
ok('предпросмотр кнопки обновляется', (await p.locator('.adm-hero-preview__btn').textContent()) === 'Получить консультацию');
await shot('02-hero');
await p.click('[data-save]');
await p.waitForFunction(() => document.querySelector('[data-savebar]').hidden);
ok('сохранение показывает «Сохранено»', (await toast()).includes('Сохранено'));
await p.reload();
await p.waitForSelector('.adm-section__title');
ok('после перезагрузки текст сохранился', (await p.getByLabel('Текст кнопки').inputValue()) === 'Получить консультацию');

// уход с несохранёнными правками
await p.getByLabel('Текст кнопки').fill('Черновик');
await p.click('[data-nav=services]');
ok('при уходе с правками спрашивает подтверждение', await p.locator('.adm-dialog[open]').waitFor().then(() => true, () => false));
await p.getByRole('button', { name: 'Остаться' }).click();
await p.waitForURL(/#hero$/, { timeout: 2000 }).catch(() => {});
ok('«Остаться» оставляет на месте с правками', p.url().endsWith('#hero') && (await p.getByLabel('Текст кнопки').inputValue()) === 'Черновик');
await p.click('[data-cancel]');
await p.getByRole('button', { name: 'Отменить изменения' }).click();
await p.waitForFunction(() => document.querySelector('[data-savebar]').hidden, null, { timeout: 2000 }).catch(() => {});
ok('«Отменить» возвращает сохранённый текст', (await p.getByLabel('Текст кнопки').inputValue()) === 'Получить консультацию');

// ---------- Услуги ----------
await p.click('[data-nav=services]');
await p.waitForSelector('.adm-service');
ok('4 карточки услуг', (await p.locator('.adm-service').count()) === 4);
const auto = p.locator('.adm-service').first();
await auto.getByLabel('Название').fill('Автоматизация процессов');
await auto.getByRole('button', { name: '+ Добавить пункт' }).click();
ok('новый пункт получает фокус', await p.evaluate(() => document.activeElement?.closest('.adm-item') !== null));
await p.keyboard.type('Новый пункт списка');
await auto.getByRole('button', { name: '+ Добавить пункт' }).click();
await p.keyboard.type('Шестой пункт');
ok('при 6 пунктах кнопка добавления выключена', await auto.getByRole('button', { name: '+ Добавить пункт' }).isDisabled());
await auto.getByRole('button', { name: 'Удалить пункт 6' }).click();
await auto.getByRole('button', { name: 'Поднять пункт 5 выше' }).click();
ok('пункт перемещается вверх', (await auto.getByLabel('Пункт 4', { exact: true }).inputValue()) === 'Новый пункт списка');
await p.locator('.adm-service').nth(3).getByLabel('Текст').fill('Обучим команду за неделю');
await shot('03-services');
await p.click('[data-save]');
await p.waitForFunction(() => document.querySelector('[data-savebar]').hidden);
const saved = await dbData();
ok('услуги сохранены в базе', saved.services[0].title === 'Автоматизация процессов' && saved.services[0].items.length === 5 && saved.services[0].items[3] === 'Новый пункт списка' && saved.services[3].text === 'Обучим команду за неделю');

// ---------- Кейсы ----------
await p.click('[data-nav=cases]');
await p.waitForSelector('.adm-case-row');
ok('в списке 3 кейса', (await p.locator('.adm-case-row').count()) === 3);
ok('в меню выделен только раздел «Кейсы»', (await p.locator('[data-nav][aria-current=page]').count()) === 1 && (await p.locator('[data-nav=cases]').getAttribute('aria-current')) === 'page');
await shot('04-cases');

// правка существующего кейса: «стало» на нарисованной вручную кривой
await p.locator('.adm-case-row').first().getByRole('link', { name: 'Изменить' }).click();
await p.waitForSelector('.adm-case-preview .case');
ok('у старого кейса выбрана форма «Как сейчас»', await p.getByLabel('Как сейчас').isChecked());
await p.getByLabel('Стало').fill('75%');
ok('предпросмотр показывает новое «стало»', await p.waitForFunction(() => [...document.querySelectorAll('.adm-case-preview .chart__tip')].some((t) => t.textContent === '75%'), null, { timeout: 2000 }).then(() => true, () => false));
await p.click('[data-save]');
await p.waitForSelector('.adm-case-row');
let data = await dbData();
const c1 = data.cases[0];
ok('сохранено: подписи на кривой 18% и 75%, форма не изменилась',
  JSON.stringify(c1.chart.points.filter((x) => x.tip).map((x) => x.tip)) === '["18%","75%"]' && c1.chart.points.length === 9 && c1.chart.shape === 'custom');

// новый кейс
await p.getByRole('link', { name: '+ Добавить кейс' }).click();
await p.waitForSelector('.adm-case-preview .case');
await p.click('[data-save]').catch(() => {});
ok('пустой новый кейс не показывает панель сохранения', await bar.isHidden());
await p.getByLabel('Что улучшилось').fill('Выручка');
ok('панель сохранения появилась', await bar.isVisible());
await p.click('[data-save]');
ok('незаполненные поля подсвечены', (await p.locator('.adm-input[aria-invalid]').count()) >= 7);
await p.getByLabel('На сколько').fill('+ 120%');
await p.getByLabel('Тип клиента').fill('Автосалон');
await p.getByLabel('Заголовок').fill('Автосалон удвоил выручку за квартал');
await p.getByLabel('Проблема').fill('Заявки с сайта терялись');
await p.getByLabel('Решение').fill('Подключили сайт и телефонию к amoCRM');
await p.getByLabel('Подпись графика').fill('Выручка');
await p.getByLabel('Было').fill('1 млн');
await p.getByLabel('Стало').fill('2,2 млн');
await p.getByLabel('Резкий рывок').check();
await p.getByLabel('Фиолетовый').check();
await p.waitForFunction(() => document.querySelector('.adm-case-preview .chart--purple'), null, { timeout: 2000 }).catch(() => {});
ok('предпросмотр нового кейса', (await p.locator('.adm-case-preview .case__value').textContent()) === '+ 120%'
  && (await p.locator('.adm-case-preview .chart__tip').allTextContents()).join('|') === '1 млн|2,2 млн'
  && await p.locator('.adm-case-preview .chart--purple').isVisible());
await shot('05-case-new');
await p.click('[data-save]');
await p.waitForSelector('.adm-case-row');
ok('после сохранения 4 кейса, новый последний', (await p.locator('.adm-case-row').count()) === 4
  && (await p.locator('.adm-case-row__title').last().textContent()) === 'Автосалон удвоил выручку за квартал');
ok('счётчик кейсов в меню обновился', (await p.locator('[data-cases-count]').textContent()) === '4');

// порядок
await p.locator('.adm-case-row').last().locator('[data-move=up]').click();
await p.waitForFunction(() => document.querySelectorAll('.adm-case-row__title')[2]?.textContent.startsWith('Автосалон'));
ok('кейс перемещён левее, порядок сохранён', (await dbData()).cases.map((c) => c.order).join() === '1,2,3,4');

// удаление
await p.locator('.adm-case-row').nth(2).getByRole('button', { name: 'Удалить' }).click();
ok('удаление спрашивает подтверждение', await p.locator('.adm-dialog[open]').isVisible());
await p.getByRole('button', { name: 'Отмена' }).click();
ok('«Отмена» ничего не удаляет', (await p.locator('.adm-case-row').count()) === 4);
await p.locator('.adm-case-row').nth(2).getByRole('button', { name: 'Удалить' }).click();
await p.locator('.adm-dialog').getByRole('button', { name: 'Удалить' }).click();
await p.waitForFunction(() => document.querySelectorAll('.adm-case-row').length === 3);
ok('кейс удалён', !(await p.locator('.adm-case-row__title').allTextContents()).some((t) => t.startsWith('Автосалон')));

// несуществующий кейс
await p.goto(`${base}/admin#cases/net-takogo`);
await p.waitForSelector('.adm-section__title');
ok('несуществующий кейс — понятное сообщение', (await p.locator('.adm-section__title').textContent()) === 'Кейс не найден');

// ---------- SEO ----------
await p.goto(`${base}/admin#seo`);
await p.waitForSelector('.adm-snippet');
await p.getByLabel('SEO Title').fill('');
await p.click('[data-save]');
ok('пустой SEO Title не сохраняется', (await p.getByLabel('SEO Title').getAttribute('aria-invalid')) !== null);
await p.getByLabel('SEO Title').fill('Внедрение amoCRM под ключ');
await p.getByLabel('Meta Description').fill('Настроим amoCRM под ваш отдел продаж.');
ok('сниппет обновляется', (await p.locator('.adm-snippet__title').textContent()) === 'Внедрение amoCRM под ключ');
await shot('06-seo');
await p.click('[data-save]');
await p.waitForFunction(() => document.querySelector('[data-savebar]').hidden);
const seo = (await dbData()).seo.find((x) => x.path === '/');
ok('SEO сохранено в базе', seo.title === 'Внедрение amoCRM под ключ' && seo.description === 'Настроим amoCRM под ваш отдел продаж.');

// ---------- Возврат данных ----------
await restore();
await p.goto(`${base}/admin#hero`);
await p.reload(); // смена одного якоря страницу не перезагружает, а нужны свежие данные с сервера
await p.waitForSelector('.adm-section__title');
ok('после возврата в админке исходный текст кнопки', (await p.getByLabel('Текст кнопки').inputValue()) === original.hero.ctaText);

// ---------- Телефон ----------
await p.setViewportSize({ width: 375, height: 760 });
for (const r of ['hero', 'services', 'cases', `cases/${original.cases[0].id}`, 'seo']) {
  await p.goto(`${base}/admin#${r}`);
  await p.waitForSelector('.adm-section__title');
  ok(`телефон 375px, #${r}: нет горизонтальной прокрутки`, (await p.evaluate(() => document.documentElement.scrollWidth)) <= 375);
  await shot(`07-mobile-${r.replace('/', '-')}`);
}

// ---------- Выход ----------
await p.setViewportSize({ width: 1440, height: 900 });
await p.goto(`${base}/admin`);
await p.getByRole('button', { name: 'Выйти' }).click();
await p.waitForURL(/\/admin\/login$/);
await p.goto(`${base}/admin`);
ok('после выхода админка снова закрыта', p.url().endsWith('/admin/login'));

ok(`нет ошибок в консоли${errs.length ? ': ' + errs.join(' | ') : ''}`, errs.length === 0);
await b.close();
