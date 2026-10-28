-- =====================================================================
-- Adisyon · Yağmur uyarısı (radar nowcast)
-- =====================================================================
-- * Supabase Edge Function "rain-check" 5 dakikada bir (pg_cron) RainViewer
--   radarından kafe konumu için yağış varış süresini hesaplar ve
--   public.rain_report ile yazar. Vercel'e yük binmez.
-- * Tabletler public.rain_status satırını Realtime ile dinler; uyarı açılınca
--   ekranda şerit çıkar. "Masaları topladık" (rain_ack) o kafedeki bütün
--   cihazlarda kapatır.
-- * Uyarı yaşam döngüsü: yağış yaklaşınca açılır; onaylanınca kapanır;
--   30 dk boyunca tehdit görülmezse sıfırlanır (sonraki yağış yeni uyarı).
-- Veri silmez.
-- =====================================================================

alter table public.cafes
  add column if not exists lat numeric(9, 6) check (lat between -85 and 85),
  add column if not exists lon numeric(9, 6) check (lon between -180 and 180),
  add column if not exists rain_warn_min integer not null default 15 check (rain_warn_min between 5 and 60);

create table if not exists public.rain_status (
  cafe_id uuid primary key references public.cafes (id) on delete cascade,
  checked_at timestamptz not null,
  frame_at timestamptz,
  frame_age_min numeric(6, 1),
  stale boolean not null default false,
  -- kontrol anından itibaren dakika; 0 = şu an yağıyor
  eta_min integer,
  nearest_km numeric(7, 1),
  speed_kmh integer,
  from_deg integer,
  alert_since timestamptz,
  last_alert_seen timestamptz,
  ack_at timestamptz,
  ack_by text not null default ''
);

alter table public.rain_status enable row level security;
revoke all on public.rain_status from anon, authenticated;
-- Realtime ve tarayıcıdan okuma: yalnızca kafe üyeleri, yalnızca okuma
grant select on public.rain_status to authenticated;
drop policy if exists rain_status_select_member on public.rain_status;
create policy rain_status_select_member on public.rain_status
  for select to authenticated
  using (private.is_member(cafe_id));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rain_status'
     ) then
    alter publication supabase_realtime add table public.rain_status;
  end if;
end
$$;

-- Edge Function'ın kontrol edeceği kafeler (yalnızca service_role)
create or replace function public.rain_targets()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'cafe_id', c.id, 'lat', c.lat, 'lon', c.lon, 'warn_min', c.rain_warn_min
  ) order by c.slug), '[]'::jsonb)
  from public.cafes c
  where c.lat is not null and c.lon is not null
$$;

-- Edge Function'dan gelen ölçüm; uyarı yaşam döngüsünü yürütür (yalnızca service_role)
create or replace function public.rain_report(p_cafe uuid, p_status jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_alert boolean := coalesce((p_status ->> 'alert')::boolean, false);
  v_row public.rain_status;
  v_cooldown interval := interval '30 minutes';
begin
  insert into public.rain_status (cafe_id, checked_at)
  values (p_cafe, now())
  on conflict (cafe_id) do nothing;

  select * into v_row from public.rain_status where cafe_id = p_cafe for update;

  if v_alert then
    v_row.last_alert_seen := now();
    if v_row.alert_since is null then
      v_row.alert_since := now();
      v_row.ack_at := null;
      v_row.ack_by := '';
    end if;
  elsif v_row.alert_since is not null and now() - coalesce(v_row.last_alert_seen, v_row.alert_since) > v_cooldown then
    v_row.alert_since := null;
    v_row.ack_at := null;
    v_row.ack_by := '';
  end if;

  update public.rain_status
  set checked_at = now(),
      frame_at = to_timestamp((p_status ->> 'frameTime')::double precision),
      frame_age_min = (p_status ->> 'frameAgeMin')::numeric,
      stale = coalesce((p_status ->> 'stale')::boolean, false),
      eta_min = (p_status ->> 'etaMin')::integer,
      nearest_km = (p_status ->> 'nearestKm')::numeric,
      speed_kmh = (p_status ->> 'speedKmh')::integer,
      from_deg = (p_status ->> 'fromDeg')::integer,
      alert_since = v_row.alert_since,
      last_alert_seen = v_row.last_alert_seen,
      ack_at = v_row.ack_at,
      ack_by = v_row.ack_by
  where cafe_id = p_cafe
  returning * into v_row;

  return to_jsonb(v_row);
end
$$;

-- "Masaları topladık": uyarıyı o kafedeki bütün cihazlarda kapatır
create or replace function public.rain_ack(p_cafe uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  perform private.require_role(p_cafe, 'staff');
  update public.rain_status
  set ack_at = now(),
      ack_by = coalesce((
        select m.display_name from public.cafe_members m where m.cafe_id = p_cafe and m.user_id = v_uid
      ), '')
  where cafe_id = p_cafe and alert_since is not null and ack_at is null;
end
$$;

revoke all on function public.rain_targets() from public, anon, authenticated;
revoke all on function public.rain_report(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.rain_ack(uuid) from public, anon;
grant execute on function public.rain_ack(uuid) to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.rain_targets() to service_role;
    grant execute on function public.rain_report(uuid, jsonb) to service_role;
  end if;
end
$$;


-- Supabase dışı sürümler (yerel, MySQL) Realtime yerine sunucu eylemiyle okur
create or replace function public.rain_get(p_cafe uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role(p_cafe, 'staff');
  return (select to_jsonb(r) from public.rain_status r where r.cafe_id = p_cafe);
end
$$;
revoke all on function public.rain_get(uuid) from public, anon;
grant execute on function public.rain_get(uuid) to authenticated;
