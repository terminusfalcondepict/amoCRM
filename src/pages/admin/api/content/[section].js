// API админки: GET — весь контент, PUT /admin/api/content/<hero|services|cases|seo> — сохранить раздел.
// Сессию проверяет src/middleware.js (без входа — 401). Здесь дополнительно сверяем Origin.
import { SECTIONS, ValidationError, getContent, saveSection } from '../../../../lib/content/repo.js';
import { triggerRebuild } from '../../../../lib/content/publish.js';

export const prerender = false;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

/** Запрос пришёл со страниц этого же сайта (защита от подделки запроса с чужого сайта). */
function sameOrigin(request, url) {
  const origin = request.headers.get('origin');
  if (origin) {
    try { return new URL(origin).host === url.host; } catch { return false; }
  }
  return request.headers.get('sec-fetch-site') === 'same-origin';
}

export async function GET() {
  try {
    return json({ data: await getContent() });
  } catch (e) {
    console.error(e);
    return json({ error: 'Не удалось загрузить данные' }, 500);
  }
}

export async function PUT({ params, request, url }) {
  if (!sameOrigin(request, url)) return json({ error: 'Запрос отклонён' }, 403);
  if (!SECTIONS.includes(params.section)) return json({ error: 'Неизвестный раздел' }, 404);

  let body;
  try {
    if (Number(request.headers.get('content-length') || 0) > 200_000) return json({ error: 'Слишком большой запрос' }, 413);
    body = await request.json();
  } catch {
    return json({ error: 'Неверный формат данных' }, 400);
  }

  try {
    const data = await saveSection(params.section, body?.value);
    const published = await triggerRebuild();
    return json({ data, published });
  } catch (e) {
    if (e instanceof ValidationError) return json({ error: 'Данные не прошли проверку', errors: e.errors }, 422);
    console.error(e);
    return json({ error: 'Не удалось сохранить' }, 500);
  }
}
