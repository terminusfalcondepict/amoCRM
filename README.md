# Лендинг: внедрение amoCRM

Статический сайт на [Astro](https://astro.build). Контент кейсов и форматов работы редактируется через Decap CMS (`/admin`).

## Запуск

Нужен Node.js LTS (установлен через nvm).

```bash
npm install
npm run dev        # сайт: http://localhost:4321
npm run build      # сборка в dist/
```

## Где что лежит

| Что | Где |
|---|---|
| Разметка страницы и тексты | `src/pages/index.astro` |
| Карточка кейса и график | `src/components/Case.astro`, `src/lib/chart.js` |
| Стили и адаптив | `src/styles/global.css` |
| Интерактив | `src/scripts/main.js` |
| Отправка заявки (пока заглушка) | `src/scripts/lead.js` |
| Кейсы и форматы работы | `src/content/cases/`, `src/content/tariffs/` |
| Настройка админки | `public/admin/config.yml` |
| Исходники картинок из Figma | `design-src/` |

После замены файлов в `design-src/` выполните `npm run images`, чтобы обновить `public/img/`.

## Админка

**Локально:** в одном терминале `npm run dev`, в другом `npm run cms`, затем откройте http://localhost:4321/admin/index.html. Изменения сразу записываются в файлы проекта.

**На хостинге** нужно:
1. Выложить проект в репозиторий GitHub и указать его в `public/admin/config.yml` (`repo: OWNER/REPO`).
2. Подключить хостинг с автосборкой (Netlify, Vercel или Cloudflare Pages): команда `npm run build`, папка `dist`.
3. Настроить вход через GitHub OAuth, см. [документацию Decap](https://decapcms.org/docs/github-backend/). На Netlify это делается в настройках сайта, на других хостингах нужен небольшой OAuth-прокси.

После сохранения в админке сайт пересобирается автоматически, обычно за 1–2 минуты.

## Перед запуском для реальных посетителей

- [ ] Подключить отправку заявок в Telegram: сейчас форма показывает «успех», но данные никуда не уходят. Точка подключения: `src/scripts/lead.js`. Токен бота хранить только на сервере.
- [ ] Добавить документы (политика, согласие, оферта) и сделать ссылки в футере и у формы активными.
- [ ] Проверить черновые тексты этапов 2–4 в `src/pages/index.astro`.
- [ ] Проверить, что лицензия шрифта Involve разрешает использование на сайте.

## Проверка

```bash
npm run dev
node scripts/screens.mjs              # снимки на контрольных ширинах и поиск переполнения
node scripts/test.mjs                 # аккордеон, перетаскивание, форма, якоря
```
