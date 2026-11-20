// Правила заполнения. Лимиты подобраны по вёрстке: длиннее — текст ломает карточку или кнопку.

export const LIMITS = {
  ctaText: 25,
  serviceTitle: 30,
  serviceItem: 70,
  trainingText: 200,
  metricLabel: 24,
  metricValue: 14,
  industry: 30,
  title: 90,
  problem: 240,
  solution: 240,
  chartLabel: 24,
  chartValue: 8,
  // SEO: столько поисковики обычно показывают целиком
  seoTitle: 70,
  seoDescription: 160,
};

export const SERVICE_ITEMS = { min: 2, max: 6 };

export function textError(value, max, { required = true } = {}) {
  const v = String(value ?? '').trim();
  if (!v) return required ? 'Заполните это поле' : '';
  if (v.length > max) return `Слишком длинно: ${v.length} из ${max} символов. Сократите текст.`;
  return '';
}

/** Возвращает объект { путь_поля: текст_ошибки } — пустой, если всё верно. */
function collect(pairs) {
  const errors = {};
  for (const [key, msg] of pairs) if (msg) errors[key] = msg;
  return errors;
}

export const validateHero = (hero) => collect([['ctaText', textError(hero.ctaText, LIMITS.ctaText)]]);

export function validateServices(services) {
  const pairs = [];
  for (const s of services) {
    pairs.push([`${s.id}.title`, textError(s.title, LIMITS.serviceTitle)]);
    if (Array.isArray(s.items)) {
      if (s.items.length < SERVICE_ITEMS.min) pairs.push([`${s.id}.items`, `Нужно хотя бы ${SERVICE_ITEMS.min} пункта`]);
      if (s.items.length > SERVICE_ITEMS.max) pairs.push([`${s.id}.items`, `Не больше ${SERVICE_ITEMS.max} пунктов — иначе карточка не поместится`]);
      s.items.forEach((t, i) => pairs.push([`${s.id}.items.${i}`, textError(t, LIMITS.serviceItem)]));
    } else {
      pairs.push([`${s.id}.text`, textError(s.text, LIMITS.trainingText)]);
    }
  }
  return collect(pairs);
}

export function validateCase(c) {
  return collect([
    ['metricLabel', textError(c.metricLabel, LIMITS.metricLabel)],
    ['metricValue', textError(c.metricValue, LIMITS.metricValue)],
    ['industry', textError(c.industry, LIMITS.industry)],
    ['title', textError(c.title, LIMITS.title)],
    ['problem', textError(c.problem, LIMITS.problem)],
    ['solution', textError(c.solution, LIMITS.solution)],
    ['chart.label', textError(c.chart.label, LIMITS.chartLabel)],
    ['chart.before', textError(c.chart.before, LIMITS.chartValue)],
    ['chart.after', textError(c.chart.after, LIMITS.chartValue)],
  ]);
}

export function validateSeo(pages) {
  const pairs = [];
  for (const pg of pages) {
    pairs.push([`${pg.path}.title`, textError(pg.title, LIMITS.seoTitle)]);
    pairs.push([`${pg.path}.description`, textError(pg.description, LIMITS.seoDescription)]);
  }
  return collect(pairs);
}

/** Убирает лишние пробелы по краям во всех строках перед сохранением. */
export function trimDeep(v) {
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) return v.map(trimDeep);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trimDeep(x)]));
  return v;
}
