// Раздел «Кейсы»: список (#cases) и редактор (#cases/new, #cases/<id>).
// В списке порядок и удаление сохраняются сразу; в редакторе — по кнопке «Сохранить».
import { h, field, choice, iconBtn } from './dom.js';
import { LIMITS, validateCase, trimDeep } from './validate.js';
import { SHAPES, CUSTOM, chartPoints, labelsFromPoints, shapeById } from '../../lib/chart-presets.js';
import { renderCase, shapeThumb } from './case-preview.js';

const byOrder = (list) => [...list].sort((a, b) => a.order - b.order);
const renumber = (list) => list.map((c, i) => ({ ...c, order: i + 1 }));

export function casesView(ctx) {
  return ctx.sub ? editorView(ctx) : listView(ctx);
}

/* ================= Список ================= */

function listView({ getData, commit, confirm, toast }) {
  const list = h('ol', { class: 'adm-cases' });
  let busy = false;

  const head = h('header', { class: 'adm-section__head adm-section__head--row' },
    h('div', {},
      h('h1', { class: 'adm-section__title', attrs: { tabindex: '-1' }, text: 'Кейсы' }),
      h('p', { class: 'adm-section__lead', text: 'Карточки в слайдере «Реальные результаты наших клиентов». На сайте они идут в этом порядке, слева направо.' })),
    h('a', { class: 'adm-btn adm-btn--primary', href: '#cases/new', text: '+ Добавить кейс' }));

  async function run(task, focusSelector) {
    if (busy) return;
    busy = true;
    list.setAttribute('aria-busy', 'true');
    try {
      await task();
    } catch {
      toast('Не получилось сохранить. Попробуйте ещё раз.', 'error');
    } finally {
      busy = false;
      list.removeAttribute('aria-busy');
      render();
      if (focusSelector) list.querySelector(focusSelector)?.focus();
    }
  }

  function render() {
    const cases = byOrder(getData().cases);
    if (!cases.length) {
      list.replaceChildren(h('li', { class: 'adm-empty' },
        h('p', { text: 'Кейсов пока нет — слайдер на сайте будет пустым.' }),
        h('a', { class: 'adm-btn adm-btn--primary', href: '#cases/new', text: '+ Добавить первый кейс' })));
      return;
    }
    list.replaceChildren(...cases.map((c, i) => {
      const move = (to) => run(async () => {
        const next = [...cases];
        [next[i], next[to]] = [next[to], next[i]];
        await commit('cases', renumber(next));
        toast('Порядок сохранён');
      }, `[data-id="${c.id}"] [data-move="${to < i ? 'up' : 'down'}"]`);

      const remove = async () => {
        const ok = await confirm({
          title: 'Удалить кейс?',
          text: `«${c.title}» исчезнет из слайдера на сайте. Восстановить его будет нельзя.`,
          ok: 'Удалить', danger: true,
        });
        if (ok) run(async () => {
          await commit('cases', renumber(cases.filter((x) => x.id !== c.id)));
          toast('Кейс удалён');
        }, '.adm-section__head .adm-btn');
      };

      const up = iconBtn('↑', `Переместить «${c.title}» левее`, () => move(i - 1), { disabled: i === 0 });
      const down = iconBtn('↓', `Переместить «${c.title}» правее`, () => move(i + 1), { disabled: i === cases.length - 1 });
      up.dataset.move = 'up';
      down.dataset.move = 'down';

      return h('li', { class: 'adm-case-row', dataset: { id: c.id } },
        h('span', { class: 'adm-case-row__num', text: String(i + 1), attrs: { 'aria-label': `Позиция ${i + 1}` } }),
        h('span', { class: `adm-swatch adm-swatch--${c.theme === 'slate' ? 'slate' : 'blue'}`, attrs: { 'aria-hidden': 'true' } }),
        h('div', { class: 'adm-case-row__text' },
          h('a', { class: 'adm-case-row__title', href: `#cases/${c.id}`, text: c.title || 'Без заголовка' }),
          h('p', { class: 'adm-case-row__meta', text: [`${c.metricLabel}: ${c.metricValue}`, c.industry].filter(Boolean).join(' · ') })),
        h('div', { class: 'adm-case-row__tools' },
          up, down,
          h('a', { class: 'adm-btn adm-btn--small', href: `#cases/${c.id}`, text: 'Изменить' }),
          h('button', { type: 'button', class: 'adm-btn adm-btn--small adm-btn--danger-ghost', text: 'Удалить', onclick: remove,
            disabled: cases.length <= 1, title: cases.length <= 1 ? 'На сайте должен остаться хотя бы один кейс' : null })));
    }));
  }

  render();
  const el = h('section', { class: 'adm-section' }, head, h('div', { class: 'adm-card adm-card--flush' }, list),
    getData().cases.length === 1 ? h('p', { class: 'adm-field__hint', text: 'Последний кейс удалить нельзя: слайдер на сайте не должен быть пустым.' }) : null);

  return { el, title: 'Кейсы', section: 'cases', isDirty: () => false };
}

/* ================= Редактор ================= */

function normalize(c) {
  const chart = { label: '', color: 'blue', points: [], ...c.chart };
  const fromPoints = labelsFromPoints(chart.points); // для данных, где «было/стало» ещё не заполнены
  chart.before ??= fromPoints.before;
  chart.after ??= fromPoints.after;
  chart.shape ||= chart.points.length ? CUSTOM.id : SHAPES[0].id;
  return { ...c, chart };
}

function blankCase(cases) {
  const last = byOrder(cases).at(-1);
  return {
    id: `case-${Date.now().toString(36)}`,
    order: cases.length + 1,
    theme: last?.theme === 'blue' ? 'slate' : 'blue', // чередуем цвета, как в макете
    metricLabel: '', metricValue: '', industry: '', title: '', problem: '', solution: '',
    chart: { label: '', color: 'blue', before: '', after: '', shape: SHAPES[0].id, points: [] },
  };
}

function editorView({ sub, getData, onChange, navigate }) {
  const cases = getData().cases;
  const isNew = sub === 'new';
  const original = isNew ? null : cases.find((c) => c.id === sub);

  if (!isNew && !original) {
    return {
      el: h('section', { class: 'adm-section' },
        h('a', { class: 'adm-back', href: '#cases', text: '← Все кейсы' }),
        h('h1', { class: 'adm-section__title', attrs: { tabindex: '-1' }, text: 'Кейс не найден' }),
        h('p', { class: 'adm-section__lead', text: 'Возможно, его уже удалили. Вернитесь к списку кейсов.' })),
      title: 'Кейс не найден', section: 'cases', isDirty: () => false,
    };
  }

  let baseline = normalize(structuredClone(original ?? blankCase(cases)));
  // Своя (нарисованная вручную) линия есть только у кейсов с shape = custom
  const hasCustom = baseline.chart.shape === CUSTOM.id && baseline.chart.points.length > 1;
  const prevPoints = hasCustom ? baseline.chart.points : [];
  if (baseline.chart.shape === CUSTOM.id && !hasCustom) baseline.chart.shape = SHAPES[0].id;
  let draft = structuredClone(baseline);
  const fields = {};

  const preview = h('div', { class: 'adm-case-preview' });
  let raf = 0;
  const paint = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => preview.replaceChildren(renderCase(draft, chartPoints(draft.chart, prevPoints))));
  };
  const changed = () => { paint(); onChange(); };

  // Поле, привязанное к пути в объекте кейса: 'title' или 'chart.before'
  const bind = (path, opts) => {
    const [a, b] = path.split('.');
    const f = field({
      ...opts,
      value: b ? draft[a][b] : draft[a],
      onInput: (v) => { if (b) draft[a][b] = v; else draft[a] = v; changed(); },
    });
    fields[path] = f;
    return f.el;
  };

  const shapeOptions = [...(hasCustom ? [{ ...CUSTOM, points: prevPoints }] : []), ...SHAPES].map((sh) => ({
    value: sh.id, label: sh.name,
    render: () => shapeThumb(sh.id === CUSTOM.id ? sh.points : sh.points.map(([x, y]) => ({ x, y }))),
  }));

  const form = h('div', { class: 'adm-editor__form' },
    h('section', { class: 'adm-card' },
      h('h2', { class: 'adm-card__title', text: 'Результат' }),
      h('p', { class: 'adm-card__hint', text: 'Цветная шапка карточки: главный показатель и тип клиента.' }),
      h('div', { class: 'adm-grid-2' },
        bind('metricLabel', { label: 'Что улучшилось', max: LIMITS.metricLabel, hint: 'Например: Конверсия, Прибыль' }),
        bind('metricValue', { label: 'На сколько', max: LIMITS.metricValue, hint: 'Крупная цифра. Например: + 42%' })),
      bind('industry', { label: 'Тип клиента', max: LIMITS.industry, hint: 'Плашка в шапке. Например: Страховое агентство' }),
      choice({
        legend: 'Цвет шапки', name: 'theme', value: draft.theme,
        options: [{ value: 'blue', label: 'Синий', swatch: 'blue' }, { value: 'slate', label: 'Графитовый', swatch: 'slate' }],
        onChange: (v) => { draft.theme = v; changed(); },
      })),

    h('section', { class: 'adm-card' },
      h('h2', { class: 'adm-card__title', text: 'Описание' }),
      bind('title', { label: 'Заголовок', max: LIMITS.title, multiline: true, rows: 2, hint: 'Коротко о главном результате' }),
      bind('problem', { label: 'Проблема', max: LIMITS.problem, multiline: true, rows: 4, hint: 'Что мешало клиенту до внедрения' }),
      bind('solution', { label: 'Решение', max: LIMITS.solution, multiline: true, rows: 4, hint: 'Что вы сделали' })),

    h('section', { class: 'adm-card' },
      h('h2', { class: 'adm-card__title', text: 'График «было → стало»' }),
      h('p', { class: 'adm-card__hint', text: 'Введите два значения и выберите форму линии — график построится сам.' }),
      bind('chart.label', { label: 'Подпись графика', max: LIMITS.chartLabel, hint: 'В левом верхнем углу. Например: Конверсия' }),
      h('div', { class: 'adm-grid-2' },
        bind('chart.before', { label: 'Было', max: LIMITS.chartValue, hint: 'Например: 18%' }),
        bind('chart.after', { label: 'Стало', max: LIMITS.chartValue, hint: 'Например: 60%' })),
      choice({
        legend: 'Форма линии', name: 'shape', value: draft.chart.shape, options: shapeOptions,
        hint: hasCustom ? '«Как сейчас» — линия, нарисованная для этого кейса вручную.' : null,
        onChange: (v) => { draft.chart.shape = v; changed(); },
      }),
      choice({
        legend: 'Цвет линии', name: 'color', value: draft.chart.color,
        options: [{ value: 'blue', label: 'Синий', swatch: 'line-blue' }, { value: 'purple', label: 'Фиолетовый', swatch: 'line-purple' }],
        onChange: (v) => { draft.chart.color = v; changed(); },
      })));

  paint();

  const el = h('section', { class: 'adm-section' },
    h('a', { class: 'adm-back', href: '#cases', text: '← Все кейсы' }),
    h('header', { class: 'adm-section__head' },
      h('h1', { class: 'adm-section__title', attrs: { tabindex: '-1' }, text: isNew ? 'Новый кейс' : 'Редактирование кейса' }),
      isNew ? h('p', { class: 'adm-section__lead', text: 'Кейс появится последним в слайдере. Порядок можно поменять в списке кейсов.' }) : null),
    h('div', { class: 'adm-editor' }, form,
      h('aside', { class: 'adm-editor__preview', attrs: { 'aria-label': 'Предпросмотр карточки' } },
        h('p', { class: 'adm-preview-label', text: 'Так карточка будет выглядеть на сайте' }), preview)));

  return {
    el,
    title: isNew ? 'Новый кейс' : 'Редактирование кейса',
    section: 'cases',
    isDirty: () => JSON.stringify(trimDeep(draft)) !== JSON.stringify(trimDeep(baseline)),
    validate() {
      const errors = validateCase(draft);
      for (const [path, f] of Object.entries(fields)) f.setError(errors[path]);
      const first = Object.keys(fields).find((p) => errors[p]); // по порядку полей на экране
      fields[first]?.input.focus();
      return Object.keys(errors).length;
    },
    value() {
      const item = trimDeep(draft);
      const shape = shapeById(item.chart.shape) ? item.chart.shape : CUSTOM.id;
      item.chart = { ...item.chart, shape, points: chartPoints(item.chart, prevPoints) };
      const all = byOrder(getData().cases);
      const next = isNew ? [...all, item] : all.map((c) => (c.id === item.id ? item : c));
      return renumber(next);
    },
    saved() {
      baseline = structuredClone(draft);
      navigate('cases');
    },
    reset() {
      draft = structuredClone(baseline);
      navigate(isNew ? 'cases/new' : `cases/${sub}`, { force: true });
    },
  };
}
