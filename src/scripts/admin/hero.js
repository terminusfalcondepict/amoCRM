// Раздел «Главный экран»: текст кнопки заявки.
import { h, field } from './dom.js';
import { LIMITS, validateHero, trimDeep } from './validate.js';

export function heroView({ data, onChange }) {
  let saved = structuredClone(data.hero);
  let draft = structuredClone(saved);

  const btn = h('span', { class: 'btn btn--hero adm-hero-preview__btn', attrs: { 'aria-hidden': 'true' } });
  const cta = field({
    label: 'Текст кнопки',
    hint: 'Кнопка на первом экране и в мобильном меню. Ведёт к форме заявки внизу страницы.',
    value: draft.ctaText, max: LIMITS.ctaText, placeholder: 'Например: Оставить заявку',
    onInput: (v) => { draft.ctaText = v; paint(); onChange(); },
  });

  const paint = () => { btn.textContent = draft.ctaText.trim() || 'Текст кнопки'; };
  paint();

  const el = h('section', { class: 'adm-section' },
    h('header', { class: 'adm-section__head' },
      h('h1', { class: 'adm-section__title', attrs: { tabindex: '-1' }, text: 'Главный экран' }),
      h('p', { class: 'adm-section__lead', text: 'Первое, что видит посетитель. Здесь меняется текст главной кнопки.' })),
    h('div', { class: 'adm-card adm-split' },
      h('div', {}, cta.el),
      h('figure', { class: 'adm-hero-preview' },
        h('figcaption', { class: 'adm-preview-label', text: 'Так кнопка выглядит на сайте' }),
        h('div', { class: 'adm-hero-preview__stage' }, btn))));

  return {
    el,
    title: 'Главный экран',
    section: 'hero',
    isDirty: () => JSON.stringify(trimDeep(draft)) !== JSON.stringify(trimDeep(saved)),
    validate() {
      const errors = validateHero(draft);
      cta.setError(errors.ctaText);
      if (errors.ctaText) cta.input.focus();
      return Object.keys(errors).length;
    },
    value: () => trimDeep(draft),
    saved(next) { saved = structuredClone(next.hero); draft = structuredClone(saved); cta.setValue(draft.ctaText); paint(); },
    reset() { draft = structuredClone(saved); cta.setValue(draft.ctaText); cta.setError(''); paint(); },
  };
}
