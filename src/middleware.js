// Закрывает всё под /admin, кроме страницы входа. Публичный сайт не затрагивается.
import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, isValidSessionToken } from './lib/admin/auth.js';

const isAdmin = (p) => p === '/admin' || p.startsWith('/admin/');
const isLogin = (p) => p.replace(/\/$/, '') === '/admin/login';

export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname;
  if (!isAdmin(path)) return next();

  if (!isLogin(path) && !isValidSessionToken(ctx.cookies.get(SESSION_COOKIE)?.value)) {
    // API отвечает кодом, а не страницей входа: админка покажет понятную ошибку
    if (path.startsWith('/admin/api/')) {
      return new Response(JSON.stringify({ error: 'Сессия истекла, войдите снова' }), {
        status: 401, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    return ctx.redirect('/admin/login', 303);
  }

  const res = await next();
  try {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('Referrer-Policy', 'same-origin');
  } catch {
    // у некоторых ответов (редиректы) заголовки неизменяемые — это не страшно
  }
  return res;
});
