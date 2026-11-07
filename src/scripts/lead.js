/**
 * Отправка заявки. Пока заглушка: данные никуда не уходят.
 *
 * Перед запуском для реальных посетителей замените тело функции запросом
 * к серверной функции, которая отправит сообщение в Telegram:
 *
 *   const res = await fetch('/api/lead', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(lead),
 *   });
 *   if (!res.ok) throw new Error('Не удалось отправить заявку');
 *
 * Токен бота хранится только на сервере, в коде страницы его быть не должно.
 */
export async function submitLead(lead) {
  if (import.meta.env.DEV) console.info('[заявка, заглушка]', lead);
}
