// Мелкие помощники для интерфейса админки. Текст всегда вставляется через textContent,
// поэтому введённый владельцем HTML не выполняется.

/** h('div', { class: 'x', onclick: fn, attrs: { 'aria-label': '…' } }, 'текст', child, [дети]) */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'attrs') for (const [a, av] of Object.entries(v)) { if (av != null && av !== false) el.setAttribute(a, av === true ? '' : av); }
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el[k] = v;
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

let uid = 0;
export const nextId = (p = 'f') => `${p}-${++uid}`;

/**
 * Поле ввода с подписью, подсказкой, счётчиком символов и местом для ошибки.
 * Длину не обрезаем: владелец видит счётчик и понятное сообщение при сохранении.
 */
export function field({ label, hint, value = '', max, multiline = false, rows = 3, placeholder, onInput, wide = false }) {
  const id = nextId();
  const input = multiline
    ? h('textarea', { class: 'adm-input adm-input--area', id, rows, placeholder })
    : h('input', { class: 'adm-input', id, type: 'text', placeholder, attrs: { autocomplete: 'off' } });
  input.value = value;
  if (multiline) {
    // На сайте каждый текст — один абзац: Enter не добавляет перенос, вставленные переносы становятся пробелами
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
    input.addEventListener('input', () => {
      if (/[\r\n]/.test(input.value)) {
        const pos = input.selectionStart;
        input.value = input.value.replace(/\s*[\r\n]+\s*/g, ' ');
        input.setSelectionRange(pos, pos);
      }
    });
  }
  const counter = max ? h('span', { class: 'adm-field__count', attrs: { 'aria-hidden': 'true' } }) : null;
  const error = h('p', { class: 'adm-field__error', id: `${id}-err`, hidden: true, attrs: { role: 'alert' } });
  const hintEl = hint ? h('p', { class: 'adm-field__hint', id: `${id}-hint`, text: hint }) : null;
  if (hintEl) input.setAttribute('aria-describedby', hintEl.id);

  const updateCount = () => {
    if (!counter) return;
    const n = input.value.length;
    counter.textContent = `${n} / ${max}`;
    counter.classList.toggle('is-over', n > max);
  };
  input.addEventListener('input', () => {
    updateCount();
    if (!error.hidden) setError(''); // ошибка уходит, как только человек начал исправлять
    onInput?.(input.value);
  });
  updateCount();

  function setError(msg) {
    error.textContent = msg || '';
    error.hidden = !msg;
    input.toggleAttribute('aria-invalid', !!msg);
    const ids = [hintEl?.id, msg ? error.id : null].filter(Boolean).join(' ');
    if (ids) input.setAttribute('aria-describedby', ids); else input.removeAttribute('aria-describedby');
  }

  const el = h('div', { class: `adm-field${wide ? ' adm-field--wide' : ''}` },
    h('div', { class: 'adm-field__top' }, h('label', { class: 'adm-field__label', attrs: { for: id }, text: label }), counter),
    input, hintEl, error);
  return { el, input, setError, setValue: (v) => { input.value = v; updateCount(); } };
}

/** Группа радиокнопок-карточек. options: [{ value, label, swatch?, render? }] */
export function choice({ legend, name, value, options, onChange, hint }) {
  const fs = h('fieldset', { class: 'adm-choice' }, h('legend', { class: 'adm-field__label', text: legend }));
  const row = h('div', { class: 'adm-choice__row' });
  for (const o of options) {
    const input = h('input', { type: 'radio', name, value: o.value, checked: o.value === value, class: 'adm-choice__input',
      onchange: () => onChange(o.value) });
    row.append(h('label', { class: 'adm-choice__item' }, input,
      h('span', { class: 'adm-choice__box' },
        o.swatch ? h('span', { class: `adm-swatch adm-swatch--${o.swatch}`, attrs: { 'aria-hidden': 'true' } }) : null,
        o.render ? o.render() : null,
        h('span', { class: 'adm-choice__label', text: o.label }))));
  }
  fs.append(row);
  if (hint) fs.append(h('p', { class: 'adm-field__hint', text: hint }));
  return fs;
}

/* ---------- Окно подтверждения ---------- */
let dlg;
export function confirmDialog({ title, text, ok = 'Да', cancel = 'Отмена', danger = false }) {
  if (!dlg) {
    dlg = h('dialog', { class: 'adm-dialog', attrs: { 'aria-labelledby': 'adm-dlg-title' } });
    document.body.append(dlg);
  }
  dlg.replaceChildren(
    h('form', { method: 'dialog', class: 'adm-dialog__body' },
      h('h2', { class: 'adm-dialog__title', id: 'adm-dlg-title', text: title }),
      text ? h('p', { class: 'adm-dialog__text', text }) : null,
      h('div', { class: 'adm-dialog__actions' },
        h('button', { class: 'adm-btn', value: 'cancel', text: cancel, autofocus: true }),
        h('button', { class: `adm-btn ${danger ? 'adm-btn--danger' : 'adm-btn--primary'}`, value: 'ok', text: ok }))));
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((resolve) => dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true }));
}

/* ---------- Уведомления ---------- */
let toasts;
export function toast(message, kind = 'ok') {
  if (!toasts) {
    toasts = h('div', { class: 'adm-toasts', attrs: { role: 'status', 'aria-live': 'polite' } });
    document.body.append(toasts);
  }
  const t = h('div', { class: `adm-toast adm-toast--${kind}`, text: message });
  toasts.append(t);
  setTimeout(() => t.classList.add('is-leaving'), 2800);
  setTimeout(() => t.remove(), 3200);
}

/** Иконка-кнопка с подписью для скринридера и всплывающей подсказкой. */
export const iconBtn = (icon, label, onclick, extra = {}) =>
  h('button', { type: 'button', class: `adm-icon-btn ${extra.class ?? ''}`, title: label, onclick, disabled: extra.disabled,
    attrs: { 'aria-label': label } }, h('span', { attrs: { 'aria-hidden': 'true' }, text: icon }));
