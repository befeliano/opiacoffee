-- =====================================================================
-- Adisyon · Gider ödeme durumu, fatura dosyası, kasadan ödenen gider
-- =====================================================================
-- * Tek seferlik gider "ödenmedi" olarak girilir; "Öde" nakit ya da kart sorar.
-- * Gidere fatura (e-arşiv PDF ya da fotoğraf) eklenebilir; dosya veritabanında durur.
-- * Personel kasadan nakit ödediği alışverişi (ör. market) gider olarak girebilir.
-- * Kasadan nakit ödenen giderler gün sonunda beklenen nakitten düşülür.
-- Veri silmez.
-- =====================================================================

alter table public.expenses
  add column if not exists paid_at timestamptz,
  add column if not exists paid_method text check (paid_method in ('cash', 'card')),
  add column if not exists paid_by text not null default '';

alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses add constraint expenses_category_check
  check (category = any (array['kira', 'fatura', 'personel', 'banka', 'vergi', 'ekipman', 'pazarlama', 'market', 'diger']));

create table if not exists public.expense_files (
  expense_id uuid primary key references public.expenses (id) on delete cascade,
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  mime text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size integer not null check (size between 1 and 3145728),
  data bytea not null,
  created_at timestamptz not null default now()
);
alter table public.expense_files enable row level security;
revoke all on public.expense_files from anon, authenticated;

create or replace function private.window_summary(p_cafe uuid, p_from timestamp with time zone, p_to timestamp with time zone) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  with o as (
    select o.status, t.total, t.discount, t.comp_total, c.cost
    from public.orders o
    cross join lateral private.order_totals(o.id) t
    cross join lateral (
      select coalesce(sum(i.quantity * i.unit_cost), 0) as cost
      from public.order_items i
      where i.order_id = o.id
    ) c
    where o.cafe_id = p_cafe
      and o.closed_at >= p_from
      and o.closed_at < p_to
  ),
  p as (
    select
      coalesce(sum(pay.amount) filter (where pay.method = 'cash'), 0) as cash,
      coalesce(sum(pay.amount) filter (where pay.method = 'card'), 0) as card,
      coalesce(sum(pay.amount) filter (where pay.method::text = 'ticket'), 0) as ticket,
      coalesce(sum(pay.commission_amount), 0) as commission
    from public.payments pay
    where pay.cafe_id = p_cafe
      and pay.created_at >= p_from
      and pay.created_at < p_to
  )
  select jsonb_build_object(
    'orders', (select count(*) from o where o.status = 'paid'),
    'cancelled', (select count(*) from o where o.status = 'cancelled'),
    'revenue', (select coalesce(sum(o.total), 0) from o where o.status = 'paid'),
    'discount', (select coalesce(sum(o.discount), 0) from o where o.status = 'paid'),
    'comp', (select coalesce(sum(o.comp_total), 0) from o where o.status = 'paid'),
    'cost', (select round(coalesce(sum(o.cost), 0), 2) from o where o.status = 'paid'),
    'cash', p.cash,
    -- Kasadan nakit ödenen giderler (ör. markete koşulup alınan limon): beklenen nakitten düşülür
    'expenses_cash', (
      select coalesce(sum(e.amount), 0) from public.expenses e
      where e.cafe_id = p_cafe and e.paid_method = 'cash' and e.paid_at >= p_from and e.paid_at < p_to
    ),
    'card', p.card,
    'ticket', p.ticket,
    'commission', p.commission
  )
  from p
$$;

create or replace function public.day_close(p_cafe uuid, p_counted_cash numeric, p_note text DEFAULT ''::text, p_pos_total numeric DEFAULT NULL::numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
  v_day public.cafe_days;
  v_summary jsonb;
  v_expected numeric;
  v_card numeric;
  v_counted numeric := round(p_counted_cash, 2);
  v_pos numeric := round(p_pos_total, 2);
  v_open integer;
begin
  perform private.require_role(p_cafe, 'staff');
  if v_counted is not null and (v_counted < 0 or v_counted >= 10000000) then
    raise exception 'E_INVALID_AMOUNT';
  end if;
  if v_pos is not null and (v_pos < 0 or v_pos >= 10000000) then
    raise exception 'E_INVALID_AMOUNT';
  end if;

  select d.* into v_day
  from public.cafe_days d
  where d.cafe_id = p_cafe and d.closed_at is null
  for update;
  if not found then
    raise exception 'E_DAY_CLOSED';
  end if;

  select count(*) into v_open from public.orders o where o.cafe_id = p_cafe and o.status = 'open';
  if v_open > 0 then
    raise exception 'E_DAY_OPEN_ORDERS';
  end if;

  v_summary := private.window_summary(p_cafe, v_day.opened_at, now());
  v_expected := v_day.opening_cash + (v_summary ->> 'cash')::numeric - (v_summary ->> 'expenses_cash')::numeric;
  v_card := (v_summary ->> 'card')::numeric;

  update public.cafe_days
  set closed_at = now(),
      closed_by = v_uid,
      expected_cash = v_expected,
      counted_cash = v_counted,
      cash_difference = v_counted - v_expected,
      card_expected = v_card,
      pos_total = v_pos,
      card_difference = v_pos - v_card,
      summary = v_summary,
      note = private.clean_text(p_note, 200)
  where id = v_day.id
  returning * into v_day;

  return jsonb_build_object(
    'day', private.day_json(v_day, true),
    'difference', v_day.cash_difference,
    'card_difference', v_day.card_difference
  );
end
$$;

create or replace function public.day_status(p_cafe uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_role public.member_role;
  v_manager boolean;
  v_tz text;
  v_today date;
  v_open public.cafe_days;
  v_last public.cafe_days;
  v_live jsonb;
begin
  v_role := private.require_role(p_cafe, 'staff');
  v_manager := private.figures_scope(p_cafe) = 'all';
  select c.timezone into v_tz from public.cafes c where c.id = p_cafe;
  v_today := private.biz_date(now(), v_tz);

  select * into v_open from private.open_day(p_cafe);
  select d.* into v_last
  from public.cafe_days d
  where d.cafe_id = p_cafe and d.closed_at is not null
  order by d.closed_at desc
  limit 1;

  if v_open.id is not null then
    v_live := private.window_summary(p_cafe, v_open.opened_at, now());
    -- Açılış nakdi girilmediyse beklenen nakit bilinmez
    v_live := v_live || jsonb_build_object('expected_cash', v_open.opening_cash + (v_live ->> 'cash')::numeric - (v_live ->> 'expenses_cash')::numeric);
  end if;

  return jsonb_build_object(
    'now', now(),
    'business_date', v_today,
    'open', private.day_json(v_open, true),
    'live', v_live,
    'last', private.day_json(v_last, true),
    'open_orders', (
      select count(*) from public.orders o where o.cafe_id = p_cafe and o.status = 'open'
    ),
    'history', coalesce((
      select jsonb_agg(private.day_json(d, true) order by d.closed_at desc)
      from (
        select * from public.cafe_days d
        where d.cafe_id = p_cafe and d.closed_at is not null
          and (v_manager or d.business_date >= v_today - 1)
        order by d.closed_at desc
        limit 14
      ) d
    ), '[]'::jsonb)
  );
end
$$;

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
        expected_cash = d.opening_cash + (private.window_summary(d.cafe_id, d.opened_at, now()) ->> 'cash')::numeric
          - (private.window_summary(d.cafe_id, d.opened_at, now()) ->> 'expenses_cash')::numeric,
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

create or replace function public.finance_expenses(p_cafe uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role(p_cafe, 'owner');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id,
      'kind', e.kind,
      'category', e.category,
      'name', e.name,
      'amount', e.amount,
      'starts_on', e.starts_on,
      'ends_on', e.ends_on,
      'note', e.note,
      'paid_at', e.paid_at,
      'paid_method', e.paid_method,
      'paid_by', e.paid_by,
      'file', case when f.expense_id is null then null
        else jsonb_build_object('name', f.name, 'mime', f.mime, 'size', f.size) end
    ) order by e.kind, e.category, e.name)
    from public.expenses e
    left join public.expense_files f on f.expense_id = e.id
    where e.cafe_id = p_cafe
  ), '[]'::jsonb);
end
$$;

-- Ödendi / ödenmedi (p_method boş = ödenmedi)
create or replace function public.finance_pay_expense(p_cafe uuid, p_id uuid, p_method text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  perform private.require_role(p_cafe, 'owner');
  if p_method is not null and p_method not in ('cash', 'card') then
    raise exception 'E_INVALID_INPUT';
  end if;
  update public.expenses e
  set paid_at = case when p_method is null then null else now() end,
      paid_method = p_method,
      paid_by = case when p_method is null then '' else coalesce((
        select m.display_name from public.cafe_members m where m.cafe_id = p_cafe and m.user_id = v_uid
      ), '') end,
      updated_at = now()
  where e.id = p_id and e.cafe_id = p_cafe;
  if not found then
    raise exception 'E_NOT_FOUND';
  end if;
end
$$;

-- Personel: kasadan nakit ödenen alışveriş (bugünün tarihiyle, "Market" kategorisinde, ödendi)
create or replace function public.finance_cash_expense(p_cafe uuid, p_name text, p_amount numeric, p_note text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := private.clean_text(p_name, 60);
  v_amount numeric := round(p_amount, 2);
  v_id uuid;
begin
  perform private.require_role(p_cafe, 'staff');
  if v_name = '' then
    raise exception 'E_NAME_REQUIRED';
  end if;
  if v_amount is null or v_amount <= 0 or v_amount >= 1000000 then
    raise exception 'E_INVALID_AMOUNT';
  end if;
  insert into public.expenses (cafe_id, kind, category, name, amount, starts_on, note, paid_at, paid_method, paid_by)
  values (
    p_cafe, 'one_time', 'market', v_name, v_amount,
    private.biz_date(now(), (select c.timezone from public.cafes c where c.id = p_cafe)),
    private.clean_text(p_note, 200), now(), 'cash',
    coalesce((select m.display_name from public.cafe_members m where m.cafe_id = p_cafe and m.user_id = v_uid), '')
  )
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end
$$;

-- Fatura dosyası (base64): ekle / değiştir, oku, kaldır
create or replace function public.finance_set_file(p_cafe uuid, p_id uuid, p_name text, p_mime text, p_data text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data bytea;
begin
  perform private.require_role(p_cafe, 'owner');
  if not exists (select 1 from public.expenses e where e.id = p_id and e.cafe_id = p_cafe) then
    raise exception 'E_NOT_FOUND';
  end if;
  begin
    v_data := decode(p_data, 'base64');
  exception when others then
    raise exception 'E_INVALID_INPUT';
  end;
  insert into public.expense_files (expense_id, cafe_id, name, mime, size, data)
  values (p_id, p_cafe, left(private.clean_text(p_name, 120), 120), p_mime, octet_length(v_data), v_data)
  on conflict (expense_id) do update
    set name = excluded.name, mime = excluded.mime, size = excluded.size, data = excluded.data, created_at = now();
  return jsonb_build_object('name', left(private.clean_text(p_name, 120), 120), 'mime', p_mime, 'size', octet_length(v_data));
exception
  when check_violation then raise exception 'E_INVALID_INPUT';
end
$$;

create or replace function public.finance_get_file(p_cafe uuid, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.require_role(p_cafe, 'owner');
  select jsonb_build_object('name', f.name, 'mime', f.mime, 'size', f.size, 'data', encode(f.data, 'base64'))
  into v_result
  from public.expense_files f
  where f.expense_id = p_id and f.cafe_id = p_cafe;
  if v_result is null then
    raise exception 'E_NOT_FOUND';
  end if;
  return v_result;
end
$$;

create or replace function public.finance_delete_file(p_cafe uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_role(p_cafe, 'owner');
  delete from public.expense_files where expense_id = p_id and cafe_id = p_cafe;
end
$$;

revoke all on function public.finance_pay_expense(uuid, uuid, text) from public, anon;
revoke all on function public.finance_cash_expense(uuid, text, numeric, text) from public, anon;
revoke all on function public.finance_set_file(uuid, uuid, text, text, text) from public, anon;
revoke all on function public.finance_get_file(uuid, uuid) from public, anon;
revoke all on function public.finance_delete_file(uuid, uuid) from public, anon;
grant execute on function public.finance_pay_expense(uuid, uuid, text) to authenticated;
grant execute on function public.finance_cash_expense(uuid, text, numeric, text) to authenticated;
grant execute on function public.finance_set_file(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.finance_get_file(uuid, uuid) to authenticated;
grant execute on function public.finance_delete_file(uuid, uuid) to authenticated;
