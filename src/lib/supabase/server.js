// Клиенты Supabase. Только для сервера и сборки — в браузер ключи не попадают.
//  publicClient — publishable key, права роли anon: только чтение (RLS).
//  adminClient  — secret key, запись. Используется лишь в /admin/api после проверки сессии.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY } from 'astro:env/server';

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
let pub;
let adm;

export function publicClient() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Supabase не настроен: задайте SUPABASE_URL и SUPABASE_PUBLISHABLE_KEY.');
  }
  return (pub ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, options));
}

export function adminClient() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error('Запись в Supabase не настроена: задайте SUPABASE_SECRET_KEY.');
  }
  return (adm ??= createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, options));
}
