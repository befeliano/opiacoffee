-- =====================================================================
-- YALNIZCA YEREL GELİŞTİRME (PGlite) İÇİNDİR — Supabase'e uygulanmaz.
-- Supabase'de hazır bulunan rolleri, auth şemasını ve realtime
-- yayınını taklit eder; böylece aynı migration'lar yerelde de çalışır.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  encrypted_password text not null,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;

create schema if not exists local_meta;
create table if not exists local_meta.migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
