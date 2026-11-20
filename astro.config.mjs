import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';

// Сайт собирается статически: контент читается из Supabase во время сборки.
// Только страницы /admin работают на сервере (prerender = false), поэтому нужен адаптер Vercel.
export default defineConfig({
  devToolbar: { enabled: false },
  adapter: vercel(),
  env: {
    schema: {
      // Значения лежат в .env.local (локально) и в настройках проекта на Vercel.
      ADMIN_PASSWORD: envField.string({ context: 'server', access: 'secret', optional: true }),
      ADMIN_SESSION_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Supabase: контент сайта. Publishable — чтение (сборка сайта), secret — запись из админки.
      SUPABASE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      SUPABASE_PUBLISHABLE_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      SUPABASE_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Vercel → Settings → Git → Deploy Hooks: пересборка сайта после сохранения в админке
      VERCEL_DEPLOY_HOOK_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
