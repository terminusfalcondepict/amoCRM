// Репозиторий контента сайта (Supabase).
// Наружу отдаёт те же объекты, с которыми раньше работали JSON-файлы и админка:
//   { hero: { ctaText }, services: [...], cases: [...], seo: [{ path, title, description }] }
// Названия колонок в базе (snake_case) переводятся здесь и больше нигде.
import { publicClient, adminClient } from '../supabase/server.js';
import {
  LIMITS, SERVICE_ITEMS, trimDeep, validateCase, validateHero, validateServices, validateSeo,
} from '../../scripts/admin/validate.js';

export const SECTIONS = ['hero', 'services', 'cases', 'seo'];
const SERVICE_KEYS = ['auto', 'integr', 'analytics', 'training'];
const TEXT_SERVICES = new Set(['training']); // карточки с одним текстом вместо списка
const PAGES = ['/']; // страницы, у которых есть SEO-настройки
const MAX_CASES = 30;

/** Ошибка в присланных данных: errors — { путь_поля: текст }. */
export class ValidationError extends Error {
  constructor(errors) {
    super('Данные не прошли проверку');
    this.errors = errors;
  }
}

/* ---------------- Чтение ---------------- */

const caseFromRow = (r) => ({
  id: r.id,
  order: r.sort_order,
  theme: r.theme,
  metricLabel: r.metric_label,
  metricValue: r.metric_value,
  industry: r.industry,
  title: r.title,
  problem: r.problem,
  solution: r.solution,
  chart: {
    label: r.chart_label, color: r.chart_color, before: r.chart_before, after: r.chart_after,
    shape: r.chart_shape, points: r.chart_points ?? [],
  },
});

const serviceFromRow = (r) => (r.items ? { id: r.key, title: r.title, items: r.items } : { id: r.key, title: r.title, text: r.text });

const unwrap = ({ data, error }, what) => {
  if (error) throw new Error(`Supabase: не удалось прочитать ${what}: ${error.message}`);
  return data;
};

/** Весь контент сайта. По умолчанию — публичным ключом (только чтение). */
export async function getContent(db = publicClient()) {
  const [cases, services, seo, settings] = await Promise.all([
    db.from('cases').select('*').order('sort_order'),
    db.from('services').select('*').order('sort_order'),
    db.from('page_seo').select('path, seo_title, meta_description').order('path'),
    db.from('site_settings').select('hero_cta_text').eq('id', 1).maybeSingle(),
  ]);
  const hero = unwrap(settings, 'настройки сайта');
  if (!hero) throw new Error('Supabase: в site_settings нет строки — выполните supabase/seed.sql.');
  return {
    hero: { ctaText: hero.hero_cta_text },
    services: unwrap(services, 'услуги').map(serviceFromRow),
    cases: unwrap(cases, 'кейсы').map(caseFromRow),
    seo: unwrap(seo, 'SEO').map((r) => ({ path: r.path, title: r.seo_title, description: r.meta_description })),
  };
}

/* ---------------- Проверка присланных данных ---------------- */
// Браузер проверяет то же самое, но сервер не доверяет браузеру.

const str = (v) => (typeof v === 'string' ? v : '');
const prefix = (p, errors) => Object.fromEntries(Object.entries(errors).map(([k, v]) => [`${p}.${k}`, v]));

function cleanHero(v) {
  const hero = { ctaText: str(v?.ctaText).trim() };
  return { value: hero, errors: validateHero(hero) };
}

function cleanServices(v) {
  if (!Array.isArray(v) || v.length !== SERVICE_KEYS.length) return { errors: { services: 'Нужны все четыре карточки' } };
  const value = v.map((s, i) => {
    const id = SERVICE_KEYS.includes(s?.id) ? s.id : `#${i}`;
    if (TEXT_SERVICES.has(id)) return { id, title: str(s.title), text: str(s.text) };
    const items = Array.isArray(s?.items) ? s.items.map(str).slice(0, SERVICE_ITEMS.max + 1) : [];
    return { id, title: str(s?.title), items };
  });
  const services = trimDeep(value);
  const errors = validateServices(services);
  const ids = new Set(services.map((s) => s.id));
  if (ids.size !== SERVICE_KEYS.length || !SERVICE_KEYS.every((k) => ids.has(k))) errors.services = 'Неизвестная или повторяющаяся карточка';
  return { value: services, errors };
}

function cleanPoints(points) {
  if (!Array.isArray(points) || points.length > 30) return null;
  const out = [];
  for (const p of points) {
    const x = Number(p?.x);
    const y = Number(p?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) return null;
    const tip = str(p.tip).trim();
    if (tip.length > LIMITS.chartValue) return null;
    out.push(tip ? { x, y, tip } : { x, y });
  }
  return out;
}

function cleanCase(c, i) {
  const ch = c?.chart ?? {};
  const item = trimDeep({
    id: str(c?.id),
    theme: c?.theme === 'slate' ? 'slate' : 'blue',
    metricLabel: str(c?.metricLabel), metricValue: str(c?.metricValue), industry: str(c?.industry),
    title: str(c?.title), problem: str(c?.problem), solution: str(c?.solution),
    chart: {
      label: str(ch.label), color: ch.color === 'purple' ? 'purple' : 'blue',
      before: str(ch.before), after: str(ch.after), shape: str(ch.shape) || 'custom',
    },
  });
  item.chart.points = cleanPoints(ch.points);

  const errors = validateCase(item);
  // «Было/стало» обязательны в редакторе, но у старых кейсов могут быть пустыми — список им сохранять не мешаем
  for (const k of ['before', 'after']) if (!item.chart[k]) delete errors[`chart.${k}`];
  if (!/^[a-z0-9-]{1,64}$/.test(item.id)) errors.id = 'Неверный id кейса';
  if (!/^[a-z-]{1,32}$/.test(item.chart.shape)) errors['chart.shape'] = 'Неверная форма графика';
  if (!item.chart.points) errors['chart.points'] = 'Неверные точки графика';
  return { item, errors: prefix(item.id || `#${i}`, errors) };
}

function cleanCases(v) {
  if (!Array.isArray(v) || v.length === 0) return { errors: { cases: 'Нужен хотя бы один кейс' } };
  if (v.length > MAX_CASES) return { errors: { cases: `Не больше ${MAX_CASES} кейсов` } };
  const all = v.map(cleanCase);
  const errors = Object.assign({}, ...all.map((x) => x.errors));
  if (new Set(all.map((x) => x.item.id)).size !== all.length) errors.cases = 'Повторяющийся id кейса';
  return { value: all.map((x) => x.item), errors };
}

function cleanSeo(v) {
  if (!Array.isArray(v)) return { errors: { seo: 'Неверные данные' } };
  const value = v.map((pg) => trimDeep({ path: str(pg?.path), title: str(pg?.title), description: str(pg?.description) }));
  const errors = validateSeo(value);
  for (const pg of value) if (!PAGES.includes(pg.path)) errors[pg.path || 'seo'] = 'Неизвестная страница';
  if (new Set(value.map((p) => p.path)).size !== value.length) errors.seo = 'Страница указана дважды';
  return { value, errors };
}

const CLEANERS = { hero: cleanHero, services: cleanServices, cases: cleanCases, seo: cleanSeo };

/* ---------------- Запись (только из /admin/api) ---------------- */

const check = ({ error }) => {
  if (error) throw new Error(`Supabase: ${error.message}`);
};

const WRITERS = {
  hero: (db, hero) => db.from('site_settings').upsert({ id: 1, hero_cta_text: hero.ctaText }),

  // upsert — одна SQL-команда, поэтому все четыре карточки сохраняются вместе или не сохраняются вовсе
  services: (db, list) => db.from('services').upsert(list.map((s, i) => ({
    key: s.id, sort_order: i + 1, title: s.title,
    items: TEXT_SERVICES.has(s.id) ? null : s.items,
    text: TEXT_SERVICES.has(s.id) ? s.text : null,
  }))),

  // весь список в нужном порядке, в одной транзакции (см. admin_save_cases в миграции)
  cases: (db, list) => db.rpc('admin_save_cases', {
    p_cases: list.map((c) => ({
      id: c.id, theme: c.theme,
      metric_label: c.metricLabel, metric_value: c.metricValue, industry: c.industry,
      title: c.title, problem: c.problem, solution: c.solution,
      chart_label: c.chart.label, chart_color: c.chart.color, chart_before: c.chart.before,
      chart_after: c.chart.after, chart_shape: c.chart.shape, chart_points: c.chart.points,
    })),
  }),

  seo: (db, pages) => db.from('page_seo').upsert(pages.map((pg) => ({
    path: pg.path, seo_title: pg.title, meta_description: pg.description,
  }))),
};

/** Проверяет и сохраняет раздел. Возвращает весь контент после сохранения. */
export async function saveSection(section, raw) {
  const clean = CLEANERS[section];
  if (!clean) throw new ValidationError({ section: 'Неизвестный раздел' });
  const { value, errors } = clean(raw);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const db = adminClient();
  check(await WRITERS[section](db, value));
  return getContent(db);
}
