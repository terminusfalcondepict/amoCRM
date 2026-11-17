// Раздел «Услуги»: блок «Комплексное внедрение и развитие amoCRM».
// Карточек всегда четыре (у каждой своя вёрстка), меняются названия и пункты.
import { h, field, iconBtn } from './dom.js';
import { LIMITS, SERVICE_ITEMS, validateServices, trimDeep } from './validate.js';

export function servicesView({ data, onChange }) {
  let saved = structuredClone(data.services);
  let draft = structuredClone(saved);
  let fields = {}; // путь поля → { setError, input }
  let listErrors = {}; // id услуги → элемент ошибки количества пунктов

  const grid = h('div', { class: 'adm-services' });

  function renderAll() {
    fields = {};
    listErrors = {};
    grid.replaceChildren(...draft.map(renderService));
  }

  function renderService(s) {
    const title = field({
      label: 'Название', value: s.title, max: LIMITS.serviceTitle,
      onInput: (v) => { s.title = v; onChange(); },
    });
    fields[`${s.id}.title`] = title;
    const card = h('article', { class: 'adm-card adm-service' },
      h('h2', { class: 'adm-card__title', text: s.title || 'Без названия' }), title.el);
    title.input.addEventListener('input', () => { card.firstChild.textContent = s.title.trim() || 'Без названия'; });

    if (Array.isArray(s.items)) {
      const list = h('ol', { class: 'adm-items' });
      const err = h('p', { class: 'adm-field__error', hidden: true, attrs: { role: 'alert' } });
      listErrors[s.id] = err;
      const addBtn = h('button', { type: 'button', class: 'adm-btn adm-btn--ghost', text: '+ Добавить пункт' });
      const counter = h('p', { class: 'adm-field__hint' });

      const renderItems = (focusIndex) => {
        const n = s.items.length;
        list.replaceChildren(...s.items.map((text, i) => {
          const f = field({
            label: `Пункт ${i + 1}`, value: text, max: LIMITS.serviceItem, multiline: true, rows: 2,
            onInput: (v) => { s.items[i] = v; onChange(); },
          });
          fields[`${s.id}.items.${i}`] = f;
          const move = (to) => {
            [s.items[i], s.items[to]] = [s.items[to], s.items[i]];
            renderItems(to); onChange();
          };
          return h('li', { class: 'adm-item' }, f.el,
            h('div', { class: 'adm-item__tools' },
              iconBtn('↑', `Поднять пункт ${i + 1} выше`, () => move(i - 1), { disabled: i === 0 }),
              iconBtn('↓', `Опустить пункт ${i + 1} ниже`, () => move(i + 1), { disabled: i === n - 1 }),
              iconBtn('✕', `Удалить пункт ${i + 1}`, () => { s.items.splice(i, 1); renderItems(Math.min(i, s.items.length - 1)); onChange(); },
                { class: 'adm-icon-btn--danger', disabled: n <= SERVICE_ITEMS.min })));
        }));
        addBtn.disabled = n >= SERVICE_ITEMS.max;
        counter.textContent = n >= SERVICE_ITEMS.max
          ? `Пунктов: ${n} — это максимум, больше не поместится в карточку.`
          : `Пунктов: ${n}. Можно от ${SERVICE_ITEMS.min} до ${SERVICE_ITEMS.max}.`;
        err.hidden = true;
        if (focusIndex != null && focusIndex >= 0) list.children[focusIndex]?.querySelector('.adm-input')?.focus();
      };

      addBtn.addEventListener('click', () => { s.items.push(''); renderItems(s.items.length - 1); onChange(); });
      renderItems();
      card.append(h('div', { class: 'adm-field__label adm-items__label', text: 'Пункты списка' }), list, err,
        h('div', { class: 'adm-items__foot' }, addBtn, counter));
    } else {
      const text = field({
        label: 'Текст', value: s.text, max: LIMITS.trainingText, multiline: true, rows: 4,
        onInput: (v) => { s.text = v; onChange(); },
      });
      fields[`${s.id}.text`] = text;
      card.append(text.el);
    }
    return card;
  }

  renderAll();

  const el = h('section', { class: 'adm-section' },
    h('header', { class: 'adm-section__head' },
      h('h1', { class: 'adm-section__title', attrs: { tabindex: '-1' }, text: 'Услуги' }),
      h('p', { class: 'adm-section__lead', text: 'Блок «Комплексное внедрение и развитие amoCRM». Можно менять названия карточек и пункты списков.' })),
    grid);

  return {
    el,
    title: 'Услуги',
    section: 'services',
    isDirty: () => JSON.stringify(trimDeep(draft)) !== JSON.stringify(trimDeep(saved)),
    validate() {
      const errors = validateServices(draft);
      for (const [path, f] of Object.entries(fields)) f.setError(errors[path]);
      for (const [id, e] of Object.entries(listErrors)) { e.textContent = errors[`${id}.items`] ?? ''; e.hidden = !errors[`${id}.items`]; }
      const first = Object.keys(errors).map((p) => fields[p]).find(Boolean);
      first?.input.focus();
      return Object.keys(errors).length;
    },
    value: () => trimDeep(draft),
    saved(next) { saved = structuredClone(next.services); draft = structuredClone(saved); renderAll(); },
    reset() { draft = structuredClone(saved); renderAll(); },
  };
}
