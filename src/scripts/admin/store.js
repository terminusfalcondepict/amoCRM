// Mock-хранилище контента админки.
// Интерфейс (load / save / reset, всё асинхронно) повторяет будущий серверный API:
// чтобы подключить базу данных, достаточно заменить этот модуль, не трогая экраны.
// Пока данные лежат в localStorage этого браузера и на публичный сайт не попадают.

const KEY = 'crm-admin-mock-v1';
const VERSION = 1;
const LATENCY_MS = 250; // имитация сети, чтобы были видны состояния «Сохраняем…»

const wait = () => new Promise((r) => setTimeout(r, LATENCY_MS));
const clone = (v) => structuredClone(v);

export function createStore(seed) {
  let persistent = true;
  let current = null;
  const fresh = () => ({ version: VERSION, updatedAt: null, ...clone(seed) });

  const read = () => {
    try {
      const raw = localStorage.getItem(KEY);
      const data = raw ? JSON.parse(raw) : null;
      return data?.version === VERSION ? data : null;
    } catch {
      persistent = false;
      return null;
    }
  };
  const write = (data) => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { persistent = false; }
  };

  return {
    /** false, если браузер не даёт сохранять (приватный режим и т. п.) */
    get persistent() { return persistent; },

    async load() {
      await wait();
      current = read() ?? fresh();
      return clone(current);
    },

    /** section: 'hero' | 'services' | 'cases' */
    async save(section, value) {
      await wait();
      current = { ...current, [section]: clone(value), updatedAt: new Date().toISOString() };
      write(current);
      return clone(current);
    },

    async reset() {
      await wait();
      try { localStorage.removeItem(KEY); } catch { /* нечего удалять */ }
      current = fresh();
      return clone(current);
    },
  };
}
