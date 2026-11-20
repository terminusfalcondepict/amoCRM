// Публикация изменений: сайт статический, поэтому после сохранения в админке
// запускаем пересборку на Vercel через Deploy Hook. Новая версия появляется через 1–2 минуты.
import { VERCEL_DEPLOY_HOOK_URL } from 'astro:env/server';

/** true — пересборка запущена; false — Vercel не ответил; null — хук не задан (локальная разработка). */
export async function triggerRebuild() {
  if (!VERCEL_DEPLOY_HOOK_URL) return null;
  try {
    const res = await fetch(VERCEL_DEPLOY_HOOK_URL, { method: 'POST', signal: AbortSignal.timeout(8000) });
    return res.ok;
  } catch {
    return false;
  }
}
