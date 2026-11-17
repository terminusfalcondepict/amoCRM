// Вход в админку: пароль из ADMIN_PASSWORD, сессия в подписанной cookie.
// Подпись — HMAC-SHA256 с ключом из ADMIN_SESSION_SECRET и пароля:
// смена любого из них сразу завершает все открытые сессии.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ADMIN_PASSWORD, ADMIN_SESSION_SECRET } from 'astro:env/server';

export const SESSION_COOKIE = 'admin_session';
export const SESSION_TTL_SEC = 7 * 24 * 60 * 60; // неделя

const MIN_SECRET_LEN = 32;

/** Причина, по которой вход невозможен, или null, если всё настроено. */
export function configProblem() {
  if (!ADMIN_PASSWORD) return 'Не задан пароль администратора (ADMIN_PASSWORD).';
  if (!ADMIN_SESSION_SECRET || ADMIN_SESSION_SECRET.length < MIN_SECRET_LEN)
    return `Не задан секрет сессии (ADMIN_SESSION_SECRET, не короче ${MIN_SECRET_LEN} символов).`;
  return null;
}

const sha256 = (s) => createHash('sha256').update(String(s), 'utf8').digest();
const sign = (payload) =>
  createHmac('sha256', `${ADMIN_SESSION_SECRET}\n${ADMIN_PASSWORD}`).update(payload).digest('base64url');

/** Сравнение без утечки по времени: хэши всегда одной длины. */
export function passwordMatches(input) {
  if (configProblem()) return false;
  return timingSafeEqual(sha256(input), sha256(ADMIN_PASSWORD));
}

export function createSessionToken(now = Date.now()) {
  const exp = Math.floor(now / 1000) + SESSION_TTL_SEC;
  const payload = `${exp}.${randomBytes(16).toString('base64url')}`;
  return `${payload}.${sign(payload)}`;
}

export function isValidSessionToken(token, now = Date.now()) {
  if (configProblem() || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [exp, nonce, sig] = parts;
  const expected = Buffer.from(sign(`${exp}.${nonce}`));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  return Number(exp) * 1000 > now;
}

export const sessionCookieOptions = () => ({
  path: '/admin',
  httpOnly: true,
  sameSite: 'strict',
  secure: import.meta.env.PROD,
  maxAge: SESSION_TTL_SEC,
});

/* Защита от подбора: после 5 ошибок с одного адреса — пауза 15 минут.
   Счётчик живёт в памяти процесса: на Vercel он сбрасывается при перезапуске функции,
   поэтому это дополнительная мера, а основная защита — длинный случайный пароль. */
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const fails = new Map();

export function lockedMinutesLeft(ip, now = Date.now()) {
  const f = fails.get(ip);
  if (!f || f.count < MAX_FAILS) return 0;
  const left = f.first + LOCK_MS - now;
  if (left <= 0) { fails.delete(ip); return 0; }
  return Math.ceil(left / 60000);
}

export function registerFail(ip, now = Date.now()) {
  const f = fails.get(ip);
  if (!f || now - f.first > LOCK_MS) fails.set(ip, { count: 1, first: now });
  else f.count++;
  if (fails.size > 5000) fails.clear(); // не даём карте расти бесконечно
}

export const clearFails = (ip) => fails.delete(ip);
