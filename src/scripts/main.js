import { submitLead } from './lead.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Появление блоков и прорисовка графиков при прокрутке */
const toReveal = document.querySelectorAll('.reveal, .chart');
if (reduced || !('IntersectionObserver' in window)) {
  toReveal.forEach((el) => el.classList.add('is-visible'));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );
  toReveal.forEach((el) => io.observe(el));
}

/* Аккордеон этапов: открыт один пункт, повторный клик закрывает */
document.querySelectorAll('[data-accordion]').forEach((root) => {
  const items = [...root.querySelectorAll('.step')];
  items.forEach((item) => {
    item.querySelector('.step__toggle').addEventListener('click', () => {
      const willOpen = !item.classList.contains('is-open');
      items.forEach((other) => {
        other.classList.remove('is-open');
        other.querySelector('.step__toggle').setAttribute('aria-expanded', 'false');
      });
      if (willOpen) {
        item.classList.add('is-open');
        item.querySelector('.step__toggle').setAttribute('aria-expanded', 'true');
      }
    });
  });
});

/* Перетаскивание кейсов мышью. На сенсорных экранах работает обычная прокрутка пальцем. */
document.querySelectorAll('[data-drag]').forEach((track) => {
  let startX = 0;
  let startScroll = 0;
  let dragging = false;
  let moved = false;

  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startScroll = track.scrollLeft;
    track.setPointerCapture(e.pointerId);
  });
  track.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4 && !moved) {
      moved = true;
      track.classList.add('is-dragging');
    }
    if (moved) track.scrollLeft = startScroll - dx;
  });
  const stop = () => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('is-dragging');
  };
  track.addEventListener('pointerup', stop);
  track.addEventListener('pointercancel', stop);
  track.addEventListener('dragstart', (e) => e.preventDefault());
  track.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const card = track.firstElementChild;
    const step = card ? card.getBoundingClientRect().width + 30 : 300;
    track.scrollBy({ left: e.key === 'ArrowRight' ? step : -step, behavior: reduced ? 'auto' : 'smooth' });
  });
});

/* Форма заявки */
const digits = (v) => v.replace(/\D/g, '');

function formatPhone(value) {
  let d = digits(value);
  if (!d) return '';
  if (d[0] === '8') d = `7${d.slice(1)}`;
  if (d[0] !== '7') d = `7${d}`;
  d = d.slice(0, 11);
  let out = '+ 7';
  if (d.length > 1) out += ` ${d.slice(1, 4)}`;
  if (d.length > 4) out += ` (${d.slice(4, 7)}`;
  if (d.length > 7) out += `) ${d.slice(7, 9)}`;
  if (d.length > 9) out += ` - ${d.slice(9, 11)}`;
  return out;
}

document.querySelectorAll('[data-lead-form]').forEach((form) => {
  const phone = form.elements.phone;
  const name = form.elements.name;
  const success = form.querySelector('.form__success');
  const button = form.querySelector('button[type="submit"]');

  const checks = [
    [name, () => name.value.trim().length >= 2],
    [phone, () => digits(phone.value).length === 11],
  ];
  const setError = (input, bad) => {
    const error = input.parentElement.querySelector('.form__error');
    error.hidden = !bad;
    input.setAttribute('aria-invalid', bad ? 'true' : 'false');
  };

  phone.addEventListener('input', () => {
    phone.value = formatPhone(phone.value);
  });
  checks.forEach(([input, ok]) => input.addEventListener('blur', () => {
    if (input.value) setError(input, !ok());
  }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let firstBad = null;
    checks.forEach(([input, ok]) => {
      const bad = !ok();
      setError(input, bad);
      if (bad && !firstBad) firstBad = input;
    });
    if (firstBad) {
      firstBad.focus();
      return;
    }
    button.disabled = true;
    try {
      await submitLead({ name: name.value.trim(), phone: phone.value });
      form.reset();
      success.hidden = false;
    } finally {
      button.disabled = false;
    }
  });
});

/* Мобильное меню */
const burger = document.querySelector('[data-burger]');
const mobileMenu = document.querySelector('[data-mobile-menu]');
if (burger && mobileMenu) {
  const page = document.querySelectorAll('header.hero, main, footer');
  const setOpen = (open) => {
    mobileMenu.classList.toggle('is-open', open);
    mobileMenu.inert = !open;
    page.forEach((el) => { el.inert = open; });
    document.documentElement.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  };
  burger.addEventListener('click', () => setOpen(!mobileMenu.classList.contains('is-open')));
  mobileMenu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('is-open')) {
      setOpen(false);
      burger.focus();
    }
  });
  matchMedia('(min-width: 720px)').addEventListener('change', (e) => {
    if (e.matches) setOpen(false);
  });
}
