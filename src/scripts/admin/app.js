// Каркас админки: разделы по адресу (#hero, #services, #cases, #cases/<id>, #seo),
// панель «Сохранить / Отменить», защита от потери несохранённых правок.
import { createStore } from './store.js';
import { confirmDialog, toast } from './dom.js';
import { heroView } from './hero.js';
import { servicesView } from './services.js';
import { casesView } from './cases.js';
import { seoView } from './seo.js';

const ROUTES = { hero: heroView, services: servicesView, cases: casesView, seo: seoView };
const DEFAULT = 'hero';

const $ = (sel) => document.querySelector(sel);
const main = $('#adm-main');
const bar = $('[data-savebar]');
const saveBtn = $('[data-save]');
const cancelBtn = $('[data-cancel]');

const seedEl = $('#admin-seed'); // нет, если сервер не смог прочитать базу — тогда на странице уже текст ошибки
const store = createStore(seedEl ? JSON.parse(seedEl.textContent) : null);
let data = null;
let view = null;
let route = '';
let restoring = false;
let saving = false;

const parse = (hash) => {
  const [section, ...rest] = hash.replace(/^#\/?/, '').split('/');
  return ROUTES[section] ? { section, sub: rest.join('/') || '' } : { section: DEFAULT, sub: '' };
};

function navigate(path, { force = false } = {}) {
  const hash = `#${path}`;
  if (location.hash === hash) { if (force) render(); return; }
  location.hash = hash; // дальше сработает hashchange
}

const dirty = () => !!view?.isDirty?.();

function syncBar() {
  const show = dirty() || saving;
  bar.hidden = !show;
  document.body.classList.toggle('has-savebar', show);
  saveBtn.disabled = saving;
  cancelBtn.disabled = saving;
  saveBtn.textContent = saving ? 'Сохраняем…' : 'Сохранить';
}

function render() {
  const { section, sub } = parse(location.hash);
  route = location.hash;
  view = ROUTES[section]({
    data, sub,
    getData: () => data,
    onChange: syncBar,
    navigate,
    confirm: confirmDialog,
    toast,
    commit: async (key, value) => { data = await store.save(key, value); return data; },
  });
  main.replaceChildren(view.el);
  document.title = `${view.title} — админка`;
  for (const a of document.querySelectorAll('[data-nav]')) {
    if (a.dataset.nav === section) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  const count = $('[data-cases-count]');
  if (count) count.textContent = String(data.cases.length);
  syncBar();
  main.querySelector('h1')?.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

async function save() {
  if (!view?.validate || saving) return;
  const errors = view.validate();
  if (errors) {
    toast(errors === 1 ? 'Исправьте поле, отмеченное красным' : `Исправьте поля, отмеченные красным: ${errors}`, 'error');
    return;
  }
  saving = true;
  syncBar();
  try {
    data = await store.save(view.section, view.value());
    saving = false;
    view.saved?.(data);
    toast('Сохранено');
  } catch (e) {
    saving = false;
    if (e?.status !== 401) toast('Не получилось сохранить. Попробуйте ещё раз.', 'error');
  }
  syncBar();
  const count = $('[data-cases-count]');
  if (count) count.textContent = String(data.cases.length);
}

async function cancel() {
  const ok = await confirmDialog({ title: 'Отменить изменения?', text: 'Все правки с последнего сохранения пропадут.', ok: 'Отменить изменения', cancel: 'Продолжить редактирование', danger: true });
  if (!ok) return;
  view.reset?.();
  syncBar();
}

/* Переход в другой раздел с несохранёнными правками — спрашиваем. */
window.addEventListener('hashchange', async () => {
  if (!data) return;
  if (restoring) { restoring = false; return; }
  if (dirty()) {
    const ok = await confirmDialog({
      title: 'Уйти без сохранения?', text: 'На этой странице есть несохранённые изменения. Они пропадут.',
      ok: 'Уйти без сохранения', cancel: 'Остаться', danger: true,
    });
    if (!ok) { restoring = true; location.hash = route || `#${DEFAULT}`; return; }
  }
  render();
});

window.addEventListener('beforeunload', (e) => { if (dirty()) e.preventDefault(); });
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (dirty()) save(); }
});
saveBtn.addEventListener('click', save);
cancelBtn.addEventListener('click', cancel);

/* Запуск */
(async () => {
  if (!seedEl) { document.body.classList.remove('is-loading'); return; }
  data = await store.load();
  if (!location.hash) history.replaceState(null, '', `#${DEFAULT}`);
  render();
  document.body.classList.remove('is-loading');
})();
