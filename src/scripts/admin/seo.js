// Раздел «SEO»: заголовок страницы (<title>) и описание (<meta name="description">) для поисковиков.
import { h, field } from './dom.js';
import { LIMITS, validateSeo, trimDeep } from './validate.js';

const PAGE_NAMES = { '/': 'Главная страница' };

export function seoView({ data, onChange }) {
  let saved = structuredClone(data.seo);
  let draft = structuredClone(saved);
  let fields = {}; // путь поля → { setError, input, setValue }

  const list = h('div', { class: 'adm-seo' });

  function renderPage(pg) {
    const snippetTitle = h('p', { class: 'adm-snippet__title' });
    const snippetText = h('p', { class: 'adm-snippet__text' });
    const paint = () => {
      snippetTitle.textContent = pg.title.trim() || 'Заголовок страницы';
      snippetText.textContent = pg.description.trim() || 'Описание страницы';
    };

    const title = field({
      label: 'SEO Title', value: pg.title, max: LIMITS.seoTitle,
      hint: 'Заголовок во вкладке браузера и в результатах поиска.',
      onInput: (v) => { pg.title = v; paint(); onChange(); },
    });
    const description = field({
      label: 'Meta Description', value: pg.description, max: LIMITS.seoDescription, multiline: true, rows: 3,
      hint: 'Короткое описание под заголовком в поиске. Лучше 120–160 символов.',
      onInput: (v) => { pg.description = v; paint(); onChange(); },
    });
    fields[`${pg.path}.title`] = title;
    fields[`${pg.path}.description`] = description;
    paint();

    return h('article', { class: 'adm-card' },
      h('h2', { class: 'adm-card__title', text: PAGE_NAMES[pg.path] ?? pg.path }),
      h('div', { class: 'adm-split' },
        h('div', {}, title.el, description.el),
        h('figure', { class: 'adm-snippet' },
          h('figcaption', { class: 'adm-preview-label', text: 'Примерно так страница выглядит в поиске' }),
          h('div', { class: 'adm-snippet__box' },
            h('p', { class: 'adm-snippet__url', text: location.host + pg.path }),
            snippetTitle, snippetText))));
  }

  function renderAll() {
    fields = {};
    list.replaceChildren(...draft.map(renderPage));
  }
  renderAll();

  const el = h('section', { class: 'adm-section' },
    h('header', { class: 'adm-section__head' },
      h('h1', { class: 'adm-section__title', attrs: { tabindex: '-1' }, text: 'SEO' }),
      h('p', { class: 'adm-section__lead', text: 'Как страницы сайта называются в поисковиках и во вкладке браузера.' })),
    list);

  return {
    el,
    title: 'SEO',
    section: 'seo',
    isDirty: () => JSON.stringify(trimDeep(draft)) !== JSON.stringify(trimDeep(saved)),
    validate() {
      const errors = validateSeo(draft);
      for (const [path, f] of Object.entries(fields)) f.setError(errors[path]);
      const first = Object.keys(fields).find((p) => errors[p]);
      fields[first]?.input.focus();
      return Object.keys(errors).length;
    },
    value: () => trimDeep(draft),
    saved(next) { saved = structuredClone(next.seo); draft = structuredClone(saved); renderAll(); },
    reset() { draft = structuredClone(saved); renderAll(); },
  };
}
