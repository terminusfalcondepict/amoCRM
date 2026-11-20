-- Контент сайта: кейсы, услуги, SEO страниц, текст кнопки первого экрана.
-- Читать может кто угодно (роль anon), записывать — только сервер админки (secret key, роль service_role).
-- Лимиты длины совпадают с LIMITS в src/scripts/admin/validate.js.
-- Запуск: Supabase → SQL Editor → вставить файл целиком → Run. Повторный запуск безопасен.

-- ---------- Общее ----------

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Самая длинная строка массива (для ограничения длины пунктов услуг)
create or replace function public.max_item_length(arr text[]) returns int
language sql immutable set search_path = '' as $$
  select coalesce(max(char_length(x)), 0) from unnest(arr) as x
$$;

-- ---------- Кейсы ----------

create table if not exists public.cases (
  id            text primary key check (id ~ '^[a-z0-9-]{1,64}$'),
  sort_order    int  not null check (sort_order > 0),
  theme         text not null check (theme in ('blue', 'slate')),
  metric_label  text not null check (char_length(metric_label) <= 24),
  metric_value  text not null check (char_length(metric_value) <= 14),
  industry      text not null check (char_length(industry) <= 30),
  title         text not null check (char_length(title) <= 90),
  problem       text not null check (char_length(problem) <= 240),
  solution      text not null check (char_length(solution) <= 240),
  chart_label   text not null default '' check (char_length(chart_label) <= 24),
  chart_color   text not null default 'blue' check (chart_color in ('blue', 'purple')),
  chart_before  text not null default '' check (char_length(chart_before) <= 8),
  chart_after   text not null default '' check (char_length(chart_after) <= 8),
  chart_shape   text not null default 'custom' check (chart_shape ~ '^[a-z-]{1,32}$'),
  chart_points  jsonb not null default '[]' check (jsonb_typeof(chart_points) = 'array'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- проверка в конце транзакции: при смене порядка номера временно совпадают
  constraint cases_sort_order_key unique (sort_order) deferrable initially deferred
);

drop trigger if exists cases_updated_at on public.cases;
create trigger cases_updated_at before update on public.cases
  for each row execute function public.set_updated_at();

-- ---------- Услуги (ровно четыре карточки, у каждой своя вёрстка) ----------

create table if not exists public.services (
  key         text primary key check (key in ('auto', 'integr', 'analytics', 'training')),
  sort_order  int  not null,
  title       text not null check (char_length(title) <= 30),
  items       text[],
  text        text check (char_length(text) <= 200),
  updated_at  timestamptz not null default now(),
  -- у карточки либо список пунктов (2–6 штук до 70 символов), либо один текст
  constraint services_content check (
    (items is not null and text is null and cardinality(items) between 2 and 6 and public.max_item_length(items) <= 70)
    or (items is null and text is not null)
  )
);

drop trigger if exists services_updated_at on public.services;
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- ---------- SEO страниц ----------

create table if not exists public.page_seo (
  path              text primary key check (path ~ '^/'),
  seo_title         text not null check (char_length(seo_title) <= 70),
  meta_description  text not null check (char_length(meta_description) <= 160),
  updated_at        timestamptz not null default now()
);

drop trigger if exists page_seo_updated_at on public.page_seo;
create trigger page_seo_updated_at before update on public.page_seo
  for each row execute function public.set_updated_at();

-- ---------- Настройки сайта (одна строка) ----------

create table if not exists public.site_settings (
  id             smallint primary key default 1 check (id = 1),
  hero_cta_text  text not null check (char_length(hero_cta_text) <= 25),
  updated_at     timestamptz not null default now()
);

drop trigger if exists site_settings_updated_at on public.site_settings;
create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ---------- Сохранение списка кейсов одной транзакцией ----------
-- Принимает весь список в нужном порядке: добавляет новые, обновляет изменённые,
-- удаляет отсутствующие. Номера порядка выставляются заново: 1, 2, 3…

create or replace function public.admin_save_cases(p_cases jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if jsonb_typeof(p_cases) <> 'array' or jsonb_array_length(p_cases) = 0 then
    raise exception 'Нужен хотя бы один кейс';
  end if;

  delete from public.cases
  where id not in (select e->>'id' from jsonb_array_elements(p_cases) as e);

  insert into public.cases (id, sort_order, theme, metric_label, metric_value, industry, title, problem, solution,
                            chart_label, chart_color, chart_before, chart_after, chart_shape, chart_points)
  select r.id, t.n, r.theme, r.metric_label, r.metric_value, r.industry, r.title, r.problem, r.solution,
         r.chart_label, r.chart_color, r.chart_before, r.chart_after, r.chart_shape, r.chart_points
  from jsonb_array_elements(p_cases) with ordinality as t(e, n),
       jsonb_populate_record(null::public.cases, t.e) as r
  on conflict (id) do update set
    sort_order = excluded.sort_order, theme = excluded.theme,
    metric_label = excluded.metric_label, metric_value = excluded.metric_value, industry = excluded.industry,
    title = excluded.title, problem = excluded.problem, solution = excluded.solution,
    chart_label = excluded.chart_label, chart_color = excluded.chart_color,
    chart_before = excluded.chart_before, chart_after = excluded.chart_after,
    chart_shape = excluded.chart_shape, chart_points = excluded.chart_points;
end $$;

-- ---------- Доступ ----------
-- RLS: всем можно только читать. Политик на запись нет — писать может только service_role (secret key),
-- который обходит RLS. Права на таблицы выдаём явно, не полагаясь на настройки проекта по умолчанию.

alter table public.cases         enable row level security;
alter table public.services      enable row level security;
alter table public.page_seo      enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "public read" on public.cases;
drop policy if exists "public read" on public.services;
drop policy if exists "public read" on public.page_seo;
drop policy if exists "public read" on public.site_settings;
create policy "public read" on public.cases         for select to anon, authenticated using (true);
create policy "public read" on public.services      for select to anon, authenticated using (true);
create policy "public read" on public.page_seo      for select to anon, authenticated using (true);
create policy "public read" on public.site_settings for select to anon, authenticated using (true);

revoke all on public.cases, public.services, public.page_seo, public.site_settings from anon, authenticated;
grant select on public.cases, public.services, public.page_seo, public.site_settings to anon, authenticated;
grant all    on public.cases, public.services, public.page_seo, public.site_settings to service_role;

revoke execute on function public.admin_save_cases(jsonb) from public, anon, authenticated;
grant  execute on function public.admin_save_cases(jsonb) to service_role;
