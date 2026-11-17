// Предпросмотр карточки кейса. Разметка повторяет src/components/Case.astro,
// стили берутся из global.css — поэтому карточка выглядит так же, как на сайте.
import { h } from './dom.js';
import { buildChart } from '../../lib/chart.js';
import { nb } from '../../lib/typo.js';

const SVG = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}) => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

let gradSeq = 0;

export function renderCase(item, points) {
  const chart = buildChart(points);
  const color = item.chart.color === 'purple' ? 'purple' : 'blue';
  const gid = `adm-grad-${++gradSeq}`;
  const or = (v, fallback) => (String(v ?? '').trim() ? v : fallback);

  const svg = s('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  const grad = s('linearGradient', { id: gid, x1: '0', y1: '0', x2: '0', y2: '1' });
  grad.append(s('stop', { offset: '0', 'stop-color': 'currentColor', 'stop-opacity': '.2' }),
    s('stop', { offset: '1', 'stop-color': 'currentColor', 'stop-opacity': '.04' }));
  const defs = s('defs');
  defs.append(grad);
  svg.append(defs,
    s('path', { class: 'chart__area', d: chart.area, fill: `url(#${gid})` }),
    s('path', { class: 'chart__line', d: chart.line, fill: 'none', stroke: 'currentColor', 'vector-effect': 'non-scaling-stroke' }));

  return h('article', { class: `case case--${item.theme === 'slate' ? 'slate' : 'blue'}` },
    h('header', { class: 'case__head' },
      h('div', {},
        h('p', { class: 'case__label', text: or(item.metricLabel, 'Что улучшилось') }),
        h('p', { class: 'case__value', text: or(item.metricValue, '+ 0%') })),
      h('p', { class: 'case__tag', text: or(item.industry, 'Отрасль') })),
    h('div', { class: 'case__body' },
      h('h3', { class: 'case__title', text: nb(or(item.title, 'Заголовок кейса')) }),
      h('div', { class: 'case__point' },
        h('h4', { class: 'case__point-title', text: 'Проблема' }),
        h('p', { class: 'case__text', text: nb(or(item.problem, 'Опишите, что мешало клиенту')) })),
      h('div', { class: 'case__point' },
        h('h4', { class: 'case__point-title', text: 'Решение' }),
        h('p', { class: 'case__text', text: nb(or(item.solution, 'Опишите, что вы сделали')) }))),
    h('div', { class: `chart chart--${color} is-visible`, attrs: { role: 'img', 'aria-label': `График: ${item.chart.label ?? ''}` } },
      h('div', { class: 'chart__plot' }, h('p', { class: 'chart__label', text: item.chart.label }), svg),
      chart.tips.map((t) => h('div', { class: 'chart__marker', style: `left:${t.x}%;top:${t.y}%` },
        h('span', { class: 'chart__tip', text: t.tip })))));
}

/** Маленькая картинка формы линии для выбора варианта. */
export function shapeThumb(points) {
  const { line } = buildChart(points);
  const svg = s('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', class: 'adm-shape-thumb', 'aria-hidden': 'true' });
  svg.append(s('path', { d: line, fill: 'none', stroke: 'currentColor', 'stroke-width': '3', 'vector-effect': 'non-scaling-stroke' }));
  return svg;
}
