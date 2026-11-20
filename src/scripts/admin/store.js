// Хранилище контента админки: данные в Supabase, запись через /admin/api/content/<раздел>.
// Интерфейс (load / save, всё асинхронно) тот же, что был у mock-версии, — экраны о базе не знают.
// Стартовые данные сервер кладёт прямо в страницу, поэтому load() не делает лишний запрос.
import { toast } from './dom.js';

const clone = (v) => structuredClone(v);

export class SaveError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export function createStore(initial) {
  let current = clone(initial);

  return {
    async load() {
      return clone(current);
    },

    /** section: 'hero' | 'services' | 'cases' | 'seo'. Возвращает весь контент после сохранения. */
    async save(section, value) {
      let res;
      try {
        res = await fetch(`/admin/api/content/${section}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
          credentials: 'same-origin',
        });
      } catch {
        throw new SaveError('Нет связи с сервером', 0);
      }
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        toast('Сессия истекла — войдите снова. Несохранённые правки пропадут.', 'error');
        setTimeout(() => { location.href = '/admin/login'; }, 2500);
      }
      if (!res.ok) throw new SaveError(body.error || 'Не удалось сохранить', res.status, body.errors);
      if (body.published === false) {
        toast('Сохранено в базе, но пересборка сайта не запустилась. Сообщите разработчику.', 'error');
      }
      current = body.data;
      return clone(current);
    },
  };
}
