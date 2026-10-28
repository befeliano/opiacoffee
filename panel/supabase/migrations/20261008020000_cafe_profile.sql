-- =====================================================================
-- Adisyon · 03 · Kafe profili ve çalışma düzeni
-- =====================================================================
-- * Kafe profili: logo (küçük resim, data: URL), para birimi, arayüz dili.
--   Renk paleti (theme) zaten vardı; artık ayarlardan değişir.
-- * "Açılış/kapanışta kasa sorulsun mu?" (cash_count):
--     kapalı (varsayılan) → kafe çalışma saatlerinde kendiliğinden açık
--                           sayılır, satış için gün açmak gerekmez;
--     açık                → satıştan önce "Kafeyi aç" (açılış nakdi), gece
--                           "Kafeyi kapat" (sayılan nakit + POS toplamı,
--                           beklenenle kıyas, "Pas geç" seçeneği).
-- * app_brand(): giriş ekranı için kafenin adı, rengi ve logosu (oturumsuz).
-- =====================================================================

alter table public.cafes
  add column if not exists logo text,
  add column if not exists currency text not null default 'TRY',
  add column if not exists language text not null default 'tr',
  add column if not exists cash_count boolean not null default false;

alter table public.cafes drop constraint if exists cafes_logo_check;
alter table public.cafes add constraint cafes_logo_check
  check (logo is null or (logo ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' and octet_length(logo) <= 200000));
alter table public.cafes drop constraint if exists cafes_currency_check;
alter table public.cafes add constraint cafes_currency_check check (currency ~ '^[A-Z]{3}$');
alter table public.cafes drop constraint if exists cafes_language_check;
alter table public.cafes add constraint cafes_language_check check (language in ('tr', 'en'));

-- ---------------------------------------------------------------------
-- Satış kilidi: yalnızca kasa sayımı açıksa gün açılmış olmalı
-- ---------------------------------------------------------------------
create or replace function private.require_open_day(p_cafe uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if (select c.cash_count from public.cafes c where c.id = p_cafe)
     and not exists (select 1 from public.cafe_days d where d.cafe_id = p_cafe and d.closed_at is null) then
    raise exception 'E_DAY_CLOSED';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- Bağlam: profil alanları da gelir
-- ---------------------------------------------------------------------
create or replace function public.app_cafe_context(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'E_NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select jsonb_build_object(
    'cafe', jsonb_build_object(
      'id', c.id,
      'slug', c.slug,
      'name', c.name,
      'timezone', c.timezone,
      'card_commission_rate', c.card_commission_rate,
      'ticket_commission_rate', c.ticket_commission_rate,
      'vat_rate', c.vat_rate,
      'open_hour', c.open_hour,
      'close_hour', c.close_hour,
      'theme', c.theme,
      'logo', c.logo,
      'currency', c.currency,
      'language', c.language,
      'cash_count', c.cash_count
    ),
    'role', m.role,
    'user', jsonb_build_object(
      'id', v_uid,
      'email', (select u.email from auth.users u where u.id = v_uid),
      'display_name', m.display_name
    ),
    'cafes', public.app_my_cafes()
  )
  into v_result
  from public.cafes c
  join public.cafe_members m on m.cafe_id = c.id and m.user_id = v_uid
  where c.slug = p_slug;

  if v_result is null then
    raise exception 'E_FORBIDDEN' using errcode = '42501';
  end if;
  return v_result;
end
$$;

-- ---------------------------------------------------------------------
-- Ayarlar: eksik anahtar = değişmez (profil ve çalışma düzeni ayrı kaydedilir)
-- ---------------------------------------------------------------------
create or replace function public.cafe_update_settings(p_cafe uuid, p_settings jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := private.clean_text(p_settings ->> 'name', 80);
  v_rate numeric := round((p_settings ->> 'card_commission_rate')::numeric, 4);
  v_ticket numeric := round((p_settings ->> 'ticket_commission_rate')::numeric, 4);
  v_vat numeric := round((p_settings ->> 'vat_rate')::numeric, 4);
  v_open smallint := (p_settings ->> 'open_hour')::smallint;
  v_close smallint := (p_settings ->> 'close_hour')::smallint;
  v_tz text := nullif(p_settings ->> 'timezone', '');
  v_theme text := nullif(p_settings ->> 'theme', '');
  v_currency text := upper(nullif(p_settings ->> 'currency', ''));
  v_language text := nullif(p_settings ->> 'language', '');
  v_cash_count boolean := (p_settings ->> 'cash_count')::boolean;
begin
  perform private.require_role(p_cafe, 'owner');
  if p_settings ? 'name' and v_name = '' then
    raise exception 'E_NAME_REQUIRED';
  end if;
  if v_tz is not null and not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = v_tz) then
    raise exception 'E_INVALID_INPUT';
  end if;
  if v_theme is not null and v_theme not in ('coffee', 'forest', 'ocean', 'berry', 'slate', 'sunset') then
    raise exception 'E_INVALID_INPUT';
  end if;
  -- Kasa sayımı kapatılırken açık gün kalmasın (kayıtlar sayımsız kapanır)
  if v_cash_count is false and exists (
    select 1 from public.cafe_days d where d.cafe_id = p_cafe and d.closed_at is null
  ) then
    update public.cafe_days d
    set closed_at = now(),
        summary = private.window_summary(d.cafe_id, d.opened_at, now()),
        expected_cash = d.opening_cash + (private.window_summary(d.cafe_id, d.opened_at, now()) ->> 'cash')::numeric,
        card_expected = (private.window_summary(d.cafe_id, d.opened_at, now()) ->> 'card')::numeric,
        note = left(concat_ws(' · ', nullif(d.note, ''), 'Kasa sayımı kapatıldı'), 200)
    where d.cafe_id = p_cafe and d.closed_at is null;
  end if;

  update public.cafes
  set name = coalesce(nullif(v_name, ''), name),
      card_commission_rate = coalesce(v_rate, card_commission_rate),
      ticket_commission_rate = coalesce(v_ticket, ticket_commission_rate),
      vat_rate = coalesce(v_vat, vat_rate),
      open_hour = coalesce(v_open, open_hour),
      close_hour = coalesce(v_close, close_hour),
      timezone = coalesce(v_tz, timezone),
      theme = coalesce(v_theme, theme),
      currency = coalesce(v_currency, currency),
      language = coalesce(v_language, language),
      cash_count = coalesce(v_cash_count, cash_count)
  where id = p_cafe;
end
$$;

-- ---------------------------------------------------------------------
-- Logo: yalnızca sahip; null = kaldır
-- ---------------------------------------------------------------------
create or replace function public.cafe_set_logo(p_cafe uuid, p_logo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_role(p_cafe, 'owner');
  update public.cafes set logo = nullif(p_logo, '') where id = p_cafe;
exception
  when check_violation then
    raise exception 'E_INVALID_INPUT';
end
$$;

-- ---------------------------------------------------------------------
-- Giriş ekranı markası (oturumsuz okunur). Her kurulum tek kafe varsayar;
-- birden fazla kafe varsa ilk açılanınki döner. Gizli bilgi içermez.
-- ---------------------------------------------------------------------
create or replace function public.app_brand()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_build_object('name', c.name, 'theme', c.theme, 'logo', c.logo, 'language', c.language)
    from public.cafes c
    order by c.created_at, c.name
    limit 1
  ), '{}'::jsonb)
$$;

revoke all on function public.cafe_set_logo(uuid, text) from public, anon;
grant execute on function public.cafe_set_logo(uuid, text) to authenticated;
revoke all on function public.app_brand() from public;
grant execute on function public.app_brand() to anon, authenticated;
