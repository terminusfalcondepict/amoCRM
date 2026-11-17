import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';

// Сайт собирается статически. Только страницы /admin работают на сервере (prerender = false),
// поэтому нужен адаптер Vercel.
export default defineConfig({
  devToolbar: { enabled: false },
  adapter: vercel(),
  env: {
    schema: {
      // Значения лежат в .env.local (локально) и в настройках проекта на Vercel.
      ADMIN_PASSWORD: envField.string({ context: 'server', access: 'secret', optional: true }),
      ADMIN_SESSION_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
