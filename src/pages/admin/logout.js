// Выход: удаляем cookie сессии. Только POST, чтобы выход не срабатывал от случайной ссылки.
import { SESSION_COOKIE } from '../../lib/admin/auth.js';

export const prerender = false;

export function POST({ cookies, redirect }) {
  cookies.delete(SESSION_COOKIE, { path: '/admin' });
  return redirect('/admin/login', 303);
}
