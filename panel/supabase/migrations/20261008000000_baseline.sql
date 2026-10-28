-- =====================================================================
-- Adisyon · Temel şema (baseline)
-- =====================================================================
-- Yeni bir kafe veritabanının tamamı: tablolar, tipler, iş kuralları
-- (public.* API ve private.* yardımcı fonksiyonlar), yetkiler ve
-- realtime yayını. Eski geliştirme sürecindeki 18 migration'ın son
-- hâlidir (pg_dump ile üretildi, sonra elle düzenlendi).
--
-- Güvenlik modeli:
-- * Her satır bir kafeye (cafe_id) bağlıdır; aynı kafe içindeki
--   referanslar bileşik yabancı anahtarlarla (cafe_id, id) zorlanır.
-- * İstemcilerin tablolara doğrudan erişimi yoktur. Tüm okuma/yazma
--   yetki kontrolü yapan SECURITY DEFINER fonksiyonlardan geçer.
-- * admin_* fonksiyonları yalnızca servis rolüyle (kurulum betiği)
--   çağrılabilir.
--
-- Yeni değişiklikler bu dosyaya değil, yeni bir migration'a yazılır.
-- =====================================================================

set check_function_bodies = off;

create schema if not exists private;
revoke all on schema private from public;

-- Yeni fonksiyonlar varsayılan olarak herkese açık olmasın; her API
-- fonksiyonuna yetki tek tek verilir (dosyanın sonundaki ACL bölümü).
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- type · public.cost_mode

CREATE TYPE public.cost_mode AS ENUM (
    'recipe',
    'fixed'
);

-- type · public.expense_kind

CREATE TYPE public.expense_kind AS ENUM (
    'monthly',
    'one_time'
);

-- type · public.member_role

CREATE TYPE public.member_role AS ENUM (
    'owner',
    'manager',
    'staff'
);

-- type · public.option_selection

CREATE TYPE public.option_selection AS ENUM (
    'single',
    'multi'
);

-- type · public.order_status

CREATE TYPE public.order_status AS ENUM (
    'open',
    'paid',
    'cancelled'
);

-- type · public.payment_method

CREATE TYPE public.payment_method AS ENUM (
    'cash',
    'card',
    'ticket'
);

-- type · public.stock_unit

CREATE TYPE public.stock_unit AS ENUM (
    'g',
    'ml',
    'adet'
);

-- function · private.assert_owner_remains(uuid, uuid)

CREATE FUNCTION private.assert_owner_remains(p_cafe uuid, p_user uuid) RETURNS void
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
begin
  if not exists (
    select 1 from public.cafe_members m
    where m.cafe_id = p_cafe and m.role = 'owner' and m.user_id <> p_user
  ) then
    raise exception 'E_LAST_OWNER';
  end if;
end
$$;

-- function · private.biz_date(timestamp with time zone, text)

CREATE FUNCTION private.biz_date(p_ts timestamp with time zone, p_tz text) RETURNS date
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select ((p_ts at time zone p_tz) - private.day_cutoff())::date
$$;

-- function · private.cafes_after_insert()

CREATE FUNCTION private.cafes_after_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  perform private.ensure_joker(new.id);
  return new;
end
$$;

-- function · private.clean_text(text, integer)

CREATE FUNCTION private.clean_text(p_value text, p_max integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select left(
    btrim(regexp_replace(regexp_replace(coalesce(p_value, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g')),
    p_max
  )
$$;

-- function · private.day_cutoff()

CREATE FUNCTION private.day_cutoff() RETURNS interval
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select interval '5 hours'
$$;

-- table · public.cafe_days

CREATE TABLE public.cafe_days (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    business_date date NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    opened_by uuid,
    opening_cash numeric(12,2) DEFAULT 0,
    closed_at timestamp with time zone,
    closed_by uuid,
    expected_cash numeric(12,2),
    counted_cash numeric(12,2),
    cash_difference numeric(12,2),
    summary jsonb,
    note text DEFAULT ''::text NOT NULL,
    pos_total numeric(12,2),
    card_expected numeric(12,2),
    card_difference numeric(12,2),
    CONSTRAINT cafe_days_counted_cash_check CHECK (((counted_cash >= (0)::numeric) AND (counted_cash < (10000000)::numeric))),
    CONSTRAINT cafe_days_note_check CHECK ((char_length(note) <= 200)),
    CONSTRAINT cafe_days_opening_cash_check CHECK (((opening_cash >= (0)::numeric) AND (opening_cash < (10000000)::numeric))),
    CONSTRAINT cafe_days_pos_total_check CHECK (((pos_total >= (0)::numeric) AND (pos_total < (10000000)::numeric)))
);

-- function · private.day_json(public.cafe_days, boolean)

CREATE FUNCTION private.day_json(p_day public.cafe_days, p_money boolean) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select case when p_day.id is null then null else jsonb_build_object(
    'id', p_day.id,
    'business_date', p_day.business_date,
    'opened_at', p_day.opened_at,
    'opened_by', coalesce((
      select m.display_name from public.cafe_members m
      where m.cafe_id = p_day.cafe_id and m.user_id = p_day.opened_by
    ), ''),
    'opening_cash', p_day.opening_cash,
    'closed_at', p_day.closed_at,
    'closed_by', coalesce((
      select m.display_name from public.cafe_members m
      where m.cafe_id = p_day.cafe_id and m.user_id = p_day.closed_by
    ), ''),
    'counted_cash', p_day.counted_cash,
    'cash_difference', p_day.cash_difference,
    'pos_total', p_day.pos_total,
    'card_difference', p_day.card_difference,
    'note', p_day.note
  ) || case when p_money then jsonb_build_object(
    'expected_cash', p_day.expected_cash,
    'card_expected', p_day.card_expected,
    'summary', p_day.summary
  ) else '{}'::jsonb end
  end
$$;

-- function · private.day_totals(uuid, date)

CREATE FUNCTION private.day_totals(p_cafe uuid, p_date date) RETURNS TABLE(orders integer, revenue numeric, cost numeric, commission numeric, items integer)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  with tz as (select c.timezone from public.cafes c where c.id = p_cafe),
  paid as (
    select o.id, o.discount_amount
    from public.orders o, tz
    where o.cafe_id = p_cafe and o.status = 'paid'
      and o.closed_at >= ((p_date::timestamp + private.day_cutoff()) at time zone tz.timezone)
      and o.closed_at < (((p_date + 1)::timestamp + private.day_cutoff()) at time zone tz.timezone)
  ),
  it as (
    select i.order_id,
      coalesce(sum(i.quantity * i.unit_price) filter (where not i.is_comp), 0) as subtotal,
      coalesce(sum(i.quantity * i.unit_cost), 0) as cost,
      coalesce(sum(i.quantity), 0) as qty
    from public.order_items i
    join paid p on p.id = i.order_id
    group by i.order_id
  ),
  pt as (
    select pay.order_id, coalesce(sum(pay.commission_amount), 0) as commission
    from public.payments pay
    join paid p on p.id = pay.order_id
    group by pay.order_id
  )
  select
    count(*)::integer,
    coalesce(round(sum(coalesce(it.subtotal, 0) - least(p.discount_amount, coalesce(it.subtotal, 0))), 2), 0),
    coalesce(round(sum(coalesce(it.cost, 0)), 2), 0),
    coalesce(round(sum(coalesce(pt.commission, 0)), 2), 0),
    coalesce(sum(coalesce(it.qty, 0)), 0)::integer
  from paid p
  left join it on it.order_id = p.id
  left join pt on pt.order_id = p.id
$$;

-- function · private.ensure_joker(uuid)

CREATE FUNCTION private.ensure_joker(p_cafe uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_category uuid;
begin
  if exists (select 1 from public.products p where p.cafe_id = p_cafe and p.is_open_price) then
    return;
  end if;

  select c.id into v_category
  from public.categories c
  where c.cafe_id = p_cafe and c.name = 'Diğer'
  limit 1;

  if v_category is null then
    insert into public.categories (cafe_id, name, subtitle, sort_order)
    values (p_cafe, 'Diğer', 'Menü dışı', 1000)
    returning id into v_category;
  end if;

  insert into public.products (cafe_id, category_id, name, description, price, cost_mode, fixed_cost, is_open_price, sort_order)
  values (p_cafe, v_category, 'Joker', 'Menü dışı ürün · fiyatı satışta girilir', 0, 'fixed', 0, true, 0);
end
$$;

-- function · private.is_member(uuid)

CREATE FUNCTION private.is_member(p_cafe uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from public.cafe_members m
    where m.cafe_id = p_cafe and m.user_id = (select auth.uid())
  )
$$;

-- function · private.item_paid_qty(uuid)

CREATE FUNCTION private.item_paid_qty(p_item uuid) RETURNS integer
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select coalesce(sum(pi.quantity), 0)::integer from public.payment_items pi where pi.item_id = p_item
$$;

-- function · private.method_rate(uuid, public.payment_method)

CREATE FUNCTION private.method_rate(p_cafe uuid, p_method public.payment_method) RETURNS numeric
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select case p_method::text
    when 'card' then c.card_commission_rate
    when 'ticket' then c.ticket_commission_rate
    else 0
  end
  from public.cafes c
  where c.id = p_cafe
$$;

-- function · private.normalize_uuids(uuid[])

CREATE FUNCTION private.normalize_uuids(p_ids uuid[]) RETURNS uuid[]
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select coalesce(array_agg(distinct x order by x), '{}'::uuid[])
  from unnest(coalesce(p_ids, '{}'::uuid[])) as x
$$;

-- function · private.open_day(uuid)

CREATE FUNCTION private.open_day(p_cafe uuid) RETURNS public.cafe_days
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select d.* from public.cafe_days d where d.cafe_id = p_cafe and d.closed_at is null limit 1
$$;

-- function · private.option_unit_cost(uuid)

CREATE FUNCTION private.option_unit_cost(p_option uuid) RETURNS numeric
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select case
    when o.cost_mode = 'fixed' then o.fixed_cost
    else coalesce((
      select sum(ri.quantity * i.package_price / i.package_size)
      from public.recipe_items ri
      join public.ingredients i on i.id = ri.ingredient_id
      where ri.option_id = o.id
    ), 0)
  end
  from public.options o
  where o.id = p_option
$$;

-- function · private.order_json(uuid)

CREATE FUNCTION private.order_json(p_order uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'table_id', o.table_id,
    'table_name', o.table_name,
    'is_takeaway', o.is_takeaway,
    'opened_at', o.opened_at,
    'closed_at', o.closed_at,
    'note', o.note,
    'guests', o.guests,
    'cancel_reason', o.cancel_reason,
    'extra_discount', o.extra_discount,
    'discount', t.discount,
    'subtotal', t.subtotal,
    'comp_total', t.comp_total,
    'total', t.total,
    'paid', t.paid,
    'remaining', t.remaining,
    'items_count', t.items,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'product_id', i.product_id,
        'name', i.product_name,
        'options_label', i.options_label,
        'option_ids', to_jsonb(i.option_ids),
        'quantity', i.quantity,
        'unit_price', i.unit_price,
        'list_price', coalesce(i.list_price, i.unit_price),
        'unit_discount', i.unit_discount,
        'split_parts', i.split_parts,
        'paid_parts', coalesce(pq.qty, 0),
        'paid_quantity', coalesce(pq.qty, 0) / i.split_parts,
        'is_comp', i.is_comp,
        'note', i.note,
        'created_at', i.created_at
      ) order by i.created_at, i.id)
      from public.order_items i
      left join lateral (
        select sum(pi.quantity)::integer as qty from public.payment_items pi where pi.item_id = i.id
      ) pq on true
      where i.order_id = o.id
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'method', p.method,
        'amount', p.amount,
        'commission', p.commission_amount,
        'created_at', p.created_at,
        'lines', coalesce((
          select string_agg(
            case when i.split_parts > 1 then pi.quantity || '/' || i.split_parts || ' ' else pi.quantity || '× ' end || i.product_name,
            ', ' order by i.created_at)
          from public.payment_items pi
          join public.order_items i on i.id = pi.item_id
          where pi.payment_id = p.id
        ), '')
      ) order by p.created_at, p.id)
      from public.payments p
      where p.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  cross join lateral private.order_totals(o.id) t
  where o.id = p_order
$$;

-- function · private.order_totals(uuid)

CREATE FUNCTION private.order_totals(p_order uuid) RETURNS TABLE(subtotal numeric, comp_total numeric, discount numeric, total numeric, paid numeric, remaining numeric, items integer)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  with i as (
    select
      coalesce(sum(oi.quantity * oi.unit_price) filter (where not oi.is_comp), 0) as subtotal,
      coalesce(sum(oi.quantity * oi.unit_price) filter (where oi.is_comp), 0) as comp_total,
      coalesce(sum(oi.quantity), 0)::integer as items
    from public.order_items oi
    where oi.order_id = p_order
  ),
  p as (
    select coalesce(sum(pay.amount), 0) as paid
    from public.payments pay
    where pay.order_id = p_order
  ),
  d as (
    select coalesce((select o.discount_amount from public.orders o where o.id = p_order), 0) as discount
  )
  select
    i.subtotal,
    i.comp_total,
    least(d.discount, i.subtotal),
    i.subtotal - least(d.discount, i.subtotal),
    p.paid,
    greatest(i.subtotal - least(d.discount, i.subtotal) - p.paid, 0),
    i.items
  from i, p, d
$$;

-- function · private.payments_vat()

CREATE FUNCTION private.payments_vat() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if tg_op = 'INSERT' then
    new.vat_rate := coalesce((select c.vat_rate from public.cafes c where c.id = new.cafe_id), 0);
  end if;
  new.vat_amount := round(new.amount * new.vat_rate / (1 + new.vat_rate), 2);
  return new;
end
$$;

-- function · private.product_unit_cost(uuid)

CREATE FUNCTION private.product_unit_cost(p_product uuid) RETURNS numeric
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select case
    when p.cost_mode = 'fixed' then p.fixed_cost
    else coalesce((
      select sum(ri.quantity * i.package_price / i.package_size)
      from public.recipe_items ri
      join public.ingredients i on i.id = ri.ingredient_id
      where ri.product_id = p.id
    ), 0)
  end
  from public.products p
  where p.id = p_product
$$;

-- function · private.recipe_json(uuid, uuid)

CREATE FUNCTION private.recipe_json(p_product uuid, p_option uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'ingredient_id', ri.ingredient_id,
    'quantity', ri.quantity
  ) order by i.name), '[]'::jsonb)
  from public.recipe_items ri
  join public.ingredients i on i.id = ri.ingredient_id
  where (p_product is not null and ri.product_id = p_product)
     or (p_option is not null and ri.option_id = p_option)
$$;

-- function · private.require_open_day(uuid)

CREATE FUNCTION private.require_open_day(p_cafe uuid) RETURNS void
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
begin
  -- Kafe 09:00–02:00 arası kendiliğinden açık sayılır; gün açmak gerekmez
  return;
end
$$;

-- function · private.require_role(uuid, public.member_role)

CREATE FUNCTION private.require_role(p_cafe uuid, p_min public.member_role) RETURNS public.member_role
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.member_role;
begin
  if v_uid is null then
    raise exception 'E_NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  select m.role into v_role
  from public.cafe_members m
  where m.cafe_id = p_cafe and m.user_id = v_uid;
  if v_role is null or private.role_rank(v_role) < private.role_rank(p_min) then
    raise exception 'E_FORBIDDEN' using errcode = '42501';
  end if;
  return v_role;
end
$$;

-- function · private.require_service()

CREATE FUNCTION private.require_service() RETURNS void
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  if coalesce(v_claims ->> 'role', '') = 'service_role'
     or session_user in ('postgres', 'supabase_admin') then
    return;
  end if;
  raise exception 'E_FORBIDDEN' using errcode = '42501';
end
$$;

-- function · private.resolve_line(uuid, uuid, uuid[])

CREATE FUNCTION private.resolve_line(p_cafe uuid, p_product uuid, p_option_ids uuid[]) RETURNS TABLE(product_id uuid, product_name text, category_name text, option_ids uuid[], options_label text, unit_price numeric, unit_cost numeric)
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare
  v_product public.products;
  v_ids uuid[] := private.normalize_uuids(p_option_ids);
  v_count integer;
  v_price_delta numeric;
  v_cost_delta numeric;
  v_label text;
begin
  select * into v_product
  from public.products p
  where p.id = p_product and p.cafe_id = p_cafe;
  if not found then
    raise exception 'E_PRODUCT_NOT_FOUND';
  end if;

  if cardinality(v_ids) > 20 then
    raise exception 'E_INVALID_OPTIONS';
  end if;

  select
    count(*),
    coalesce(sum(o.price_delta), 0),
    coalesce(sum(private.option_unit_cost(o.id)), 0),
    coalesce(string_agg(o.name, ' · ' order by pog.sort_order, g.sort_order, o.sort_order)
      filter (where not o.is_default or g.is_required), '')
  into v_count, v_price_delta, v_cost_delta, v_label
  from public.options o
  join public.option_groups g on g.id = o.group_id
  join public.product_option_groups pog on pog.group_id = g.id and pog.product_id = v_product.id
  where o.id = any (v_ids) and o.cafe_id = p_cafe;

  if v_count <> cardinality(v_ids) then
    raise exception 'E_INVALID_OPTIONS';
  end if;

  if exists (
    select 1
    from public.options o
    join public.option_groups g on g.id = o.group_id
    where o.id = any (v_ids) and g.selection = 'single'
    group by g.id
    having count(*) > 1
  ) then
    raise exception 'E_INVALID_OPTIONS';
  end if;

  if exists (
    select 1
    from public.product_option_groups pog
    join public.option_groups g on g.id = pog.group_id
    where pog.product_id = v_product.id
      and g.is_required
      and exists (select 1 from public.options o where o.group_id = g.id and o.is_active)
      and not exists (select 1 from public.options o where o.group_id = g.id and o.id = any (v_ids))
  ) then
    raise exception 'E_OPTION_REQUIRED';
  end if;

  return query
  select
    v_product.id,
    v_product.name,
    coalesce((select c.name from public.categories c where c.id = v_product.category_id), ''),
    v_ids,
    v_label,
    greatest(round(v_product.price + v_price_delta, 2), 0),
    greatest(round(coalesce(private.product_unit_cost(v_product.id), 0) + v_cost_delta, 4), 0);
end
$$;

-- function · private.role_rank(public.member_role)

CREATE FUNCTION private.role_rank(p_role public.member_role) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select case p_role when 'owner' then 3 when 'manager' then 2 else 1 end
$$;

-- function · private.round_gap()

CREATE FUNCTION private.round_gap() RETURNS interval
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select interval '5 minutes'
$$;

-- function · private.sync_discount(uuid)

CREATE FUNCTION private.sync_discount(p_order uuid) RETURNS void
    LANGUAGE sql
    SET search_path TO ''
    AS $$
  update public.orders o
  set discount_amount = o.extra_discount + coalesce((
    select sum(i.quantity * i.unit_discount)
    from public.order_items i
    where i.order_id = o.id and not i.is_comp
  ), 0)
  where o.id = p_order
$$;

-- function · private.touch_order(uuid)

CREATE FUNCTION private.touch_order(p_order uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  delete from public.orders o
  where o.id = p_order
    and o.status = 'open'
    and not exists (select 1 from public.order_items i where i.order_id = o.id)
    and not exists (select 1 from public.payments p where p.order_id = o.id);
  if not found then
    perform private.sync_discount(p_order);
    update public.orders set updated_at = now() where id = p_order;
  end if;
end
$$;

-- function · private.window_summary(uuid, timestamp with time zone, timestamp with time zone)

CREATE FUNCTION private.window_summary(p_cafe uuid, p_from timestamp with time zone, p_to timestamp with time zone) RETURNS jsonb
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
    'card', p.card,
    'ticket', p.ticket,
    'commission', p.commission
  )
  from p
$$;

-- function · private.z_orders(uuid, timestamp with time zone, timestamp with time zone)

CREATE FUNCTION private.z_orders(p_cafe uuid, p_from timestamp with time zone, p_to timestamp with time zone) RETURNS TABLE(id uuid, status public.order_status, table_name text, opened_at timestamp with time zone, closed_at timestamp with time zone, subtotal numeric, comp_total numeric, discount numeric, total numeric)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select o.id, o.status, o.table_name, o.opened_at, o.closed_at, t.subtotal, t.comp_total, t.discount, t.total
  from public.orders o
  cross join lateral private.order_totals(o.id) t
  where o.cafe_id = p_cafe
    and o.status in ('paid', 'cancelled')
    and o.closed_at >= p_from
    and o.closed_at < p_to
$$;

-- function · public.admin_add_member(uuid, uuid, public.member_role, text)

CREATE FUNCTION public.admin_add_member(p_cafe uuid, p_user uuid, p_role public.member_role, p_display_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_service();
  insert into public.cafe_members (cafe_id, user_id, role, display_name)
  values (p_cafe, p_user, p_role, private.clean_text(p_display_name, 60))
  on conflict (cafe_id, user_id) do update
    set role = excluded.role, display_name = excluded.display_name;
end
$$;

-- function · public.admin_apply_prices(uuid, jsonb)

CREATE FUNCTION public.admin_apply_prices(p_cafe uuid, p_payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_ingredients integer;
  v_products integer;
begin
  perform private.require_service();

  update public.ingredients i
  set package_price = x.package_price, updated_at = now()
  from jsonb_to_recordset(coalesce(p_payload -> 'ingredients', '[]'::jsonb)) as x(name text, package_price numeric)
  where i.cafe_id = p_cafe and i.name = x.name;
  get diagnostics v_ingredients = row_count;

  update public.products p
  set fixed_cost = x.fixed_cost, cost_mode = 'fixed', updated_at = now()
  from jsonb_to_recordset(coalesce(p_payload -> 'products', '[]'::jsonb)) as x(name text, fixed_cost numeric)
  where p.cafe_id = p_cafe and p.name = x.name;
  get diagnostics v_products = row_count;

  return jsonb_build_object('ingredients', v_ingredients, 'products', v_products);
end
$$;

-- function · public.admin_cafe_by_slug(text)

CREATE FUNCTION public.admin_cafe_by_slug(p_slug text) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_service();
  return (select c.id from public.cafes c where c.slug = p_slug);
end
$$;

-- function · public.admin_cafe_seed_ids(uuid)

CREATE FUNCTION public.admin_cafe_seed_ids(p_cafe uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_service();
  return jsonb_build_object(
    'cafeId', p_cafe,
    'demoOrders', (select count(*) from public.orders o where o.cafe_id = p_cafe and o.is_demo),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'isTakeaway', t.is_takeaway) order by t.sort_order)
      from public.dining_tables t where t.cafe_id = p_cafe and t.is_active
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'category', coalesce(c.name, ''),
        'price', p.price,
        'unitCost', round(coalesce(private.product_unit_cost(p.id), 0), 4),
        'weight', 1,
        'groupIds', coalesce((
          select jsonb_agg(pog.group_id order by pog.sort_order)
          from public.product_option_groups pog where pog.product_id = p.id
        ), '[]'::jsonb)
      ) order by p.sort_order)
      from public.products p
      left join public.categories c on c.id = p.category_id
      where p.cafe_id = p_cafe and p.is_active
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'key', g.name,
        'selection', g.selection,
        'isRequired', g.is_required,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', o.id,
            'name', o.name,
            'priceDelta', o.price_delta,
            'isDefault', o.is_default,
            'unitCost', round(coalesce(private.option_unit_cost(o.id), 0), 4),
            'share', 0
          ) order by o.sort_order)
          from public.options o where o.group_id = g.id and o.is_active
        ), '[]'::jsonb)
      ) order by g.sort_order)
      from public.option_groups g where g.cafe_id = p_cafe
    ), '[]'::jsonb)
  );
end
$$;

-- function · public.admin_create_cafe(uuid, text, jsonb)

CREATE FUNCTION public.admin_create_cafe(p_owner uuid, p_owner_name text, p_payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_cafe uuid := (p_payload -> 'cafe' ->> 'id')::uuid;
begin
  perform private.require_service();

  insert into public.cafes (id, slug, name, timezone, card_commission_rate, open_hour, close_hour, theme)
  select x.id, x.slug, x.name, coalesce(x.timezone, 'Europe/Istanbul'),
         coalesce(x.card_commission_rate, 0.03), coalesce(x.open_hour, 10), coalesce(x.close_hour, 24),
         coalesce(x.theme, 'coffee')
  from jsonb_to_record(p_payload -> 'cafe') as x(
    id uuid, slug text, name text, timezone text, card_commission_rate numeric,
    open_hour smallint, close_hour smallint, theme text
  );

  if p_owner is not null then
    insert into public.cafe_members (cafe_id, user_id, role, display_name)
    values (v_cafe, p_owner, 'owner', private.clean_text(p_owner_name, 60))
    on conflict (cafe_id, user_id) do update set role = 'owner';
  end if;

  insert into public.areas (id, cafe_id, name, sort_order)
  select x.id, v_cafe, x.name, x.sort_order
  from jsonb_to_recordset(coalesce(p_payload -> 'areas', '[]'::jsonb))
    as x(id uuid, name text, sort_order integer);

  insert into public.dining_tables (id, cafe_id, area_id, name, is_takeaway, sort_order)
  select x.id, v_cafe, x.area_id, x.name, coalesce(x.is_takeaway, false), x.sort_order
  from jsonb_to_recordset(coalesce(p_payload -> 'tables', '[]'::jsonb))
    as x(id uuid, area_id uuid, name text, is_takeaway boolean, sort_order integer);

  insert into public.categories (id, cafe_id, name, subtitle, sort_order)
  select x.id, v_cafe, x.name, coalesce(x.subtitle, ''), x.sort_order
  from jsonb_to_recordset(coalesce(p_payload -> 'categories', '[]'::jsonb))
    as x(id uuid, name text, subtitle text, sort_order integer);

  insert into public.ingredients (id, cafe_id, name, unit, package_size, package_price)
  select x.id, v_cafe, x.name, x.unit::public.stock_unit, x.package_size, coalesce(x.package_price, 0)
  from jsonb_to_recordset(coalesce(p_payload -> 'ingredients', '[]'::jsonb))
    as x(id uuid, name text, unit text, package_size numeric, package_price numeric);

  insert into public.option_groups (id, cafe_id, name, selection, is_required, sort_order)
  select x.id, v_cafe, x.name, x.selection::public.option_selection, coalesce(x.is_required, false), x.sort_order
  from jsonb_to_recordset(coalesce(p_payload -> 'groups', '[]'::jsonb))
    as x(id uuid, name text, selection text, is_required boolean, sort_order integer);

  insert into public.options (id, cafe_id, group_id, name, price_delta, cost_mode, fixed_cost, is_default, sort_order)
  select x.id, v_cafe, x.group_id, x.name, coalesce(x.price_delta, 0),
         coalesce(x.cost_mode, 'fixed')::public.cost_mode, coalesce(x.fixed_cost, 0),
         coalesce(x.is_default, false), x.sort_order
  from jsonb_to_recordset(coalesce(p_payload -> 'options', '[]'::jsonb))
    as x(id uuid, group_id uuid, name text, price_delta numeric, cost_mode text, fixed_cost numeric,
         is_default boolean, sort_order integer);

  insert into public.products (id, cafe_id, category_id, name, description, price, cost_mode, fixed_cost, tags, sort_order)
  select x.id, v_cafe, x.category_id, x.name, coalesce(x.description, ''), x.price,
         coalesce(x.cost_mode, 'recipe')::public.cost_mode, coalesce(x.fixed_cost, 0),
         coalesce(x.tags, '{}'::text[]), x.sort_order
  from jsonb_to_recordset(coalesce(p_payload -> 'products', '[]'::jsonb))
    as x(id uuid, category_id uuid, name text, description text, price numeric, cost_mode text,
         fixed_cost numeric, tags text[], sort_order integer);

  insert into public.product_option_groups (cafe_id, product_id, group_id, sort_order)
  select v_cafe, x.product_id, x.group_id, x.sort_order
  from jsonb_to_recordset(coalesce(p_payload -> 'product_groups', '[]'::jsonb))
    as x(product_id uuid, group_id uuid, sort_order integer);

  insert into public.recipe_items (cafe_id, product_id, option_id, ingredient_id, quantity)
  select v_cafe, x.product_id, x.option_id, x.ingredient_id, x.quantity
  from jsonb_to_recordset(coalesce(p_payload -> 'recipes', '[]'::jsonb))
    as x(product_id uuid, option_id uuid, ingredient_id uuid, quantity numeric);

  return jsonb_build_object('cafe_id', v_cafe);
end
$$;

-- function · public.admin_import_expenses(uuid, jsonb)

CREATE FUNCTION public.admin_import_expenses(p_cafe uuid, p_payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_count integer;
begin
  perform private.require_service();

  insert into public.expenses (cafe_id, kind, category, name, amount, starts_on, ends_on, note, is_demo)
  select p_cafe, x.kind::public.expense_kind, x.category, x.name, x.amount, x.starts_on, x.ends_on,
         coalesce(x.note, ''), true
  from jsonb_to_recordset(coalesce(p_payload -> 'expenses', '[]'::jsonb))
    as x(kind text, category text, name text, amount numeric, starts_on date, ends_on date, note text);
  get diagnostics v_count = row_count;

  return jsonb_build_object('expenses', v_count);
end
$$;

-- function · public.admin_import_orders(uuid, jsonb)

CREATE FUNCTION public.admin_import_orders(p_cafe uuid, p_payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_orders integer;
begin
  perform private.require_service();

  insert into public.orders (
    id, cafe_id, table_id, table_name, is_takeaway, status, note, discount_amount,
    cancel_reason, opened_at, closed_at, updated_at, is_demo
  )
  select x.id, p_cafe, x.table_id, x.table_name, coalesce(x.is_takeaway, false),
         x.status::public.order_status, coalesce(x.note, ''), coalesce(x.discount_amount, 0),
         coalesce(x.cancel_reason, ''), x.opened_at, x.closed_at, coalesce(x.closed_at, x.opened_at),
         coalesce(x.is_demo, false)
  from jsonb_to_recordset(coalesce(p_payload -> 'orders', '[]'::jsonb))
    as x(id uuid, table_id uuid, table_name text, is_takeaway boolean, status text, note text,
         discount_amount numeric, cancel_reason text, opened_at timestamptz, closed_at timestamptz,
         is_demo boolean);
  get diagnostics v_orders = row_count;

  insert into public.order_items (
    id, cafe_id, order_id, product_id, product_name, category_name, option_ids, options_label,
    quantity, unit_price, unit_cost, is_comp, note, created_at
  )
  select x.id, p_cafe, x.order_id, x.product_id, x.product_name, coalesce(x.category_name, ''),
         coalesce(x.option_ids, '{}'::uuid[]), coalesce(x.options_label, ''), x.quantity, x.unit_price,
         coalesce(x.unit_cost, 0), coalesce(x.is_comp, false), coalesce(x.note, ''), x.created_at
  from jsonb_to_recordset(coalesce(p_payload -> 'items', '[]'::jsonb))
    as x(id uuid, order_id uuid, product_id uuid, product_name text, category_name text, option_ids uuid[],
         options_label text, quantity integer, unit_price numeric, unit_cost numeric, is_comp boolean,
         note text, created_at timestamptz);

  insert into public.payments (id, cafe_id, order_id, method, amount, commission_rate, commission_amount, created_at)
  select x.id, p_cafe, x.order_id, x.method::public.payment_method, x.amount,
         coalesce(x.commission_rate, 0), coalesce(x.commission_amount, 0), x.created_at
  from jsonb_to_recordset(coalesce(p_payload -> 'payments', '[]'::jsonb))
    as x(id uuid, order_id uuid, method text, amount numeric, commission_rate numeric,
         commission_amount numeric, created_at timestamptz);

  return jsonb_build_object('orders', v_orders);
end
$$;

-- function · public.app_cafe_context(text)

CREATE FUNCTION public.app_cafe_context(p_slug text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
      'theme', c.theme
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

-- function · public.app_my_cafes()

CREATE FUNCTION public.app_my_cafes() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'slug', c.slug,
    'name', c.name,
    'role', m.role,
    'theme', c.theme
  ) order by c.created_at, c.name), '[]'::jsonb)
  from public.cafe_members m
  join public.cafes c on c.id = m.cafe_id
  where m.user_id = (select auth.uid())
$$;

-- function · public.cafe_update_settings(uuid, jsonb)

CREATE FUNCTION public.cafe_update_settings(p_cafe uuid, p_settings jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_name text := private.clean_text(p_settings ->> 'name', 80);
  v_rate numeric := round((p_settings ->> 'card_commission_rate')::numeric, 4);
  v_ticket numeric := round((p_settings ->> 'ticket_commission_rate')::numeric, 4);
  v_vat numeric := round((p_settings ->> 'vat_rate')::numeric, 4);
  v_open smallint := (p_settings ->> 'open_hour')::smallint;
  v_close smallint := (p_settings ->> 'close_hour')::smallint;
  v_tz text := coalesce(nullif(p_settings ->> 'timezone', ''), 'Europe/Istanbul');
begin
  perform private.require_role(p_cafe, 'owner');
  if v_name = '' then
    raise exception 'E_NAME_REQUIRED';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = v_tz) then
    raise exception 'E_INVALID_INPUT';
  end if;

  update public.cafes
  set name = v_name,
      card_commission_rate = v_rate,
      ticket_commission_rate = coalesce(v_ticket, ticket_commission_rate),
      vat_rate = coalesce(v_vat, vat_rate),
      open_hour = v_open,
      close_hour = v_close,
      timezone = v_tz
  where id = p_cafe;
end
$$;

-- function · public.day_close(uuid, numeric, text, numeric)

CREATE FUNCTION public.day_close(p_cafe uuid, p_counted_cash numeric, p_note text DEFAULT ''::text, p_pos_total numeric DEFAULT NULL::numeric) RETURNS jsonb
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
  v_expected := v_day.opening_cash + (v_summary ->> 'cash')::numeric;
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

-- function · public.day_open(uuid, numeric)

CREATE FUNCTION public.day_open(p_cafe uuid, p_opening_cash numeric DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
  v_tz text;
  v_cash numeric := round(p_opening_cash, 2);
begin
  perform private.require_role(p_cafe, 'staff');
  if v_cash is not null and (v_cash < 0 or v_cash >= 10000000) then
    raise exception 'E_INVALID_AMOUNT';
  end if;

  select c.timezone into v_tz from public.cafes c where c.id = p_cafe for update;
  if exists (select 1 from public.cafe_days d where d.cafe_id = p_cafe and d.closed_at is null) then
    raise exception 'E_DAY_ALREADY_OPEN';
  end if;

  insert into public.cafe_days (cafe_id, business_date, opened_by, opening_cash)
  values (p_cafe, private.biz_date(now(), v_tz), v_uid, v_cash);

  return public.day_status(p_cafe);
end
$$;

-- function · public.day_status(uuid)

CREATE FUNCTION public.day_status(p_cafe uuid) RETURNS jsonb
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
  v_manager := private.role_rank(v_role) >= private.role_rank('manager');
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
    v_live := v_live || jsonb_build_object('expected_cash', v_open.opening_cash + (v_live ->> 'cash')::numeric);
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

-- function · public.demo_purge(uuid)

CREATE FUNCTION public.demo_purge(p_cafe uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_orders integer;
  v_expenses integer;
begin
  perform private.require_role(p_cafe, 'owner');

  delete from public.orders where cafe_id = p_cafe and is_demo;
  get diagnostics v_orders = row_count;

  delete from public.expenses where cafe_id = p_cafe and is_demo;
  get diagnostics v_expenses = row_count;

  return jsonb_build_object('orders', v_orders, 'expenses', v_expenses);
end
$$;

-- function · public.demo_status(uuid)

CREATE FUNCTION public.demo_status(p_cafe uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_role(p_cafe, 'owner');
  return jsonb_build_object(
    'orders', (select count(*) from public.orders o where o.cafe_id = p_cafe and o.is_demo),
    'expenses', (select count(*) from public.expenses e where e.cafe_id = p_cafe and e.is_demo),
    'real_orders', (select count(*) from public.orders o where o.cafe_id = p_cafe and not o.is_demo)
  );
end
$$;

-- function · public.finance_delete_expense(uuid, uuid)

CREATE FUNCTION public.finance_delete_expense(p_cafe uuid, p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_role(p_cafe, 'owner');
  delete from public.expenses where id = p_id and cafe_id = p_cafe;
  if not found then
    raise exception 'E_NOT_FOUND';
  end if;
end
$$;

-- function · public.finance_expenses(uuid)

CREATE FUNCTION public.finance_expenses(p_cafe uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
      'note', e.note
    ) order by e.kind, e.category, e.name)
    from public.expenses e
    where e.cafe_id = p_cafe
  ), '[]'::jsonb);
end
$$;

-- function · public.finance_save_expense(uuid, jsonb)

CREATE FUNCTION public.finance_save_expense(p_cafe uuid, p_expense jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_id uuid := nullif(p_expense ->> 'id', '')::uuid;
  v_kind public.expense_kind := coalesce(nullif(p_expense ->> 'kind', ''), 'monthly')::public.expense_kind;
  v_name text := private.clean_text(p_expense ->> 'name', 60);
  v_amount numeric := round((p_expense ->> 'amount')::numeric, 2);
  v_starts date := (p_expense ->> 'starts_on')::date;
  v_ends date := nullif(p_expense ->> 'ends_on', '')::date;
begin
  perform private.require_role(p_cafe, 'owner');
  if v_name = '' then
    raise exception 'E_NAME_REQUIRED';
  end if;
  if v_amount is null or v_amount < 0 or v_starts is null then
    raise exception 'E_INVALID_INPUT';
  end if;
  if v_kind = 'monthly' then
    -- Aylık giderler ay başından ay sonuna geçerlidir
    v_starts := date_trunc('month', v_starts)::date;
    if v_ends is not null then
      v_ends := (date_trunc('month', v_ends) + interval '1 month - 1 day')::date;
    end if;
  else
    v_ends := null;
  end if;

  if v_id is null then
    insert into public.expenses (cafe_id, kind, category, name, amount, starts_on, ends_on, note)
    values (p_cafe, v_kind, coalesce(nullif(p_expense ->> 'category', ''), 'diger'), v_name, v_amount,
            v_starts, v_ends, private.clean_text(p_expense ->> 'note', 200))
    returning id into v_id;
  else
    update public.expenses
    set kind = v_kind,
        category = coalesce(nullif(p_expense ->> 'category', ''), 'diger'),
        name = v_name,
        amount = v_amount,
        starts_on = v_starts,
        ends_on = v_ends,
        note = private.clean_text(p_expense ->> 'note', 200),
        updated_at = now()
    where id = v_id and cafe_id = p_cafe;
    if not found then
      raise exception 'E_NOT_FOUND';
    end if;
  end if;
  return jsonb_build_object('id', v_id);
end
$$;

-- function · public.menu_admin_data(uuid)

CREATE FUNCTION public.menu_admin_data(p_cafe uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_role(p_cafe, 'manager');
  return jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'subtitle', c.subtitle,
        'sort_order', c.sort_order
      ) order by c.sort_order, c.name)
      from public.categories c
      where c.cafe_id = p_cafe
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'category_id', p.category_id,
        'name', p.name,
        'description', p.description,
        'price', p.price,
        'cost_mode', p.cost_mode,
        'fixed_cost', p.fixed_cost,
        'unit_cost', round(coalesce(private.product_unit_cost(p.id), 0), 4),
        'tags', to_jsonb(p.tags),
        'is_active', p.is_active,
        'favorite_rank', p.favorite_rank,
        'sort_order', p.sort_order,
        'recipe', private.recipe_json(p.id, null),
        'group_ids', coalesce((
          select jsonb_agg(pog.group_id order by pog.sort_order)
          from public.product_option_groups pog
          where pog.product_id = p.id
        ), '[]'::jsonb)
      ) order by p.sort_order, p.name)
      from public.products p
      where p.cafe_id = p_cafe
    ), '[]'::jsonb),
    'ingredients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'name', i.name,
        'unit', i.unit,
        'package_size', i.package_size,
        'package_price', i.package_price,
        'unit_cost', round(i.package_price / i.package_size, 6),
        'usage_count', (select count(*) from public.recipe_items ri where ri.ingredient_id = i.id),
        'updated_at', i.updated_at
      ) order by i.name)
      from public.ingredients i
      where i.cafe_id = p_cafe
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'selection', g.selection,
        'is_required', g.is_required,
        'sort_order', g.sort_order,
        'product_count', (select count(*) from public.product_option_groups pog where pog.group_id = g.id),
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', o.id,
            'name', o.name,
            'price_delta', o.price_delta,
            'cost_mode', o.cost_mode,
            'fixed_cost', o.fixed_cost,
            'unit_cost', round(coalesce(private.option_unit_cost(o.id), 0), 4),
            'is_default', o.is_default,
            'is_active', o.is_active,
            'recipe', private.recipe_json(null, o.id)
          ) order by o.sort_order, o.name)
          from public.options o
          where o.group_id = g.id
        ), '[]'::jsonb)
      ) order by g.sort_order, g.name)
      from public.option_groups g
      where g.cafe_id = p_cafe
    ), '[]'::jsonb)
  );
end
$$;

-- function · public.menu_delete_category(uuid, uuid)

CREATE FUNCTION public.menu_delete_category(p_cafe uuid, p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_role(p_cafe, 'manager');
  delete from public.categories where id = p_id and cafe_id = p_cafe;
  if not found then
    raise exception 'E_NOT_FOUND';
  end if;
end
$$;

-- function · public.menu_delete_group(uuid, uuid)

CREATE FUNCTION public.menu_delete_group(p_cafe uuid, p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_role(p_cafe, 'manager');
  delete from public.option_groups where id = p_id and cafe_id = p_cafe;
  if not found then
    raise exception 'E_NOT_FOUND';
  end if;
end
$$;

-- function · public.menu_delete_ingredient(uuid, uuid)

CREATE FUNCTION public.menu_delete_ingredient(p_cafe uuid, p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_role(p_cafe, 'manager');
  if exists (select 1 from public.recipe_items ri where ri.ingredient_id = p_id and ri.cafe_id = p_cafe) then
    raise exception 'E_INGREDIENT_IN_USE';
  end if;
  delete from public.ingredients where id = p_id and cafe_id = p_cafe;
  if not found then
    raise exception 'E_NOT_FOUND';
  end if;
end
$$;

-- function · public.menu_delete_product(uuid, uuid)

CREATE FUNCTION public.menu_delete_product(p_cafe uuid, p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_role(p_cafe, 'manager');
  -- Geçmiş satışlar ürün adının kopyasıyla raporlarda kalmaya devam eder
  delete from public.products where id = p_id and cafe_id = p_cafe;
  if not found then
    raise exception 'E_NOT_FOUND';
  end if;
end
$$;

-- function · public.menu_recalculate_costs(uuid, date, date)

CREATE FUNCTION public.menu_recalculate_costs(p_cafe uuid, p_from date, p_to date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_tz text;
  v_count integer;
begin
  perform private.require_role(p_cafe, 'manager');
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'E_INVALID_RANGE';
  end if;
  select c.timezone into v_tz from public.cafes c where c.id = p_cafe;

  update public.order_items i
  set unit_cost = greatest(round(
        coalesce(private.product_unit_cost(i.product_id), 0)
        + coalesce((select sum(private.option_unit_cost(x)) from unnest(i.option_ids) as x), 0),
      4), 0)
  from public.orders o
  where o.id = i.order_id
    and o.cafe_id = p_cafe
    and i.product_id is not null
    and (
      o.status = 'open'
      or (o.closed_at >= ((p_from::timestamp + private.day_cutoff()) at time zone v_tz)
          and o.closed_at < (((p_to + 1)::timestamp + private.day_cutoff()) at time zone v_tz))
    );
  get diagnostics v_count = row_count;
  return jsonb_build_object('updated', v_count);
end
$$;

-- function · public.menu_reorder(uuid, text, uuid[])

CREATE FUNCTION public.menu_reorder(p_cafe uuid, p_kind text, p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_role(p_cafe, 'manager');
  if cardinality(coalesce(p_ids, '{}'::uuid[])) > 500 then
    raise exception 'E_INVALID_INPUT';
  end if;

  case p_kind
    when 'categories' then
      update public.categories t set sort_order = x.ord - 1
      from unnest(p_ids) with ordinality as x(id, ord)
      where t.id = x.id and t.cafe_id = p_cafe;
    when 'products' then
      update public.products t set sort_order = x.ord - 1
      from unnest(p_ids) with ordinality as x(id, ord)
      where t.id = x.id and t.cafe_id = p_cafe;
    when 'groups' then
      update public.option_groups t set sort_order = x.ord - 1
      from unnest(p_ids) with ordinality as x(id, ord)
      where t.id = x.id and t.cafe_id = p_cafe;
    when 'areas' then
      update public.areas t set sort_order = x.ord - 1
      from unnest(p_ids) with ordinality as x(id, ord)
      where t.id = x.id and t.cafe_id = p_cafe;
    when 'tables' then
      update public.dining_tables t set sort_order = x.ord - 1
      from unnest(p_ids) with ordinality as x(id, ord)
      where t.id = x.id and t.cafe_id = p_cafe;
    else
      raise exception 'E_INVALID_INPUT';
  end case;
end
$$;

-- function · public.menu_reorder_favorites(uuid, uuid[])

CREATE FUNCTION public.menu_reorder_favorites(p_cafe uuid, p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_role(p_cafe, 'manager');
  if cardinality(coalesce(p_ids, '{}'::uuid[])) > 200 then
    raise exception 'E_INVALID_INPUT';
  end if;
  update public.products t set favorite_rank = x.ord - 1
  from unnest(p_ids) with ordinality as x(id, ord)
  where t.id = x.id and t.cafe_id = p_cafe and t.favorite_rank is not null;
end
$$;

-- function · public.menu_save_category(uuid, jsonb)

CREATE FUNCTION public.menu_save_category(p_cafe uuid, p_category jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_id uuid := nullif(p_category ->> 'id', '')::uuid;
  v_name text := private.clean_text(p_category ->> 'name', 40);
  v_subtitle text := private.clean_text(p_category ->> 'subtitle', 60);
begin
  perform private.require_role(p_cafe, 'manager');
  if v_name = '' then
    raise exception 'E_NAME_REQUIRED';
  end if;

  if v_id is null then
    insert into public.categories (cafe_id, name, subtitle, sort_order)
    values (p_cafe, v_name, v_subtitle,
      coalesce((select max(c.sort_order) + 1 from public.categories c where c.cafe_id = p_cafe), 0))
    returning id into v_id;
  else
    update public.categories
    set name = v_name, subtitle = v_subtitle
    where id = v_id and cafe_id = p_cafe;
    if not found then
      raise exception 'E_NOT_FOUND';
    end if;
  end if;
  return jsonb_build_object('id', v_id);
end
$$;

-- function · public.menu_save_group(uuid, jsonb)

CREATE FUNCTION public.menu_save_group(p_cafe uuid, p_group jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_id uuid := nullif(p_group ->> 'id', '')::uuid;
  v_name text := private.clean_text(p_group ->> 'name', 40);
  v_selection public.option_selection := coalesce(nullif(p_group ->> 'selection', ''), 'single')::public.option_selection;
  v_required boolean := coalesce((p_group ->> 'is_required')::boolean, false);
  v_option jsonb;
  v_option_id uuid;
  v_option_name text;
  v_ord integer := 0;
  v_keep uuid[] := '{}';
  v_default_taken boolean := false;
  v_is_default boolean;
begin
  perform private.require_role(p_cafe, 'manager');
  if v_name = '' then
    raise exception 'E_NAME_REQUIRED';
  end if;
  if jsonb_array_length(coalesce(p_group -> 'options', '[]'::jsonb)) > 50 then
    raise exception 'E_INVALID_INPUT';
  end if;

  if v_id is null then
    insert into public.option_groups (cafe_id, name, selection, is_required, sort_order)
    values (p_cafe, v_name, v_selection, v_required,
      coalesce((select max(g.sort_order) + 1 from public.option_groups g where g.cafe_id = p_cafe), 0))
    returning id into v_id;
  else
    update public.option_groups
    set name = v_name, selection = v_selection, is_required = v_required
    where id = v_id and cafe_id = p_cafe;
    if not found then
      raise exception 'E_NOT_FOUND';
    end if;
  end if;

  for v_option in select * from jsonb_array_elements(coalesce(p_group -> 'options', '[]'::jsonb))
  loop
    v_option_name := private.clean_text(v_option ->> 'name', 40);
    continue when v_option_name = '';

    v_option_id := nullif(v_option ->> 'id', '')::uuid;
    v_is_default := coalesce((v_option ->> 'is_default')::boolean, false);
    if v_selection = 'single' and v_is_default then
      if v_default_taken then
        v_is_default := false;
      end if;
      v_default_taken := true;
    end if;

    if v_option_id is not null and exists (
      select 1 from public.options o where o.id = v_option_id and o.group_id = v_id and o.cafe_id = p_cafe
    ) then
      update public.options
      set name = v_option_name,
          price_delta = round(coalesce((v_option ->> 'price_delta')::numeric, 0), 2),
          cost_mode = coalesce(nullif(v_option ->> 'cost_mode', ''), 'fixed')::public.cost_mode,
          fixed_cost = round(coalesce((v_option ->> 'fixed_cost')::numeric, 0), 4),
          is_default = v_is_default,
          is_active = coalesce((v_option ->> 'is_active')::boolean, true),
          sort_order = v_ord
      where id = v_option_id;
    else
      insert into public.options (cafe_id, group_id, name, price_delta, cost_mode, fixed_cost, is_default, is_active, sort_order)
      values (
        p_cafe, v_id, v_option_name,
        round(coalesce((v_option ->> 'price_delta')::numeric, 0), 2),
        coalesce(nullif(v_option ->> 'cost_mode', ''), 'fixed')::public.cost_mode,
        round(coalesce((v_option ->> 'fixed_cost')::numeric, 0), 4),
        v_is_default,
        coalesce((v_option ->> 'is_active')::boolean, true),
        v_ord
      )
      returning id into v_option_id;
    end if;

    if v_option ? 'recipe' then
      delete from public.recipe_items where option_id = v_option_id;
      insert into public.recipe_items (cafe_id, option_id, ingredient_id, quantity)
      select p_cafe, v_option_id, (r ->> 'ingredient_id')::uuid, round((r ->> 'quantity')::numeric, 3)
      from jsonb_array_elements(v_option -> 'recipe') as r
      where coalesce((r ->> 'quantity')::numeric, 0) <> 0;
    end if;

    v_keep := v_keep || v_option_id;
    v_ord := v_ord + 1;
  end loop;

  delete from public.options o where o.group_id = v_id and not (o.id = any (v_keep));
  return jsonb_build_object('id', v_id);
end
$$;

-- function · public.menu_save_ingredient(uuid, jsonb)

CREATE FUNCTION public.menu_save_ingredient(p_cafe uuid, p_ingredient jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_id uuid := nullif(p_ingredient ->> 'id', '')::uuid;
  v_name text := private.clean_text(p_ingredient ->> 'name', 60);
  v_unit public.stock_unit := coalesce(nullif(p_ingredient ->> 'unit', ''), 'g')::public.stock_unit;
  v_size numeric := round((p_ingredient ->> 'package_size')::numeric, 3);
  v_price numeric := round(coalesce((p_ingredient ->> 'package_price')::numeric, 0), 2);
begin
  perform private.require_role(p_cafe, 'manager');
  if v_name = '' then
    raise exception 'E_NAME_REQUIRED';
  end if;
  if v_size is null or v_size <= 0 or v_price < 0 then
    raise exception 'E_INVALID_INPUT';
  end if;

  if v_id is null then
    insert into public.ingredients (cafe_id, name, unit, package_size, package_price)
    values (p_cafe, v_name, v_unit, v_size, v_price)
    returning id into v_id;
  else
    update public.ingredients
    set name = v_name, unit = v_unit, package_size = v_size, package_price = v_price, updated_at = now()
    where id = v_id and cafe_id = p_cafe;
    if not found then
      raise exception 'E_NOT_FOUND';
    end if;
  end if;
  return jsonb_build_object('id', v_id);
end
$$;

-- function · public.menu_save_product(uuid, jsonb)

CREATE FUNCTION public.menu_save_product(p_cafe uuid, p_product jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_id uuid := nullif(p_product ->> 'id', '')::uuid;
  v_name text := private.clean_text(p_product ->> 'name', 60);
  v_description text := private.clean_text(p_product ->> 'description', 200);
  v_category uuid := nullif(p_product ->> 'category_id', '')::uuid;
  v_price numeric := round((p_product ->> 'price')::numeric, 2);
  v_cost_mode public.cost_mode := coalesce(nullif(p_product ->> 'cost_mode', ''), 'recipe')::public.cost_mode;
  v_fixed_cost numeric := round(coalesce((p_product ->> 'fixed_cost')::numeric, 0), 4);
  v_is_active boolean := coalesce((p_product ->> 'is_active')::boolean, true);
  v_tags text[];
begin
  perform private.require_role(p_cafe, 'manager');

  if v_name = '' then
    raise exception 'E_NAME_REQUIRED';
  end if;
  if v_price is null or v_price < 0 then
    raise exception 'E_INVALID_PRICE';
  end if;
  if v_category is not null and not exists (
    select 1 from public.categories c where c.id = v_category and c.cafe_id = p_cafe
  ) then
    raise exception 'E_NOT_FOUND';
  end if;

  select coalesce(array_agg(distinct t order by t), '{}'::text[]) into v_tags
  from jsonb_array_elements_text(coalesce(p_product -> 'tags', '[]'::jsonb)) as t;

  if v_id is null then
    insert into public.products (
      cafe_id, category_id, name, description, price, cost_mode, fixed_cost, tags, is_active, sort_order
    )
    values (
      p_cafe, v_category, v_name, v_description, v_price, v_cost_mode, v_fixed_cost, v_tags, v_is_active,
      coalesce((
        select max(p.sort_order) + 1 from public.products p
        where p.cafe_id = p_cafe and p.category_id is not distinct from v_category
      ), 0)
    )
    returning id into v_id;
  else
    update public.products
    set category_id = v_category,
        name = v_name,
        description = v_description,
        price = v_price,
        cost_mode = v_cost_mode,
        fixed_cost = v_fixed_cost,
        tags = v_tags,
        is_active = v_is_active,
        updated_at = now()
    where id = v_id and cafe_id = p_cafe;
    if not found then
      raise exception 'E_NOT_FOUND';
    end if;
  end if;

  if p_product ? 'recipe' then
    delete from public.recipe_items where product_id = v_id;
    -- (cafe_id, ingredient_id) yabancı anahtarı başka kafenin hammaddesini engeller
    insert into public.recipe_items (cafe_id, product_id, ingredient_id, quantity)
    select p_cafe, v_id, (r ->> 'ingredient_id')::uuid, round((r ->> 'quantity')::numeric, 3)
    from jsonb_array_elements(p_product -> 'recipe') as r
    where coalesce((r ->> 'quantity')::numeric, 0) > 0;
  end if;

  if p_product ? 'group_ids' then
    delete from public.product_option_groups where product_id = v_id;
    insert into public.product_option_groups (cafe_id, product_id, group_id, sort_order)
    select p_cafe, v_id, g.value::uuid, (g.ordinality - 1)::integer
    from jsonb_array_elements_text(p_product -> 'group_ids') with ordinality as g;
  end if;

  return jsonb_build_object('id', v_id);
end
$$;

-- function · public.menu_set_favorite(uuid, uuid, boolean)

CREATE FUNCTION public.menu_set_favorite(p_cafe uuid, p_product uuid, p_favorite boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_role(p_cafe, 'manager');
  update public.products p
  set favorite_rank = case
        when not coalesce(p_favorite, false) then null
        when p.favorite_rank is not null then p.favorite_rank
        else coalesce((select max(x.favorite_rank) + 1 from public.products x where x.cafe_id = p_cafe), 0)
      end,
      updated_at = now()
  where p.id = p_product and p.cafe_id = p_cafe;
  if not found then
    raise exception 'E_PRODUCT_NOT_FOUND';
  end if;
end
$$;

-- function · public.menu_set_product_active(uuid, uuid, boolean)

CREATE FUNCTION public.menu_set_product_active(p_cafe uuid, p_id uuid, p_is_active boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_role(p_cafe, 'manager');
  update public.products
  set is_active = coalesce(p_is_active, true), updated_at = now()
  where id = p_id and cafe_id = p_cafe;
  if not found then
    raise exception 'E_NOT_FOUND';
  end if;
end
$$;

-- function · public.pos_add_item(uuid, uuid, uuid, uuid[], integer, text, numeric)

CREATE FUNCTION public.pos_add_item(p_cafe uuid, p_table uuid, p_product uuid, p_option_ids uuid[] DEFAULT '{}'::uuid[], p_quantity integer DEFAULT 1, p_note text DEFAULT ''::text, p_price numeric DEFAULT NULL::numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
  v_table public.dining_tables;
  v_product public.products;
  v_line record;
  v_order uuid;
  v_item uuid;
  v_note text := private.clean_text(p_note, 120);
begin
  perform private.require_role(p_cafe, 'staff');
  perform private.require_open_day(p_cafe);

  if p_quantity is null or p_quantity < 1 or p_quantity > 99 then
    raise exception 'E_INVALID_QUANTITY';
  end if;

  -- Masa satırını kilitle: aynı masaya eşzamanlı eklemeler sıraya girer
  select * into v_table
  from public.dining_tables t
  where t.id = p_table and t.cafe_id = p_cafe
  for update;
  if not found then
    raise exception 'E_TABLE_NOT_FOUND';
  end if;
  if not v_table.is_active then
    raise exception 'E_TABLE_INACTIVE';
  end if;

  select * into v_product
  from public.products p
  where p.id = p_product and p.cafe_id = p_cafe and p.is_active;
  if not found then
    raise exception 'E_PRODUCT_NOT_FOUND';
  end if;

  if v_product.is_open_price then
    -- Joker: fiyat satışta girilir, maliyet 0
    if p_price is null or p_price <= 0 or p_price >= 100000 then
      raise exception 'E_INVALID_PRICE';
    end if;
    select
      v_product.id as product_id,
      v_product.name as product_name,
      coalesce((select c.name from public.categories c where c.id = v_product.category_id), '') as category_name,
      '{}'::uuid[] as option_ids,
      '' as options_label,
      round(p_price, 2) as unit_price,
      0::numeric as unit_cost
    into v_line;
  else
    select * into v_line from private.resolve_line(p_cafe, p_product, p_option_ids);
  end if;

  select o.id into v_order
  from public.orders o
  where o.table_id = p_table and o.status = 'open';

  if v_order is null then
    insert into public.orders (cafe_id, table_id, table_name, is_takeaway, opened_by)
    values (p_cafe, p_table, v_table.name, v_table.is_takeaway, v_uid)
    returning id into v_order;
  end if;

  -- Aynı turda eklenmiş özdeş satır varsa adedini artır
  select i.id into v_item
  from public.order_items i
  where i.order_id = v_order
    and i.product_id = v_line.product_id
    and i.option_ids = v_line.option_ids
    and i.note = v_note
    and not i.is_comp
    and i.unit_price = v_line.unit_price
    and i.unit_discount = 0
    and i.split_parts = 1
    and i.created_at > now() - private.round_gap()
  order by i.created_at desc
  limit 1
  for update;

  if v_item is not null then
    update public.order_items
    set quantity = least(quantity + p_quantity, 999)
    where id = v_item;
  else
    insert into public.order_items (
      cafe_id, order_id, product_id, product_name, category_name,
      option_ids, options_label, quantity, unit_price, list_price, unit_cost, note, created_by
    )
    values (
      p_cafe, v_order, v_line.product_id, v_line.product_name, v_line.category_name,
      v_line.option_ids, v_line.options_label, p_quantity, v_line.unit_price, v_line.unit_price,
      v_line.unit_cost, v_note, v_uid
    );
  end if;

  perform private.touch_order(v_order);
  return public.pos_table_order(p_cafe, p_table);
end
$$;

-- function · public.pos_cancel_order(uuid, uuid, text)

CREATE FUNCTION public.pos_cancel_order(p_cafe uuid, p_order uuid, p_reason text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders;
begin
  perform private.require_role(p_cafe, 'staff');

  select o.* into v_order
  from public.orders o
  where o.id = p_order and o.cafe_id = p_cafe
  for update;
  if not found then
    raise exception 'E_ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'open' then
    raise exception 'E_ORDER_CLOSED';
  end if;
  if exists (select 1 from public.payments p where p.order_id = v_order.id) then
    raise exception 'E_ORDER_HAS_PAYMENTS';
  end if;

  if not exists (select 1 from public.order_items i where i.order_id = v_order.id) then
    delete from public.orders where id = v_order.id;
  else
    update public.orders
    set status = 'cancelled',
        closed_at = now(),
        closed_by = v_uid,
        cancel_reason = private.clean_text(p_reason, 200),
        updated_at = now()
    where id = v_order.id;
  end if;

  return jsonb_build_object('ok', true, 'table_id', v_order.table_id);
end
$$;

-- function · public.pos_change_payment_method(uuid, uuid, public.payment_method)

CREATE FUNCTION public.pos_change_payment_method(p_cafe uuid, p_payment uuid, p_method public.payment_method) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_role public.member_role;
  v_payment public.payments;
  v_rate numeric := 0;
begin
  v_role := private.require_role(p_cafe, 'staff');

  select p.* into v_payment
  from public.payments p
  where p.id = p_payment and p.cafe_id = p_cafe
  for update;
  if not found then
    raise exception 'E_PAYMENT_NOT_FOUND';
  end if;

  if private.role_rank(v_role) < private.role_rank('manager')
     and v_payment.created_at < now() - interval '60 minutes' then
    raise exception 'E_FORBIDDEN' using errcode = '42501';
  end if;

  v_rate := coalesce(private.method_rate(p_cafe, p_method), 0);

  update public.payments
  set method = p_method,
      commission_rate = v_rate,
      commission_amount = round(amount * v_rate, 2)
  where id = v_payment.id;

  update public.orders set updated_at = now() where id = v_payment.order_id;
  return private.order_json(v_payment.order_id);
end
$$;

-- function · public.pos_change_quantity(uuid, uuid, integer)

CREATE FUNCTION public.pos_change_quantity(p_cafe uuid, p_item uuid, p_delta integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
  v_item public.order_items;
  v_order public.orders;
  v_recent uuid;
begin
  perform private.require_role(p_cafe, 'staff');

  if p_delta is null or p_delta = 0 or abs(p_delta) > 99 then
    raise exception 'E_INVALID_QUANTITY';
  end if;

  select i.* into v_item
  from public.order_items i
  where i.id = p_item and i.cafe_id = p_cafe;
  if not found then
    raise exception 'E_ITEM_NOT_FOUND';
  end if;

  select o.* into v_order
  from public.orders o
  where o.id = v_item.order_id
  for update;
  if v_order.status <> 'open' then
    raise exception 'E_ORDER_CLOSED';
  end if;

  select i.* into v_item from public.order_items i where i.id = p_item for update;
  if not found then
    raise exception 'E_ITEM_NOT_FOUND';
  end if;

  if p_delta < 0 then
    if (v_item.quantity + p_delta) * v_item.split_parts < private.item_paid_qty(v_item.id) then
      raise exception 'E_ITEM_PAID';
    end if;
    if v_item.quantity + p_delta <= 0 then
      delete from public.order_items where id = v_item.id;
    else
      update public.order_items set quantity = quantity + p_delta where id = v_item.id;
    end if;
  elsif v_item.created_at > now() - private.round_gap() then
    update public.order_items set quantity = least(quantity + p_delta, 999) where id = v_item.id;
  else
    -- Aynı ürünün bu turdaki kopyası zaten açıldıysa ona ekle
    select i.id into v_recent
    from public.order_items i
    where i.order_id = v_item.order_id
      and i.id <> v_item.id
      and i.product_id is not distinct from v_item.product_id
      and i.product_name = v_item.product_name
      and i.option_ids = v_item.option_ids
      and i.note = v_item.note
      and i.is_comp = v_item.is_comp
      and i.unit_price = v_item.unit_price
      and i.unit_discount = v_item.unit_discount
      and i.split_parts = v_item.split_parts
      and i.created_at > now() - private.round_gap()
    order by i.created_at desc
    limit 1
    for update;

    if v_recent is not null then
      update public.order_items set quantity = least(quantity + p_delta, 999) where id = v_recent;
    else
      insert into public.order_items (
        cafe_id, order_id, product_id, product_name, category_name,
        option_ids, options_label, quantity, unit_price, list_price, unit_discount, split_parts, unit_cost, is_comp, note, created_by
      )
      values (
        v_item.cafe_id, v_item.order_id, v_item.product_id, v_item.product_name, v_item.category_name,
        v_item.option_ids, v_item.options_label, p_delta, v_item.unit_price, v_item.list_price, v_item.unit_discount, v_item.split_parts,
        v_item.unit_cost, v_item.is_comp, v_item.note, v_uid
      );
    end if;
  end if;

  perform private.touch_order(v_order.id);
  return public.pos_table_order(p_cafe, v_order.table_id);
end
$$;

-- function · public.pos_delete_payment(uuid, uuid)

CREATE FUNCTION public.pos_delete_payment(p_cafe uuid, p_payment uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_payment public.payments;
  v_order public.orders;
begin
  perform private.require_role(p_cafe, 'staff');

  select p.* into v_payment
  from public.payments p
  where p.id = p_payment and p.cafe_id = p_cafe;
  if not found then
    raise exception 'E_PAYMENT_NOT_FOUND';
  end if;

  select o.* into v_order from public.orders o where o.id = v_payment.order_id for update;
  if v_order.status <> 'open' then
    raise exception 'E_ORDER_CLOSED';
  end if;

  delete from public.payments where id = v_payment.id;
  perform private.touch_order(v_order.id);
  return public.pos_table_order(p_cafe, v_order.table_id);
end
$$;

-- function · public.pos_floor(uuid)

CREATE FUNCTION public.pos_floor(p_cafe uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_tz text;
  v_today date;
  v_totals record;
  v_day public.cafe_days;
begin
  perform private.require_role(p_cafe, 'staff');
  select c.timezone into v_tz from public.cafes c where c.id = p_cafe;
  v_today := private.biz_date(now(), v_tz);
  select * into v_day from private.open_day(p_cafe);
  select * into v_totals from private.day_totals(p_cafe, v_today);

  return jsonb_build_object(
    'now', now(),
    'business_date', v_today,
    'day', case when v_day.id is null then null else jsonb_build_object(
      'id', v_day.id,
      'business_date', v_day.business_date,
      'opened_at', v_day.opened_at
    ) end,
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name) order by a.sort_order, a.name)
      from public.areas a
      where a.cafe_id = p_cafe
    ), '[]'::jsonb),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'area_id', t.area_id,
        'is_takeaway', t.is_takeaway,
        'order', case when o.id is null then null else jsonb_build_object(
          'id', o.id,
          'opened_at', o.opened_at,
          'total', ot.total,
          'paid', ot.paid,
          'items', ot.items
        ) end
      ) order by t.sort_order, t.name)
      from public.dining_tables t
      left join public.orders o on o.table_id = t.id and o.status = 'open'
      left join lateral private.order_totals(o.id) ot on o.id is not null
      where t.cafe_id = p_cafe and t.is_active
    ), '[]'::jsonb),
    'today', jsonb_build_object(
      'date', v_today,
      'orders', v_totals.orders,
      'items', v_totals.items,
      'revenue', v_totals.revenue,
      'cost', v_totals.cost,
      'commission', v_totals.commission,
      'profit', round(v_totals.revenue - v_totals.cost - v_totals.commission, 2)
    )
  );
end
$$;

-- function · public.pos_history(uuid, date)

CREATE FUNCTION public.pos_history(p_cafe uuid, p_date date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_role public.member_role;
  v_tz text;
  v_today date;
begin
  v_role := private.require_role(p_cafe, 'staff');
  select c.timezone into v_tz from public.cafes c where c.id = p_cafe;
  v_today := ((now() at time zone v_tz) - private.day_cutoff())::date;

  if p_date is null or p_date > v_today then
    raise exception 'E_INVALID_DATE';
  end if;
  if private.role_rank(v_role) < private.role_rank('manager') and p_date < v_today - 1 then
    raise exception 'E_FORBIDDEN' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'date', p_date,
    'today', v_today,
    'orders', coalesce((
      select jsonb_agg(private.order_json(o.id) order by o.closed_at desc)
      from public.orders o
      where o.cafe_id = p_cafe
        and o.status in ('paid', 'cancelled')
        and o.closed_at >= ((p_date::timestamp + private.day_cutoff()) at time zone v_tz)
        and o.closed_at < (((p_date + 1)::timestamp + private.day_cutoff()) at time zone v_tz)
    ), '[]'::jsonb)
  );
end
$$;

-- function · public.pos_menu(uuid)

CREATE FUNCTION public.pos_menu(p_cafe uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_role(p_cafe, 'staff');
  return jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'subtitle', c.subtitle)
        order by c.sort_order, c.name)
      from public.categories c
      where c.cafe_id = p_cafe
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'category_id', p.category_id,
        'name', p.name,
        'description', p.description,
        'price', p.price,
        'is_open_price', p.is_open_price,
        'favorite_rank', p.favorite_rank,
        'tags', to_jsonb(p.tags),
        'group_ids', case when p.is_open_price then '[]'::jsonb else coalesce((
          select jsonb_agg(pog.group_id order by pog.sort_order)
          from public.product_option_groups pog
          where pog.product_id = p.id
        ), '[]'::jsonb) end
      ) order by p.sort_order, p.name)
      from public.products p
      where p.cafe_id = p_cafe and p.is_active
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'selection', g.selection,
        'is_required', g.is_required,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', o.id,
            'name', o.name,
            'price_delta', o.price_delta,
            'is_default', o.is_default
          ) order by o.sort_order, o.name)
          from public.options o
          where o.group_id = g.id and o.is_active
        ), '[]'::jsonb)
      ) order by g.sort_order, g.name)
      from public.option_groups g
      where g.cafe_id = p_cafe
    ), '[]'::jsonb)
  );
end
$$;

-- function · public.pos_move_order(uuid, uuid, uuid)

CREATE FUNCTION public.pos_move_order(p_cafe uuid, p_order uuid, p_target_table uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_order public.orders;
  v_target public.dining_tables;
  v_target_order public.orders;
begin
  perform private.require_role(p_cafe, 'staff');

  select o.* into v_order
  from public.orders o
  where o.id = p_order and o.cafe_id = p_cafe;
  if not found then
    raise exception 'E_ORDER_NOT_FOUND';
  end if;

  -- Kilitlenme olmaması için iki masayı her zaman aynı sırayla kilitle
  perform 1
  from public.dining_tables t
  where t.cafe_id = p_cafe and t.id in (v_order.table_id, p_target_table)
  order by t.id
  for update;

  select o.* into v_order from public.orders o where o.id = p_order for update;
  if v_order.status <> 'open' then
    raise exception 'E_ORDER_CLOSED';
  end if;
  if v_order.table_id = p_target_table then
    raise exception 'E_SAME_TABLE';
  end if;

  select t.* into v_target
  from public.dining_tables t
  where t.id = p_target_table and t.cafe_id = p_cafe and t.is_active;
  if not found then
    raise exception 'E_TABLE_NOT_FOUND';
  end if;

  select o.* into v_target_order
  from public.orders o
  where o.table_id = p_target_table and o.status = 'open'
  for update;

  if v_target_order.id is null then
    update public.orders
    set table_id = v_target.id,
        table_name = v_target.name,
        is_takeaway = v_target.is_takeaway,
        updated_at = now()
    where id = v_order.id;
  else
    update public.order_items set order_id = v_target_order.id where order_id = v_order.id;
    update public.payments set order_id = v_target_order.id where order_id = v_order.id;
    update public.orders
    set opened_at = least(opened_at, v_order.opened_at),
        extra_discount = extra_discount + v_order.extra_discount,
        guests = case when guests is null and v_order.guests is null then null else coalesce(guests, 0) + coalesce(v_order.guests, 0) end,
        note = left(concat_ws(' · ', nullif(note, ''), nullif(v_order.note, '')), 200),
        updated_at = now()
    where id = v_target_order.id;
    perform private.sync_discount(v_target_order.id);
    delete from public.orders where id = v_order.id;
  end if;

  return public.pos_table_order(p_cafe, v_target.id);
end
$$;

-- function · public.pos_pay(uuid, uuid, public.payment_method, numeric)

CREATE FUNCTION public.pos_pay(p_cafe uuid, p_order uuid, p_method public.payment_method, p_amount numeric DEFAULT NULL::numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders;
  v_tot record;
  v_amount numeric;
  v_rate numeric := 0;
begin
  perform private.require_role(p_cafe, 'staff');

  select o.* into v_order
  from public.orders o
  where o.id = p_order and o.cafe_id = p_cafe
  for update;
  if not found then
    raise exception 'E_ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'open' then
    raise exception 'E_ORDER_CLOSED';
  end if;

  select * into v_tot from private.order_totals(v_order.id);
  if v_tot.items = 0 then
    raise exception 'E_ORDER_EMPTY';
  end if;

  v_amount := round(coalesce(p_amount, v_tot.remaining), 2);
  if v_amount < 0 or (v_amount = 0 and v_tot.remaining > 0) then
    raise exception 'E_INVALID_AMOUNT';
  end if;
  if v_amount > v_tot.remaining then
    raise exception 'E_AMOUNT_EXCEEDS';
  end if;

  if v_amount > 0 then
    v_rate := coalesce(private.method_rate(p_cafe, p_method), 0);
    insert into public.payments (cafe_id, order_id, method, amount, commission_rate, commission_amount, created_by)
    values (p_cafe, v_order.id, p_method, v_amount, v_rate, round(v_amount * v_rate, 2), v_uid);
  end if;

  if v_tot.remaining - v_amount <= 0 then
    update public.orders
    set status = 'paid', closed_at = now(), closed_by = v_uid, updated_at = now()
    where id = v_order.id;
    return jsonb_build_object('closed', true, 'order', private.order_json(v_order.id));
  end if;

  update public.orders set updated_at = now() where id = v_order.id;
  return jsonb_build_object('closed', false, 'order', private.order_json(v_order.id));
end
$$;

-- function · public.pos_pay_items(uuid, uuid, public.payment_method, jsonb)

CREATE FUNCTION public.pos_pay_items(p_cafe uuid, p_order uuid, p_method public.payment_method, p_lines jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders;
  v_tot record;
  v_rate numeric := 0;
  v_total numeric := 0;
  v_amount numeric;
  v_line numeric;
  v_payment uuid;
  v_items uuid[] := '{}';
  v_qtys integer[] := '{}';
  v_amounts numeric[] := '{}';
  r record;
begin
  perform private.require_role(p_cafe, 'staff');

  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines) > 200 then
    raise exception 'E_INVALID_INPUT';
  end if;

  select o.* into v_order
  from public.orders o
  where o.id = p_order and o.cafe_id = p_cafe
  for update;
  if not found then
    raise exception 'E_ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'open' then
    raise exception 'E_ORDER_CLOSED';
  end if;

  for r in
    select
      a.item_id,
      a.qty,
      i.id as found_id,
      i.quantity,
      i.unit_price,
      i.unit_discount,
      i.is_comp,
      i.split_parts,
      coalesce(pq.qty, 0) as paid_qty,
      coalesce(pq.amount, 0) as paid_amount
    from (
      select (x ->> 'item_id')::uuid as item_id, sum((x ->> 'quantity')::integer)::integer as qty
      from jsonb_array_elements(p_lines) as x
      group by 1
    ) a
    left join public.order_items i on i.id = a.item_id and i.order_id = v_order.id
    left join lateral (
      select sum(pi.quantity)::integer as qty, sum(pi.amount) as amount
      from public.payment_items pi
      where pi.item_id = i.id
    ) pq on true
  loop
    if r.found_id is null then
      raise exception 'E_ITEM_NOT_FOUND';
    end if;
    if r.is_comp or r.qty is null or r.qty < 1 or r.qty > r.quantity * r.split_parts - r.paid_qty then
      raise exception 'E_INVALID_QUANTITY';
    end if;

    if r.qty = r.quantity * r.split_parts - r.paid_qty then
      v_line := greatest(round(r.quantity * (r.unit_price - r.unit_discount), 2) - r.paid_amount, 0);
    else
      v_line := round(r.qty * (r.unit_price - r.unit_discount) / r.split_parts, 2);
    end if;

    v_items := v_items || r.item_id;
    v_qtys := v_qtys || r.qty;
    v_amounts := v_amounts || v_line;
    v_total := v_total + v_line;
  end loop;

  select * into v_tot from private.order_totals(v_order.id);
  -- Adisyon indirimi ya da tutarla alınmış ödeme varsa kalanı aşma
  v_amount := least(round(v_total, 2), v_tot.remaining);

  if v_amount <= 0 and v_tot.remaining > 0 then
    raise exception 'E_INVALID_AMOUNT';
  end if;

  if v_amount > 0 then
    v_rate := coalesce(private.method_rate(p_cafe, p_method), 0);
    insert into public.payments (cafe_id, order_id, method, amount, commission_rate, commission_amount, created_by)
    values (p_cafe, v_order.id, p_method, v_amount, v_rate, round(v_amount * v_rate, 2), v_uid)
    returning id into v_payment;

    insert into public.payment_items (payment_id, item_id, cafe_id, quantity, amount)
    select v_payment, x.item_id, p_cafe, x.qty, x.amount
    from unnest(v_items, v_qtys, v_amounts) as x(item_id, qty, amount);
  end if;

  if v_tot.remaining - v_amount <= 0 then
    update public.orders
    set status = 'paid', closed_at = now(), closed_by = v_uid, updated_at = now()
    where id = v_order.id;
    return jsonb_build_object('closed', true, 'order', private.order_json(v_order.id));
  end if;

  update public.orders set updated_at = now() where id = v_order.id;
  return jsonb_build_object('closed', false, 'order', private.order_json(v_order.id));
end
$$;

-- function · public.pos_price_item(uuid, uuid, numeric, numeric)

CREATE FUNCTION public.pos_price_item(p_cafe uuid, p_item uuid, p_unit_price numeric, p_unit_discount numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_item public.order_items;
  v_order public.orders;
  v_price numeric := round(p_unit_price, 2);
  v_discount numeric := round(coalesce(p_unit_discount, 0), 2);
begin
  perform private.require_role(p_cafe, 'staff');

  if v_price is null or v_price < 0 or v_price >= 100000 then
    raise exception 'E_INVALID_PRICE';
  end if;
  if v_discount < 0 or v_discount > v_price then
    raise exception 'E_INVALID_DISCOUNT';
  end if;

  select i.* into v_item
  from public.order_items i
  where i.id = p_item and i.cafe_id = p_cafe;
  if not found then
    raise exception 'E_ITEM_NOT_FOUND';
  end if;

  select o.* into v_order from public.orders o where o.id = v_item.order_id for update;
  if v_order.status <> 'open' then
    raise exception 'E_ORDER_CLOSED';
  end if;
  if private.item_paid_qty(v_item.id) > 0 then
    raise exception 'E_ITEM_PAID';
  end if;

  update public.order_items
  set unit_price = v_price,
      unit_discount = v_discount
  where id = v_item.id;

  perform private.touch_order(v_order.id);
  return public.pos_table_order(p_cafe, v_order.table_id);
end
$$;

-- function · public.pos_remove_item(uuid, uuid)

CREATE FUNCTION public.pos_remove_item(p_cafe uuid, p_item uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_item public.order_items;
  v_order public.orders;
begin
  perform private.require_role(p_cafe, 'staff');

  select i.* into v_item
  from public.order_items i
  where i.id = p_item and i.cafe_id = p_cafe;
  if not found then
    raise exception 'E_ITEM_NOT_FOUND';
  end if;

  select o.* into v_order from public.orders o where o.id = v_item.order_id for update;
  if v_order.status <> 'open' then
    raise exception 'E_ORDER_CLOSED';
  end if;
  if private.item_paid_qty(v_item.id) > 0 then
    raise exception 'E_ITEM_PAID';
  end if;

  delete from public.order_items where id = v_item.id;
  perform private.touch_order(v_order.id);
  return public.pos_table_order(p_cafe, v_order.table_id);
end
$$;

-- function · public.pos_reopen_order(uuid, uuid)

CREATE FUNCTION public.pos_reopen_order(p_cafe uuid, p_order uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_role public.member_role;
  v_order public.orders;
begin
  v_role := private.require_role(p_cafe, 'staff');

  select o.* into v_order
  from public.orders o
  where o.id = p_order and o.cafe_id = p_cafe;
  if not found then
    raise exception 'E_ORDER_NOT_FOUND';
  end if;
  if v_order.table_id is null then
    raise exception 'E_TABLE_NOT_FOUND';
  end if;
  if private.role_rank(v_role) < private.role_rank('manager')
     and (v_order.closed_at is null or v_order.closed_at < now() - interval '60 minutes') then
    raise exception 'E_FORBIDDEN' using errcode = '42501';
  end if;

  perform 1 from public.dining_tables t where t.id = v_order.table_id for update;
  select o.* into v_order from public.orders o where o.id = p_order for update;
  if v_order.status = 'open' then
    raise exception 'E_ORDER_OPEN';
  end if;
  if exists (select 1 from public.orders o where o.table_id = v_order.table_id and o.status = 'open') then
    raise exception 'E_TABLE_OCCUPIED';
  end if;

  delete from public.payments where order_id = v_order.id;
  update public.orders
  set status = 'open', closed_at = null, closed_by = null, cancel_reason = '', updated_at = now()
  where id = v_order.id;

  return public.pos_table_order(p_cafe, v_order.table_id);
end
$$;

-- function · public.pos_set_guests(uuid, uuid, integer)

CREATE FUNCTION public.pos_set_guests(p_cafe uuid, p_order uuid, p_guests integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_role public.member_role;
  v_order public.orders;
  v_tz text;
begin
  v_role := private.require_role(p_cafe, 'staff');
  if p_guests is not null and (p_guests < 1 or p_guests > 99) then
    raise exception 'E_INVALID_QUANTITY';
  end if;
  select c.timezone into v_tz from public.cafes c where c.id = p_cafe;

  select o.* into v_order from public.orders o where o.id = p_order and o.cafe_id = p_cafe for update;
  if not found then
    raise exception 'E_ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'open'
     and private.role_rank(v_role) < private.role_rank('manager')
     and private.biz_date(v_order.closed_at, v_tz) <> private.biz_date(now(), v_tz) then
    raise exception 'E_FORBIDDEN' using errcode = '42501';
  end if;

  update public.orders set guests = p_guests, updated_at = now() where id = v_order.id;
  if v_order.status = 'open' and v_order.table_id is not null then
    return public.pos_table_order(p_cafe, v_order.table_id);
  end if;
  return jsonb_build_object('order', private.order_json(v_order.id));
end
$$;

-- function · public.pos_split_item(uuid, uuid, integer)

CREATE FUNCTION public.pos_split_item(p_cafe uuid, p_item uuid, p_parts integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_item public.order_items;
  v_order public.orders;
begin
  perform private.require_role(p_cafe, 'staff');
  if p_parts is null or p_parts < 1 or p_parts > 20 then
    raise exception 'E_INVALID_QUANTITY';
  end if;

  select i.* into v_item from public.order_items i where i.id = p_item and i.cafe_id = p_cafe;
  if not found then
    raise exception 'E_ITEM_NOT_FOUND';
  end if;

  select o.* into v_order from public.orders o where o.id = v_item.order_id for update;
  if v_order.status <> 'open' then
    raise exception 'E_ORDER_CLOSED';
  end if;
  if private.item_paid_qty(v_item.id) > 0 then
    raise exception 'E_ITEM_PAID';
  end if;

  update public.order_items set split_parts = p_parts where id = v_item.id;
  perform private.touch_order(v_order.id);
  return public.pos_table_order(p_cafe, v_order.table_id);
end
$$;

-- function · public.pos_table_order(uuid, uuid)

CREATE FUNCTION public.pos_table_order(p_cafe uuid, p_table uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_table public.dining_tables;
  v_order uuid;
begin
  perform private.require_role(p_cafe, 'staff');

  select * into v_table
  from public.dining_tables t
  where t.id = p_table and t.cafe_id = p_cafe;
  if not found then
    raise exception 'E_TABLE_NOT_FOUND';
  end if;

  select o.id into v_order
  from public.orders o
  where o.table_id = p_table and o.status = 'open';

  return jsonb_build_object(
    'now', now(),
    'table', jsonb_build_object(
      'id', v_table.id,
      'name', v_table.name,
      'is_takeaway', v_table.is_takeaway,
      'is_active', v_table.is_active,
      'area_name', (select a.name from public.areas a where a.id = v_table.area_id)
    ),
    'order', case when v_order is null then null else private.order_json(v_order) end
  );
end
$$;

-- function · public.pos_update_item(uuid, uuid, uuid[], integer, text, boolean)

CREATE FUNCTION public.pos_update_item(p_cafe uuid, p_item uuid, p_option_ids uuid[], p_quantity integer, p_note text, p_is_comp boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_item public.order_items;
  v_order public.orders;
  v_line record;
  v_ids uuid[] := private.normalize_uuids(p_option_ids);
  v_paid integer;
begin
  perform private.require_role(p_cafe, 'staff');

  if p_quantity is null or p_quantity < 1 or p_quantity > 999 then
    raise exception 'E_INVALID_QUANTITY';
  end if;

  select i.* into v_item
  from public.order_items i
  where i.id = p_item and i.cafe_id = p_cafe;
  if not found then
    raise exception 'E_ITEM_NOT_FOUND';
  end if;

  select o.* into v_order from public.orders o where o.id = v_item.order_id for update;
  if v_order.status <> 'open' then
    raise exception 'E_ORDER_CLOSED';
  end if;

  v_paid := private.item_paid_qty(v_item.id);
  if v_paid > 0 and (
    p_quantity * v_item.split_parts < v_paid
    or v_ids is distinct from v_item.option_ids
    or coalesce(p_is_comp, false) <> v_item.is_comp
  ) then
    raise exception 'E_ITEM_PAID';
  end if;

  if v_ids is distinct from v_item.option_ids then
    if v_item.product_id is null then
      raise exception 'E_PRODUCT_NOT_FOUND';
    end if;
    select * into v_line from private.resolve_line(p_cafe, v_item.product_id, v_ids);
    update public.order_items
    set option_ids = v_line.option_ids,
        options_label = v_line.options_label,
        unit_price = v_line.unit_price,
        list_price = v_line.unit_price,
        unit_discount = least(unit_discount, v_line.unit_price),
        unit_cost = v_line.unit_cost
    where id = v_item.id;
  end if;

  update public.order_items
  set quantity = p_quantity,
      note = private.clean_text(p_note, 120),
      is_comp = coalesce(p_is_comp, false)
  where id = v_item.id;

  perform private.touch_order(v_order.id);
  return public.pos_table_order(p_cafe, v_order.table_id);
end
$$;

-- function · public.pos_update_order(uuid, uuid, text, numeric)

CREATE FUNCTION public.pos_update_order(p_cafe uuid, p_order uuid, p_note text, p_discount numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_order public.orders;
  v_subtotal numeric;
  v_line_discount numeric;
  v_paid numeric;
  v_discount numeric := round(coalesce(p_discount, 0), 2);
begin
  perform private.require_role(p_cafe, 'staff');

  select o.* into v_order
  from public.orders o
  where o.id = p_order and o.cafe_id = p_cafe
  for update;
  if not found then
    raise exception 'E_ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'open' then
    raise exception 'E_ORDER_CLOSED';
  end if;

  select
    coalesce(sum(i.quantity * i.unit_price) filter (where not i.is_comp), 0),
    coalesce(sum(i.quantity * i.unit_discount) filter (where not i.is_comp), 0)
  into v_subtotal, v_line_discount
  from public.order_items i
  where i.order_id = v_order.id;
  select coalesce(sum(p.amount), 0) into v_paid from public.payments p where p.order_id = v_order.id;

  if v_discount < 0 or v_discount + v_line_discount > v_subtotal then
    raise exception 'E_INVALID_DISCOUNT';
  end if;
  if v_subtotal - v_line_discount - v_discount < v_paid then
    raise exception 'E_DISCOUNT_BELOW_PAID';
  end if;

  update public.orders
  set note = private.clean_text(p_note, 200),
      extra_discount = v_discount,
      updated_at = now()
  where id = v_order.id;
  perform private.sync_discount(v_order.id);

  return public.pos_table_order(p_cafe, v_order.table_id);
end
$$;

-- function · public.pos_void_order(uuid, uuid, text)

CREATE FUNCTION public.pos_void_order(p_cafe uuid, p_order uuid, p_reason text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.member_role;
  v_order public.orders;
  v_tz text;
begin
  v_role := private.require_role(p_cafe, 'staff');
  select c.timezone into v_tz from public.cafes c where c.id = p_cafe;

  select o.* into v_order
  from public.orders o
  where o.id = p_order and o.cafe_id = p_cafe
  for update;
  if not found then
    raise exception 'E_ORDER_NOT_FOUND';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'E_ORDER_CANCELLED';
  end if;
  -- Personel yalnızca bugünün (iş günü) kapanmış adisyonlarını iptal edebilir
  if v_order.status = 'paid'
     and private.role_rank(v_role) < private.role_rank('manager')
     and private.biz_date(v_order.closed_at, v_tz) <> private.biz_date(now(), v_tz) then
    raise exception 'E_FORBIDDEN' using errcode = '42501';
  end if;

  delete from public.payments where order_id = v_order.id;

  if not exists (select 1 from public.order_items i where i.order_id = v_order.id) then
    delete from public.orders where id = v_order.id;
  else
    update public.orders
    set status = 'cancelled',
        closed_at = coalesce(closed_at, now()),
        closed_by = v_uid,
        cancel_reason = private.clean_text(p_reason, 200),
        updated_at = now()
    where id = v_order.id;
  end if;

  return jsonb_build_object('ok', true, 'table_id', v_order.table_id);
end
$$;

-- function · public.report_product_daily(uuid, date, date)

CREATE FUNCTION public.report_product_daily(p_cafe uuid, p_from date, p_to date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_tz text;
begin
  perform private.require_role(p_cafe, 'manager');
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'E_INVALID_RANGE';
  end if;
  select c.timezone into v_tz from public.cafes c where c.id = p_cafe;

  return coalesce((
    select jsonb_agg(jsonb_build_object('d', t.d, 'p', t.product_id, 'q', t.qty) order by t.d)
    from (
      select ((o.closed_at at time zone v_tz) - private.day_cutoff())::date as d, i.product_id, sum(i.quantity) as qty
      from public.orders o
      join public.order_items i on i.order_id = o.id
      where o.cafe_id = p_cafe
        and o.status = 'paid'
        and o.closed_at >= ((p_from::timestamp + private.day_cutoff()) at time zone v_tz)
        and o.closed_at < (((p_to + 1)::timestamp + private.day_cutoff()) at time zone v_tz)
        and i.product_id is not null
      group by 1, 2
    ) t
  ), '[]'::jsonb);
end
$$;

-- function · public.report_products(uuid, date, date)

CREATE FUNCTION public.report_products(p_cafe uuid, p_from date, p_to date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_tz text;
  v_from timestamptz;
  v_to timestamptz;
  v_result jsonb;
begin
  perform private.require_role(p_cafe, 'manager');
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 7300 then
    raise exception 'E_INVALID_RANGE';
  end if;

  select c.timezone into v_tz from public.cafes c where c.id = p_cafe;
  v_from := (p_from::timestamp + private.day_cutoff()) at time zone v_tz;
  v_to := ((p_to + 1)::timestamp + private.day_cutoff()) at time zone v_tz;

  with paid as (
    select o.id, o.discount_amount, ((o.closed_at at time zone v_tz) - private.day_cutoff())::date as d
    from public.orders o
    where o.cafe_id = p_cafe and o.status = 'paid'
      and o.closed_at >= v_from and o.closed_at < v_to
  ),
  items as (
    select i.product_id, i.product_name, i.category_name, i.quantity, i.unit_price, i.unit_cost, i.is_comp, p.d
    from public.order_items i
    join paid p on p.id = i.order_id
  ),
  agg as (
    select
      i.product_id,
      (array_agg(i.product_name order by i.d desc))[1] as snapshot_name,
      (array_agg(i.category_name order by i.d desc))[1] as snapshot_category,
      sum(i.quantity) as qty,
      coalesce(sum(i.quantity * i.unit_price) filter (where not i.is_comp), 0) as revenue,
      sum(i.quantity * i.unit_cost) as cost,
      coalesce(sum(i.quantity) filter (where i.is_comp), 0) as comp_qty,
      count(distinct i.d) as days_sold
    from items i
    group by i.product_id, case when i.product_id is null then i.product_name end
  ),
  totals as (
    select
      (select count(*) from paid) as orders,
      coalesce((select sum(qty) from agg), 0) as items,
      coalesce((select sum(revenue) from agg), 0) as gross,
      coalesce((select sum(cost) from agg), 0) as cost
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to, 'timezone', v_tz),
    'first_sale', (
      select ((min(o.closed_at) at time zone v_tz) - private.day_cutoff())::date
      from public.orders o where o.cafe_id = p_cafe and o.status = 'paid'
    ),
    'days', (select count(distinct d) from paid),
    'totals', jsonb_build_object(
      'orders', (select orders from totals),
      'items', (select items from totals),
      'revenue', round((select gross from totals), 2),
      'cost', round((select cost from totals), 2)
    ),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', a.product_id,
        'name', coalesce(pr.name, a.snapshot_name),
        'category', coalesce(c.name, a.snapshot_category),
        'qty', a.qty,
        'revenue', round(a.revenue, 2),
        'cost', round(a.cost, 2),
        'comp_qty', a.comp_qty,
        'days_sold', a.days_sold,
        'is_active', coalesce(pr.is_active, false),
        'price', pr.price
      ) order by a.qty desc, a.revenue desc)
      from agg a
      left join public.products pr on pr.id = a.product_id
      left join public.categories c on c.id = pr.category_id
    ), '[]'::jsonb),
    'unsold', coalesce((
      select jsonb_agg(jsonb_build_object('product_id', p.id, 'name', p.name, 'category', coalesce(c.name, ''), 'price', p.price)
        order by c.sort_order nulls last, p.sort_order)
      from public.products p
      left join public.categories c on c.id = p.category_id
      where p.cafe_id = p_cafe and p.is_active
        and not exists (select 1 from agg a where a.product_id = p.id)
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end
$$;

-- function · public.report_range(uuid, date, date)

CREATE FUNCTION public.report_range(p_cafe uuid, p_from date, p_to date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_tz text;
  v_from timestamptz;
  v_to timestamptz;
  v_result jsonb;
begin
  perform private.require_role(p_cafe, 'manager');
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'E_INVALID_RANGE';
  end if;

  select c.timezone into v_tz from public.cafes c where c.id = p_cafe;
  v_from := (p_from::timestamp + private.day_cutoff()) at time zone v_tz;
  v_to := ((p_to + 1)::timestamp + private.day_cutoff()) at time zone v_tz;

  with ord as (
    select
      o.id, o.table_id, o.table_name, o.is_takeaway, o.status,
      o.opened_at, o.closed_at, o.discount_amount, o.guests,
      ((o.closed_at at time zone v_tz) - private.day_cutoff())::date as d
    from public.orders o
    where o.cafe_id = p_cafe
      and o.status in ('paid', 'cancelled')
      and o.closed_at >= v_from
      and o.closed_at < v_to
  ),
  paid as (
    select * from ord where status = 'paid'
  ),
  items as (
    select i.*
    from public.order_items i
    join paid p on p.id = i.order_id
  ),
  item_tot as (
    select
      i.order_id,
      coalesce(sum(i.quantity * i.unit_price) filter (where not i.is_comp), 0) as subtotal,
      coalesce(sum(i.quantity * i.unit_price) filter (where i.is_comp), 0) as comp_value,
      coalesce(sum(i.quantity * i.unit_cost), 0) as cost,
      coalesce(sum(i.quantity), 0) as qty
    from items i
    group by i.order_id
  ),
  pay_tot as (
    select
      pay.order_id,
      coalesce(sum(pay.amount) filter (where pay.method = 'card'), 0) as card,
      coalesce(sum(pay.amount) filter (where pay.method = 'cash'), 0) as cash,
      coalesce(sum(pay.amount) filter (where pay.method = 'ticket'), 0) as ticket,
      coalesce(sum(pay.commission_amount), 0) as commission
    from public.payments pay
    join paid p on p.id = pay.order_id
    group by pay.order_id
  ),
  order_full as (
    select
      p.id, p.d, p.table_id, p.table_name, p.is_takeaway, p.opened_at, p.closed_at,
      coalesce(it.subtotal, 0) as subtotal,
      coalesce(it.comp_value, 0) as comp_value,
      coalesce(it.cost, 0) as cost,
      coalesce(it.qty, 0) as qty,
      least(p.discount_amount, coalesce(it.subtotal, 0)) as discount,
      coalesce(it.subtotal, 0) - least(p.discount_amount, coalesce(it.subtotal, 0)) as revenue,
      coalesce(pt.card, 0) as card,
      coalesce(pt.cash, 0) as cash,
      coalesce(pt.ticket, 0) as ticket,
      coalesce(pt.commission, 0) as commission,
      extract(epoch from (p.closed_at - p.opened_at)) / 60.0 as minutes,
      p.guests
    from paid p
    left join item_tot it on it.order_id = p.id
    left join pay_tot pt on pt.order_id = p.id
  ),
  daily_paid as (
    select
      d,
      count(*) as orders,
      sum(revenue) as revenue,
      sum(cost) as cost,
      sum(commission) as commission,
      sum(card) as card,
      sum(cash) as cash,
      sum(ticket) as ticket,
      sum(discount) as discount,
      sum(comp_value) as comp_value,
      sum(qty) as items,
      count(*) filter (where not is_takeaway) as table_sessions,
      coalesce(sum(minutes) filter (where not is_takeaway), 0) as occupancy_minutes,
      count(*) filter (where is_takeaway) as takeaway_orders,
      coalesce(sum(guests), 0) as guests,
      count(*) filter (where guests is not null) as guest_orders,
      coalesce(sum(revenue) filter (where guests is not null), 0) as guest_revenue
    from order_full
    group by d
  ),
  daily_cancelled as (
    select d, count(*) as cancelled
    from ord
    where status = 'cancelled'
    group by d
  ),
  daily as (
    select
      coalesce(dp.d, dc.d) as d,
      coalesce(dp.orders, 0) as orders,
      coalesce(dp.revenue, 0) as revenue,
      coalesce(dp.cost, 0) as cost,
      coalesce(dp.commission, 0) as commission,
      coalesce(dp.card, 0) as card,
      coalesce(dp.cash, 0) as cash,
      coalesce(dp.ticket, 0) as ticket,
      coalesce(dp.discount, 0) as discount,
      coalesce(dp.comp_value, 0) as comp_value,
      coalesce(dp.items, 0) as items,
      coalesce(dp.table_sessions, 0) as table_sessions,
      coalesce(dp.occupancy_minutes, 0) as occupancy_minutes,
      coalesce(dp.takeaway_orders, 0) as takeaway_orders,
      coalesce(dp.guests, 0) as guests,
      coalesce(dp.guest_orders, 0) as guest_orders,
      coalesce(dp.guest_revenue, 0) as guest_revenue,
      coalesce(dc.cancelled, 0) as cancelled
    from daily_paid dp
    full join daily_cancelled dc on dc.d = dp.d
  ),
  item_rounds as (
    select
      i.created_at,
      i.quantity,
      case when i.is_comp then 0 else i.quantity * i.unit_price end as line_revenue,
      case
        when lag(i.created_at) over w is null
          or i.created_at - lag(i.created_at) over w > private.round_gap() then 1
        else 0
      end as new_round
    from items i
    window w as (partition by i.order_id order by i.created_at, i.id)
  ),
  hourly as (
    select
      ((created_at at time zone v_tz) - private.day_cutoff())::date as d,
      extract(hour from (created_at at time zone v_tz))::integer as h,
      sum(new_round) as rounds,
      sum(quantity) as items,
      sum(line_revenue) as revenue
    from item_rounds
    group by 1, 2
  ),
  product_agg as (
    select
      i.product_id,
      (array_agg(i.product_name order by i.created_at desc))[1] as snapshot_name,
      (array_agg(i.category_name order by i.created_at desc))[1] as snapshot_category,
      sum(i.quantity) as qty,
      coalesce(sum(i.quantity * (i.unit_price - i.unit_discount)) filter (where not i.is_comp), 0) as revenue,
      sum(i.quantity * i.unit_cost) as cost,
      coalesce(sum(i.quantity) filter (where i.is_comp), 0) as comp_qty
    from items i
    group by i.product_id, case when i.product_id is null then i.product_name end
  ),
  table_agg as (
    select
      table_id,
      (array_agg(table_name order by closed_at desc))[1] as name,
      count(*) as sessions,
      sum(minutes) as minutes,
      max(minutes) as max_minutes,
      sum(revenue) as revenue
    from order_full
    where not is_takeaway
    group by table_id, case when table_id is null then table_name end
  ),
  option_agg as (
    select o.id, o.name, g.name as group_name, sum(i.quantity) as qty
    from items i
    cross join lateral unnest(i.option_ids) as x(option_id)
    join public.options o on o.id = x.option_id
    join public.option_groups g on g.id = o.group_id
    group by o.id, o.name, g.name
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to, 'timezone', v_tz),
    'generated_at', now(),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', d,
        'orders', orders,
        'revenue', round(revenue, 2),
        'cost', round(cost, 2),
        'commission', round(commission, 2),
        'card', round(card, 2),
        'cash', round(cash, 2),
        'ticket', round(ticket, 2),
        'discount', round(discount, 2),
        'comp_value', round(comp_value, 2),
        'items', items,
        'table_sessions', table_sessions,
        'occupancy_minutes', round(occupancy_minutes::numeric, 1),
        'takeaway_orders', takeaway_orders,
        'guests', guests,
        'guest_orders', guest_orders,
        'guest_revenue', round(guest_revenue, 2),
        'cancelled', cancelled
      ) order by d)
      from daily
    ), '[]'::jsonb),
    'hourly', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', d,
        'hour', h,
        'rounds', rounds,
        'items', items,
        'revenue', round(revenue, 2)
      ) order by d, h)
      from hourly
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', pa.product_id,
        'name', coalesce(pr.name, pa.snapshot_name),
        'category', coalesce(c.name, pa.snapshot_category),
        'qty', pa.qty,
        'revenue', round(pa.revenue, 2),
        'cost', round(pa.cost, 2),
        'comp_qty', pa.comp_qty
      ) order by pa.qty desc, pa.revenue desc)
      from product_agg pa
      left join public.products pr on pr.id = pa.product_id
      left join public.categories c on c.id = pr.category_id
    ), '[]'::jsonb),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'table_id', table_id,
        'name', name,
        'sessions', sessions,
        'minutes', round(minutes::numeric, 1),
        'max_minutes', round(max_minutes::numeric, 1),
        'revenue', round(revenue, 2)
      ) order by minutes desc)
      from table_agg
    ), '[]'::jsonb),
    'longest', coalesce((
      select jsonb_agg(jsonb_build_object(
        'table_name', l.table_name,
        'opened_at', l.opened_at,
        'closed_at', l.closed_at,
        'minutes', round(l.minutes::numeric, 1),
        'revenue', round(l.revenue, 2)
      ) order by l.minutes desc)
      from (
        select * from order_full where not is_takeaway order by minutes desc limit 5
      ) l
    ), '[]'::jsonb),
    'options', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'group_name', group_name,
        'qty', qty
      ) order by qty desc)
      from option_agg
    ), '[]'::jsonb),
    'menu', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', p.id,
        'name', p.name,
        'category', coalesce(c.name, ''),
        'price', p.price,
        'unit_cost', round(coalesce(private.product_unit_cost(p.id), 0), 4),
        'is_active', p.is_active
      ) order by c.sort_order nulls last, p.sort_order, p.name)
      from public.products p
      left join public.categories c on c.id = p.category_id
      where p.cafe_id = p_cafe
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end
$$;

-- function · public.report_series(uuid, date, date)

CREATE FUNCTION public.report_series(p_cafe uuid, p_from date, p_to date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_tz text;
  v_from timestamptz;
  v_to timestamptz;
  v_result jsonb;
begin
  perform private.require_role(p_cafe, 'manager');
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'E_INVALID_RANGE';
  end if;

  select c.timezone into v_tz from public.cafes c where c.id = p_cafe;
  v_from := (p_from::timestamp + private.day_cutoff()) at time zone v_tz;
  v_to := ((p_to + 1)::timestamp + private.day_cutoff()) at time zone v_tz;

  with paid as (
    select o.id, o.is_takeaway, o.opened_at, o.closed_at, o.discount_amount, o.guests,
           ((o.closed_at at time zone v_tz) - private.day_cutoff())::date as d
    from public.orders o
    where o.cafe_id = p_cafe and o.status = 'paid'
      and o.closed_at >= v_from and o.closed_at < v_to
  ),
  items as (
    select i.order_id, i.created_at, i.quantity, i.unit_price, i.unit_cost, i.is_comp
    from public.order_items i
    join paid p on p.id = i.order_id
  ),
  item_tot as (
    select i.order_id,
      coalesce(sum(i.quantity * i.unit_price) filter (where not i.is_comp), 0) as subtotal,
      coalesce(sum(i.quantity * i.unit_price) filter (where i.is_comp), 0) as comp_value,
      coalesce(sum(i.quantity * i.unit_cost), 0) as cost,
      coalesce(sum(i.quantity), 0) as qty
    from items i
    group by i.order_id
  ),
  pay_tot as (
    select pay.order_id,
      coalesce(sum(pay.amount) filter (where pay.method = 'card'), 0) as card,
      coalesce(sum(pay.amount) filter (where pay.method = 'cash'), 0) as cash,
      coalesce(sum(pay.amount) filter (where pay.method = 'ticket'), 0) as ticket,
      coalesce(sum(pay.commission_amount), 0) as commission
    from public.payments pay
    join paid p on p.id = pay.order_id
    group by pay.order_id
  ),
  daily as (
    select
      p.d,
      count(*) as orders,
      sum(coalesce(it.subtotal, 0) - least(p.discount_amount, coalesce(it.subtotal, 0))) as revenue,
      sum(coalesce(it.cost, 0)) as cost,
      sum(coalesce(pt.commission, 0)) as commission,
      sum(coalesce(pt.card, 0)) as card,
      sum(coalesce(pt.cash, 0)) as cash,
      sum(coalesce(pt.ticket, 0)) as ticket,
      sum(least(p.discount_amount, coalesce(it.subtotal, 0))) as discount,
      sum(coalesce(it.comp_value, 0)) as comp_value,
      sum(coalesce(it.qty, 0)) as items,
      count(*) filter (where not p.is_takeaway) as table_sessions,
      coalesce(sum(extract(epoch from (p.closed_at - p.opened_at)) / 60.0) filter (where not p.is_takeaway), 0) as occupancy_minutes,
      count(*) filter (where p.is_takeaway) as takeaway_orders,
      coalesce(sum(p.guests), 0) as guests,
      count(*) filter (where p.guests is not null) as guest_orders,
      coalesce(sum(coalesce(it.subtotal, 0) - least(p.discount_amount, coalesce(it.subtotal, 0))) filter (where p.guests is not null), 0) as guest_revenue
    from paid p
    left join item_tot it on it.order_id = p.id
    left join pay_tot pt on pt.order_id = p.id
    group by p.d
  ),
  rounds as (
    select
      i.created_at,
      i.quantity,
      case when i.is_comp then 0 else i.quantity * i.unit_price end as line_revenue,
      case
        when lag(i.created_at) over w is null
          or i.created_at - lag(i.created_at) over w > private.round_gap() then 1
        else 0
      end as new_round
    from items i
    window w as (partition by i.order_id order by i.created_at)
  ),
  hourly as (
    select
      ((created_at at time zone v_tz) - private.day_cutoff())::date as d,
      extract(hour from (created_at at time zone v_tz))::integer as h,
      sum(new_round) as rounds,
      sum(quantity) as items,
      sum(line_revenue) as revenue
    from rounds
    group by 1, 2
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to, 'timezone', v_tz),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', d, 'orders', orders, 'revenue', round(revenue, 2), 'cost', round(cost, 2),
        'commission', round(commission, 2), 'card', round(card, 2), 'cash', round(cash, 2), 'ticket', round(ticket, 2),
        'discount', round(discount, 2), 'comp_value', round(comp_value, 2), 'items', items,
        'table_sessions', table_sessions, 'occupancy_minutes', round(occupancy_minutes::numeric, 1),
        'takeaway_orders', takeaway_orders, 'guests', guests, 'guest_orders', guest_orders,
        'guest_revenue', round(guest_revenue, 2), 'cancelled', 0
      ) order by d)
      from daily
    ), '[]'::jsonb),
    'hourly', coalesce((
      select jsonb_agg(jsonb_build_object('date', d, 'hour', h, 'rounds', rounds, 'items', items, 'revenue', round(revenue, 2)) order by d, h)
      from hourly
      where d between p_from and p_to
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end
$$;

-- function · public.report_z(uuid, date)

CREATE FUNCTION public.report_z(p_cafe uuid, p_date date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_cafe public.cafes;
  v_from timestamptz;
  v_to timestamptz;
  v_month_days integer;
  v_sales jsonb;
  v_pay jsonb;
  v_cost numeric;
  v_expenses jsonb;
  v_expense_total numeric;
  v_revenue numeric;
  v_vat numeric;
  v_commission numeric;
begin
  perform private.require_role(p_cafe, 'owner');
  select * into v_cafe from public.cafes c where c.id = p_cafe;

  if p_date is null or p_date > private.biz_date(now(), v_cafe.timezone) or p_date < date '2000-01-01' then
    raise exception 'E_INVALID_DATE';
  end if;

  v_from := (p_date::timestamp + private.day_cutoff()) at time zone v_cafe.timezone;
  v_to := ((p_date + 1)::timestamp + private.day_cutoff()) at time zone v_cafe.timezone;
  v_month_days := extract(day from (date_trunc('month', p_date) + interval '1 month' - interval '1 day'))::integer;

  select jsonb_build_object(
    'orders', count(*) filter (where z.status = 'paid'),
    'cancelled', count(*) filter (where z.status = 'cancelled'),
    'gross', coalesce(sum(z.subtotal) filter (where z.status = 'paid'), 0),
    'comp', coalesce(sum(z.comp_total) filter (where z.status = 'paid'), 0),
    'discount', coalesce(sum(z.discount) filter (where z.status = 'paid'), 0),
    'revenue', coalesce(sum(z.total) filter (where z.status = 'paid'), 0),
    'guests', coalesce((
      select sum(o.guests) from public.orders o
      join private.z_orders(p_cafe, v_from, v_to) z3 on z3.id = o.id and z3.status = 'paid'
    ), 0),
    'items', coalesce((
      select sum(i.quantity) from public.order_items i
      join private.z_orders(p_cafe, v_from, v_to) z2 on z2.id = i.order_id and z2.status = 'paid'
    ), 0)
  )
  into v_sales
  from private.z_orders(p_cafe, v_from, v_to) z;

  select jsonb_build_object(
    'cash', coalesce(sum(p.amount) filter (where p.method = 'cash'), 0),
    'card', coalesce(sum(p.amount) filter (where p.method = 'card'), 0),
    'cash_count', count(*) filter (where p.method = 'cash'),
    'card_count', count(*) filter (where p.method = 'card'),
    'ticket', coalesce(sum(p.amount) filter (where p.method = 'ticket'), 0),
    'ticket_count', count(*) filter (where p.method = 'ticket'),
    'total', coalesce(sum(p.amount), 0),
    'vat', coalesce(sum(p.vat_amount), 0),
    'vat_cash', coalesce(sum(p.vat_amount) filter (where p.method = 'cash'), 0),
    'vat_card', coalesce(sum(p.vat_amount) filter (where p.method = 'card'), 0),
    'vat_ticket', coalesce(sum(p.vat_amount) filter (where p.method = 'ticket'), 0),
    'commission', coalesce(sum(p.commission_amount), 0)
  )
  into v_pay
  from public.payments p
  join private.z_orders(p_cafe, v_from, v_to) z on z.id = p.order_id and z.status = 'paid';

  select coalesce(round(sum(i.quantity * i.unit_cost), 2), 0) into v_cost
  from public.order_items i
  join private.z_orders(p_cafe, v_from, v_to) z on z.id = i.order_id and z.status = 'paid';

  -- Giderler: aylık sabit giderin günlük payı + bugüne yazılmış tek seferlikler
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', e.name,
    'category', e.category,
    'kind', e.kind,
    'monthly_amount', case when e.kind = 'monthly' then e.amount else null end,
    'amount', case when e.kind = 'monthly' then round(e.amount / v_month_days, 2) else e.amount end
  ) order by e.kind, e.category, e.name), '[]'::jsonb)
  into v_expenses
  from public.expenses e
  where e.cafe_id = p_cafe
    and (
      (e.kind = 'monthly' and e.starts_on <= p_date and (e.ends_on is null or e.ends_on >= p_date))
      or (e.kind = 'one_time' and e.starts_on = p_date)
    );

  select coalesce(sum((x ->> 'amount')::numeric), 0) into v_expense_total
  from jsonb_array_elements(v_expenses) as x;

  v_revenue := (v_sales ->> 'revenue')::numeric;
  v_vat := (v_pay ->> 'vat')::numeric;
  v_commission := (v_pay ->> 'commission')::numeric;

  return jsonb_build_object(
    'cafe', jsonb_build_object('name', v_cafe.name, 'timezone', v_cafe.timezone),
    'date', p_date,
    'from', v_from,
    'to', v_to,
    'generated_at', now(),
    'vat_rate', v_cafe.vat_rate,
    'commission_rate', v_cafe.card_commission_rate,
    'ticket_commission_rate', v_cafe.ticket_commission_rate,
    'sales', v_sales,
    'payments', v_pay,
    'cost', v_cost,
    'expenses', v_expenses,
    'summary', jsonb_build_object(
      'revenue', v_revenue,
      'vat', v_vat,
      'revenue_ex_vat', v_revenue - v_vat,
      'cost', v_cost,
      'commission', v_commission,
      'gross_profit', round(v_revenue - v_vat - v_cost - v_commission, 2),
      'expenses', v_expense_total,
      'net_profit', round(v_revenue - v_vat - v_cost - v_commission - v_expense_total, 2)
    ),
    'products', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.qty desc, x.revenue desc, x.name)
      from (
        select
          i.product_name as name,
          i.category_name as category,
          sum(i.quantity)::integer as qty,
          sum(i.quantity) filter (where i.is_comp)::integer as comp_qty,
          round(sum(i.quantity * (i.unit_price - i.unit_discount)) filter (where not i.is_comp), 2) as revenue,
          round(sum(i.quantity * i.unit_cost), 2) as cost
        from public.order_items i
        join private.z_orders(p_cafe, v_from, v_to) z on z.id = i.order_id and z.status = 'paid'
        group by i.product_name, i.category_name
      ) x
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.revenue desc nulls last)
      from (
        select
          nullif(i.category_name, '') as name,
          sum(i.quantity)::integer as qty,
          round(coalesce(sum(i.quantity * (i.unit_price - i.unit_discount)) filter (where not i.is_comp), 0), 2) as revenue
        from public.order_items i
        join private.z_orders(p_cafe, v_from, v_to) z on z.id = i.order_id and z.status = 'paid'
        group by i.category_name
      ) x
    ), '[]'::jsonb),
    'payment_list', coalesce((
      select jsonb_agg(jsonb_build_object(
        'at', p.created_at,
        'table', z.table_name,
        'method', p.method,
        'amount', p.amount,
        'vat', p.vat_amount,
        'commission', p.commission_amount
      ) order by p.created_at)
      from public.payments p
      join private.z_orders(p_cafe, v_from, v_to) z on z.id = p.order_id and z.status = 'paid'
    ), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(private.day_json(d, true) order by d.opened_at)
      from public.cafe_days d
      where d.cafe_id = p_cafe and d.business_date = p_date
    ), '[]'::jsonb)
  );
end
$$;

-- function · public.tables_admin_data(uuid)

CREATE FUNCTION public.tables_admin_data(p_cafe uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_role(p_cafe, 'manager');
  return jsonb_build_object(
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'sort_order', a.sort_order)
        order by a.sort_order, a.name)
      from public.areas a
      where a.cafe_id = p_cafe
    ), '[]'::jsonb),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'area_id', t.area_id,
        'is_takeaway', t.is_takeaway,
        'is_active', t.is_active,
        'sort_order', t.sort_order,
        'has_open_order', exists (
          select 1 from public.orders o where o.table_id = t.id and o.status = 'open'
        )
      ) order by t.sort_order, t.name)
      from public.dining_tables t
      where t.cafe_id = p_cafe
    ), '[]'::jsonb)
  );
end
$$;

-- function · public.tables_bulk_create(uuid, uuid, text, integer, integer)

CREATE FUNCTION public.tables_bulk_create(p_cafe uuid, p_area uuid, p_prefix text, p_from integer, p_to integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_prefix text := private.clean_text(p_prefix, 12);
  v_start integer;
  v_count integer;
begin
  perform private.require_role(p_cafe, 'manager');
  if p_from is null or p_to is null or p_from < 0 or p_to < p_from or p_to - p_from >= 100 or p_to > 9999 then
    raise exception 'E_INVALID_RANGE';
  end if;
  if p_area is not null and not exists (
    select 1 from public.areas a where a.id = p_area and a.cafe_id = p_cafe
  ) then
    raise exception 'E_NOT_FOUND';
  end if;

  select coalesce(max(t.sort_order) + 1, 0) into v_start
  from public.dining_tables t where t.cafe_id = p_cafe;

  insert into public.dining_tables (cafe_id, area_id, name, sort_order)
  select p_cafe, p_area, v_prefix || n::text, v_start + (n - p_from)
  from generate_series(p_from, p_to) as n
  on conflict (cafe_id, name) do nothing;
  get diagnostics v_count = row_count;
  return jsonb_build_object('created', v_count);
end
$$;

-- function · public.tables_delete_area(uuid, uuid)

CREATE FUNCTION public.tables_delete_area(p_cafe uuid, p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_role(p_cafe, 'manager');
  delete from public.areas where id = p_id and cafe_id = p_cafe;
  if not found then
    raise exception 'E_NOT_FOUND';
  end if;
end
$$;

-- function · public.tables_delete_table(uuid, uuid)

CREATE FUNCTION public.tables_delete_table(p_cafe uuid, p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_role(p_cafe, 'manager');
  if exists (select 1 from public.orders o where o.table_id = p_id and o.status = 'open') then
    raise exception 'E_TABLE_HAS_OPEN_ORDER';
  end if;
  -- Geçmiş adisyonlar masa adının kopyasıyla raporlarda kalır
  delete from public.dining_tables where id = p_id and cafe_id = p_cafe;
  if not found then
    raise exception 'E_NOT_FOUND';
  end if;
end
$$;

-- function · public.tables_save_area(uuid, jsonb)

CREATE FUNCTION public.tables_save_area(p_cafe uuid, p_area jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_id uuid := nullif(p_area ->> 'id', '')::uuid;
  v_name text := private.clean_text(p_area ->> 'name', 40);
begin
  perform private.require_role(p_cafe, 'manager');
  if v_name = '' then
    raise exception 'E_NAME_REQUIRED';
  end if;

  if v_id is null then
    insert into public.areas (cafe_id, name, sort_order)
    values (p_cafe, v_name,
      coalesce((select max(a.sort_order) + 1 from public.areas a where a.cafe_id = p_cafe), 0))
    returning id into v_id;
  else
    update public.areas set name = v_name where id = v_id and cafe_id = p_cafe;
    if not found then
      raise exception 'E_NOT_FOUND';
    end if;
  end if;
  return jsonb_build_object('id', v_id);
end
$$;

-- function · public.tables_save_table(uuid, jsonb)

CREATE FUNCTION public.tables_save_table(p_cafe uuid, p_table jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_id uuid := nullif(p_table ->> 'id', '')::uuid;
  v_name text := private.clean_text(p_table ->> 'name', 24);
  v_area uuid := nullif(p_table ->> 'area_id', '')::uuid;
  v_takeaway boolean := coalesce((p_table ->> 'is_takeaway')::boolean, false);
  v_active boolean := coalesce((p_table ->> 'is_active')::boolean, true);
begin
  perform private.require_role(p_cafe, 'manager');
  if v_name = '' then
    raise exception 'E_NAME_REQUIRED';
  end if;

  if v_id is null then
    insert into public.dining_tables (cafe_id, area_id, name, is_takeaway, is_active, sort_order)
    values (p_cafe, v_area, v_name, v_takeaway, v_active,
      coalesce((select max(t.sort_order) + 1 from public.dining_tables t where t.cafe_id = p_cafe), 0))
    returning id into v_id;
  else
    if not v_active and exists (
      select 1 from public.orders o where o.table_id = v_id and o.status = 'open'
    ) then
      raise exception 'E_TABLE_HAS_OPEN_ORDER';
    end if;
    update public.dining_tables
    set area_id = v_area, name = v_name, is_takeaway = v_takeaway, is_active = v_active
    where id = v_id and cafe_id = p_cafe;
    if not found then
      raise exception 'E_NOT_FOUND';
    end if;
    -- Açık adisyondaki masa adı kopyasını da güncelle
    update public.orders
    set table_name = v_name, is_takeaway = v_takeaway, updated_at = now()
    where table_id = v_id and status = 'open';
  end if;
  return jsonb_build_object('id', v_id);
end
$$;

-- function · public.team_add_member(uuid, text, public.member_role, text)

CREATE FUNCTION public.team_add_member(p_cafe uuid, p_email text, p_role public.member_role, p_display_name text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_user uuid;
begin
  perform private.require_role(p_cafe, 'owner');
  select u.id into v_user from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'E_USER_NOT_FOUND';
  end if;

  insert into public.cafe_members (cafe_id, user_id, role, display_name)
  values (p_cafe, v_user, coalesce(p_role, 'staff'), private.clean_text(p_display_name, 60))
  on conflict (cafe_id, user_id) do update
    set role = excluded.role, display_name = excluded.display_name;

  return jsonb_build_object('user_id', v_user);
end
$$;

-- function · public.team_list(uuid)

CREATE FUNCTION public.team_list(p_cafe uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_role(p_cafe, 'owner');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', m.user_id,
      'email', u.email,
      'display_name', m.display_name,
      'role', m.role,
      'created_at', m.created_at,
      'is_self', m.user_id = (select auth.uid())
    ) order by private.role_rank(m.role) desc, m.display_name, u.email)
    from public.cafe_members m
    join auth.users u on u.id = m.user_id
    where m.cafe_id = p_cafe
  ), '[]'::jsonb);
end
$$;

-- function · public.team_remove_member(uuid, uuid)

CREATE FUNCTION public.team_remove_member(p_cafe uuid, p_user uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_current public.member_role;
begin
  perform private.require_role(p_cafe, 'owner');
  select m.role into v_current from public.cafe_members m where m.cafe_id = p_cafe and m.user_id = p_user;
  if v_current is null then
    raise exception 'E_NOT_FOUND';
  end if;
  if v_current = 'owner' then
    perform private.assert_owner_remains(p_cafe, p_user);
  end if;
  delete from public.cafe_members where cafe_id = p_cafe and user_id = p_user;
end
$$;

-- function · public.team_update_member(uuid, uuid, public.member_role, text)

CREATE FUNCTION public.team_update_member(p_cafe uuid, p_user uuid, p_role public.member_role, p_display_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_current public.member_role;
begin
  perform private.require_role(p_cafe, 'owner');
  select m.role into v_current from public.cafe_members m where m.cafe_id = p_cafe and m.user_id = p_user;
  if v_current is null then
    raise exception 'E_NOT_FOUND';
  end if;
  if v_current = 'owner' and p_role <> 'owner' then
    perform private.assert_owner_remains(p_cafe, p_user);
  end if;
  update public.cafe_members
  set role = p_role, display_name = private.clean_text(p_display_name, 60)
  where cafe_id = p_cafe and user_id = p_user;
end
$$;

-- table · public.areas

CREATE TABLE public.areas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT areas_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 40)))
);

-- table · public.cafe_members

CREATE TABLE public.cafe_members (
    cafe_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.member_role DEFAULT 'staff'::public.member_role NOT NULL,
    display_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cafe_members_display_name_check CHECK ((char_length(display_name) <= 60))
);

-- table · public.cafes

CREATE TABLE public.cafes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    timezone text DEFAULT 'Europe/Istanbul'::text NOT NULL,
    card_commission_rate numeric(6,4) DEFAULT 0.01 NOT NULL,
    open_hour smallint DEFAULT 10 NOT NULL,
    close_hour smallint DEFAULT 24 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    theme text DEFAULT 'coffee'::text NOT NULL,
    vat_rate numeric(5,4) DEFAULT 0.10 NOT NULL,
    ticket_commission_rate numeric(6,4) DEFAULT 0 NOT NULL,
    CONSTRAINT cafes_card_commission_rate_check CHECK (((card_commission_rate >= (0)::numeric) AND (card_commission_rate <= 0.2))),
    CONSTRAINT cafes_close_hour_check CHECK (((close_hour >= 1) AND (close_hour <= 24))),
    CONSTRAINT cafes_hours_check CHECK ((close_hour > open_hour)),
    CONSTRAINT cafes_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 80))),
    CONSTRAINT cafes_open_hour_check CHECK (((open_hour >= 0) AND (open_hour <= 23))),
    CONSTRAINT cafes_slug_check CHECK ((slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'::text)),
    CONSTRAINT cafes_theme_check CHECK ((theme = ANY (ARRAY['coffee'::text, 'forest'::text, 'ocean'::text, 'berry'::text, 'slate'::text, 'sunset'::text]))),
    CONSTRAINT cafes_ticket_commission_rate_check CHECK (((ticket_commission_rate >= (0)::numeric) AND (ticket_commission_rate <= 0.3))),
    CONSTRAINT cafes_vat_rate_check CHECK (((vat_rate >= (0)::numeric) AND (vat_rate <= 0.5)))
);

-- table · public.categories

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    name text NOT NULL,
    subtitle text DEFAULT ''::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT categories_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 40))),
    CONSTRAINT categories_subtitle_check CHECK ((char_length(subtitle) <= 60))
);

-- table · public.dining_tables

CREATE TABLE public.dining_tables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    area_id uuid,
    name text NOT NULL,
    is_takeaway boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dining_tables_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 24)))
);

-- table · public.expenses

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    kind public.expense_kind DEFAULT 'monthly'::public.expense_kind NOT NULL,
    category text DEFAULT 'diger'::text NOT NULL,
    name text NOT NULL,
    amount numeric(12,2) NOT NULL,
    starts_on date NOT NULL,
    ends_on date,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_demo boolean DEFAULT false NOT NULL,
    CONSTRAINT expenses_amount_check CHECK (((amount >= (0)::numeric) AND (amount < (100000000)::numeric))),
    CONSTRAINT expenses_category_check CHECK ((category = ANY (ARRAY['kira'::text, 'fatura'::text, 'personel'::text, 'banka'::text, 'vergi'::text, 'ekipman'::text, 'pazarlama'::text, 'diger'::text]))),
    CONSTRAINT expenses_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 60))),
    CONSTRAINT expenses_note_check CHECK ((char_length(note) <= 200)),
    CONSTRAINT expenses_one_time_check CHECK (((kind = 'monthly'::public.expense_kind) OR (ends_on IS NULL))),
    CONSTRAINT expenses_range_check CHECK (((ends_on IS NULL) OR (ends_on >= starts_on)))
);

-- table · public.ingredients

CREATE TABLE public.ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    name text NOT NULL,
    unit public.stock_unit DEFAULT 'g'::public.stock_unit NOT NULL,
    package_size numeric(12,3) DEFAULT 1000 NOT NULL,
    package_price numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ingredients_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 60))),
    CONSTRAINT ingredients_package_price_check CHECK (((package_price >= (0)::numeric) AND (package_price < (100000000)::numeric))),
    CONSTRAINT ingredients_package_size_check CHECK (((package_size > (0)::numeric) AND (package_size < (10000000)::numeric)))
);

-- table · public.option_groups

CREATE TABLE public.option_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    name text NOT NULL,
    selection public.option_selection DEFAULT 'single'::public.option_selection NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT option_groups_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 40)))
);

-- table · public.options

CREATE TABLE public.options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    group_id uuid NOT NULL,
    name text NOT NULL,
    price_delta numeric(12,2) DEFAULT 0 NOT NULL,
    cost_mode public.cost_mode DEFAULT 'fixed'::public.cost_mode NOT NULL,
    fixed_cost numeric(14,4) DEFAULT 0 NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT options_fixed_cost_check CHECK (((fixed_cost > ('-1000000'::integer)::numeric) AND (fixed_cost < (1000000)::numeric))),
    CONSTRAINT options_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 40))),
    CONSTRAINT options_price_delta_check CHECK (((price_delta > ('-1000000'::integer)::numeric) AND (price_delta < (1000000)::numeric)))
);

-- table · public.order_items

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    product_name text NOT NULL,
    category_name text DEFAULT ''::text NOT NULL,
    option_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    options_label text DEFAULT ''::text NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    unit_cost numeric(14,4) DEFAULT 0 NOT NULL,
    is_comp boolean DEFAULT false NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    list_price numeric(12,2),
    unit_discount numeric(12,2) DEFAULT 0 NOT NULL,
    split_parts smallint DEFAULT 1 NOT NULL,
    CONSTRAINT order_items_list_price_check CHECK ((list_price >= (0)::numeric)),
    CONSTRAINT order_items_note_check CHECK ((char_length(note) <= 120)),
    CONSTRAINT order_items_quantity_check CHECK (((quantity >= 1) AND (quantity <= 999))),
    CONSTRAINT order_items_split_parts_check CHECK (((split_parts >= 1) AND (split_parts <= 20))),
    CONSTRAINT order_items_unit_cost_check CHECK ((unit_cost >= (0)::numeric)),
    CONSTRAINT order_items_unit_discount_check CHECK (((unit_discount >= (0)::numeric) AND (unit_discount <= unit_price))),
    CONSTRAINT order_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);

-- table · public.orders

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    table_id uuid,
    table_name text NOT NULL,
    is_takeaway boolean DEFAULT false NOT NULL,
    status public.order_status DEFAULT 'open'::public.order_status NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    cancel_reason text DEFAULT ''::text NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    opened_by uuid,
    closed_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_demo boolean DEFAULT false NOT NULL,
    extra_discount numeric(12,2) DEFAULT 0 NOT NULL,
    guests smallint,
    CONSTRAINT orders_cancel_reason_check CHECK ((char_length(cancel_reason) <= 200)),
    CONSTRAINT orders_closed_check CHECK (((status = 'open'::public.order_status) = (closed_at IS NULL))),
    CONSTRAINT orders_discount_amount_check CHECK ((discount_amount >= (0)::numeric)),
    CONSTRAINT orders_extra_discount_check CHECK ((extra_discount >= (0)::numeric)),
    CONSTRAINT orders_guests_check CHECK (((guests >= 1) AND (guests <= 99))),
    CONSTRAINT orders_note_check CHECK ((char_length(note) <= 200))
);

-- table · public.payment_items

CREATE TABLE public.payment_items (
    payment_id uuid NOT NULL,
    item_id uuid NOT NULL,
    cafe_id uuid NOT NULL,
    quantity integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    CONSTRAINT payment_items_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT payment_items_quantity_check CHECK (((quantity >= 1) AND (quantity <= 999)))
);

-- table · public.payments

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    order_id uuid NOT NULL,
    method public.payment_method NOT NULL,
    amount numeric(12,2) NOT NULL,
    commission_rate numeric(6,4) DEFAULT 0 NOT NULL,
    commission_amount numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    vat_rate numeric(5,4) DEFAULT 0 NOT NULL,
    vat_amount numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT payments_amount_check CHECK ((amount > (0)::numeric))
);

-- table · public.product_option_groups

CREATE TABLE public.product_option_groups (
    cafe_id uuid NOT NULL,
    product_id uuid NOT NULL,
    group_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);

-- table · public.products

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    category_id uuid,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    price numeric(12,2) NOT NULL,
    cost_mode public.cost_mode DEFAULT 'recipe'::public.cost_mode NOT NULL,
    fixed_cost numeric(14,4) DEFAULT 0 NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_open_price boolean DEFAULT false NOT NULL,
    favorite_rank integer,
    CONSTRAINT products_description_check CHECK ((char_length(description) <= 200)),
    CONSTRAINT products_favorite_rank_check CHECK ((favorite_rank >= 0)),
    CONSTRAINT products_fixed_cost_check CHECK (((fixed_cost >= (0)::numeric) AND (fixed_cost < (1000000)::numeric))),
    CONSTRAINT products_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 60))),
    CONSTRAINT products_price_check CHECK (((price >= (0)::numeric) AND (price < (1000000)::numeric))),
    CONSTRAINT products_tags_check CHECK ((tags <@ ARRAY['vegan'::text, 'milk'::text, 'gluten'::text, 'nuts'::text, 'egg'::text]))
);

-- table · public.recipe_items

CREATE TABLE public.recipe_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    product_id uuid,
    option_id uuid,
    ingredient_id uuid NOT NULL,
    quantity numeric(12,3) NOT NULL,
    CONSTRAINT recipe_items_owner_check CHECK ((num_nonnulls(product_id, option_id) = 1)),
    CONSTRAINT recipe_items_product_qty_check CHECK (((product_id IS NULL) OR (quantity > (0)::numeric))),
    CONSTRAINT recipe_items_quantity_check CHECK (((quantity <> (0)::numeric) AND (abs(quantity) < (1000000)::numeric)))
);

-- constraint · public.areas areas_cafe_id_id_key

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_cafe_id_id_key UNIQUE (cafe_id, id);

-- constraint · public.areas areas_cafe_id_name_key

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_cafe_id_name_key UNIQUE (cafe_id, name);

-- constraint · public.areas areas_pkey

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (id);

-- constraint · public.cafe_days cafe_days_pkey

ALTER TABLE ONLY public.cafe_days
    ADD CONSTRAINT cafe_days_pkey PRIMARY KEY (id);

-- constraint · public.cafe_members cafe_members_pkey

ALTER TABLE ONLY public.cafe_members
    ADD CONSTRAINT cafe_members_pkey PRIMARY KEY (cafe_id, user_id);

-- constraint · public.cafes cafes_pkey

ALTER TABLE ONLY public.cafes
    ADD CONSTRAINT cafes_pkey PRIMARY KEY (id);

-- constraint · public.cafes cafes_slug_key

ALTER TABLE ONLY public.cafes
    ADD CONSTRAINT cafes_slug_key UNIQUE (slug);

-- constraint · public.categories categories_cafe_id_id_key

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_cafe_id_id_key UNIQUE (cafe_id, id);

-- constraint · public.categories categories_pkey

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);

-- constraint · public.dining_tables dining_tables_cafe_id_id_key

ALTER TABLE ONLY public.dining_tables
    ADD CONSTRAINT dining_tables_cafe_id_id_key UNIQUE (cafe_id, id);

-- constraint · public.dining_tables dining_tables_cafe_id_name_key

ALTER TABLE ONLY public.dining_tables
    ADD CONSTRAINT dining_tables_cafe_id_name_key UNIQUE (cafe_id, name);

-- constraint · public.dining_tables dining_tables_pkey

ALTER TABLE ONLY public.dining_tables
    ADD CONSTRAINT dining_tables_pkey PRIMARY KEY (id);

-- constraint · public.expenses expenses_pkey

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);

-- constraint · public.ingredients ingredients_cafe_id_id_key

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_cafe_id_id_key UNIQUE (cafe_id, id);

-- constraint · public.ingredients ingredients_cafe_id_name_key

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_cafe_id_name_key UNIQUE (cafe_id, name);

-- constraint · public.ingredients ingredients_pkey

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_pkey PRIMARY KEY (id);

-- constraint · public.option_groups option_groups_cafe_id_id_key

ALTER TABLE ONLY public.option_groups
    ADD CONSTRAINT option_groups_cafe_id_id_key UNIQUE (cafe_id, id);

-- constraint · public.option_groups option_groups_cafe_id_name_key

ALTER TABLE ONLY public.option_groups
    ADD CONSTRAINT option_groups_cafe_id_name_key UNIQUE (cafe_id, name);

-- constraint · public.option_groups option_groups_pkey

ALTER TABLE ONLY public.option_groups
    ADD CONSTRAINT option_groups_pkey PRIMARY KEY (id);

-- constraint · public.options options_cafe_id_id_key

ALTER TABLE ONLY public.options
    ADD CONSTRAINT options_cafe_id_id_key UNIQUE (cafe_id, id);

-- constraint · public.options options_pkey

ALTER TABLE ONLY public.options
    ADD CONSTRAINT options_pkey PRIMARY KEY (id);

-- constraint · public.order_items order_items_pkey

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);

-- constraint · public.orders orders_cafe_id_id_key

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_cafe_id_id_key UNIQUE (cafe_id, id);

-- constraint · public.orders orders_pkey

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);

-- constraint · public.payment_items payment_items_pkey

ALTER TABLE ONLY public.payment_items
    ADD CONSTRAINT payment_items_pkey PRIMARY KEY (payment_id, item_id);

-- constraint · public.payments payments_pkey

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);

-- constraint · public.product_option_groups product_option_groups_pkey

ALTER TABLE ONLY public.product_option_groups
    ADD CONSTRAINT product_option_groups_pkey PRIMARY KEY (product_id, group_id);

-- constraint · public.products products_cafe_id_id_key

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_cafe_id_id_key UNIQUE (cafe_id, id);

-- constraint · public.products products_pkey

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);

-- constraint · public.recipe_items recipe_items_pkey

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_pkey PRIMARY KEY (id);

-- index · public.cafe_days_cafe_opened_idx

CREATE INDEX cafe_days_cafe_opened_idx ON public.cafe_days USING btree (cafe_id, opened_at DESC);

-- index · public.cafe_days_one_open

CREATE UNIQUE INDEX cafe_days_one_open ON public.cafe_days USING btree (cafe_id) WHERE (closed_at IS NULL);

-- index · public.cafe_members_user_idx

CREATE INDEX cafe_members_user_idx ON public.cafe_members USING btree (user_id);

-- index · public.categories_cafe_idx

CREATE INDEX categories_cafe_idx ON public.categories USING btree (cafe_id, sort_order);

-- index · public.dining_tables_cafe_idx

CREATE INDEX dining_tables_cafe_idx ON public.dining_tables USING btree (cafe_id, sort_order);

-- index · public.expenses_cafe_idx

CREATE INDEX expenses_cafe_idx ON public.expenses USING btree (cafe_id, starts_on);

-- index · public.options_group_idx

CREATE INDEX options_group_idx ON public.options USING btree (group_id, sort_order);

-- index · public.order_items_order_idx

CREATE INDEX order_items_order_idx ON public.order_items USING btree (order_id, created_at);

-- index · public.order_items_product_idx

CREATE INDEX order_items_product_idx ON public.order_items USING btree (product_id);

-- index · public.orders_cafe_closed_idx

CREATE INDEX orders_cafe_closed_idx ON public.orders USING btree (cafe_id, closed_at) WHERE (closed_at IS NOT NULL);

-- index · public.orders_cafe_status_idx

CREATE INDEX orders_cafe_status_idx ON public.orders USING btree (cafe_id, status);

-- index · public.orders_demo_idx

CREATE INDEX orders_demo_idx ON public.orders USING btree (cafe_id) WHERE is_demo;

-- index · public.orders_one_open_per_table

CREATE UNIQUE INDEX orders_one_open_per_table ON public.orders USING btree (table_id) WHERE (status = 'open'::public.order_status);

-- index · public.payment_items_item_idx

CREATE INDEX payment_items_item_idx ON public.payment_items USING btree (item_id);

-- index · public.payments_cafe_created_idx

CREATE INDEX payments_cafe_created_idx ON public.payments USING btree (cafe_id, created_at);

-- index · public.payments_order_idx

CREATE INDEX payments_order_idx ON public.payments USING btree (order_id);

-- index · public.product_option_groups_group_idx

CREATE INDEX product_option_groups_group_idx ON public.product_option_groups USING btree (group_id);

-- index · public.products_cafe_idx

CREATE INDEX products_cafe_idx ON public.products USING btree (cafe_id, category_id, sort_order);

-- index · public.recipe_items_ingredient_idx

CREATE INDEX recipe_items_ingredient_idx ON public.recipe_items USING btree (ingredient_id);

-- index · public.recipe_items_option_uq

CREATE UNIQUE INDEX recipe_items_option_uq ON public.recipe_items USING btree (option_id, ingredient_id) WHERE (option_id IS NOT NULL);

-- index · public.recipe_items_product_uq

CREATE UNIQUE INDEX recipe_items_product_uq ON public.recipe_items USING btree (product_id, ingredient_id) WHERE (product_id IS NOT NULL);

-- trigger · public.cafes cafes_joker

CREATE TRIGGER cafes_joker AFTER INSERT ON public.cafes FOR EACH ROW EXECUTE FUNCTION private.cafes_after_insert();

-- trigger · public.payments payments_vat

CREATE TRIGGER payments_vat BEFORE INSERT OR UPDATE OF amount ON public.payments FOR EACH ROW EXECUTE FUNCTION private.payments_vat();

-- fk constraint · public.areas areas_cafe_id_fkey

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

-- fk constraint · public.cafe_days cafe_days_cafe_id_fkey

ALTER TABLE ONLY public.cafe_days
    ADD CONSTRAINT cafe_days_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

-- fk constraint · public.cafe_days cafe_days_closed_by_fkey

ALTER TABLE ONLY public.cafe_days
    ADD CONSTRAINT cafe_days_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- fk constraint · public.cafe_days cafe_days_opened_by_fkey

ALTER TABLE ONLY public.cafe_days
    ADD CONSTRAINT cafe_days_opened_by_fkey FOREIGN KEY (opened_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- fk constraint · public.cafe_members cafe_members_cafe_id_fkey

ALTER TABLE ONLY public.cafe_members
    ADD CONSTRAINT cafe_members_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

-- fk constraint · public.cafe_members cafe_members_user_id_fkey

ALTER TABLE ONLY public.cafe_members
    ADD CONSTRAINT cafe_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- fk constraint · public.categories categories_cafe_id_fkey

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

-- fk constraint · public.dining_tables dining_tables_cafe_id_area_id_fkey

ALTER TABLE ONLY public.dining_tables
    ADD CONSTRAINT dining_tables_cafe_id_area_id_fkey FOREIGN KEY (cafe_id, area_id) REFERENCES public.areas(cafe_id, id) ON DELETE SET NULL (area_id);

-- fk constraint · public.dining_tables dining_tables_cafe_id_fkey

ALTER TABLE ONLY public.dining_tables
    ADD CONSTRAINT dining_tables_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

-- fk constraint · public.expenses expenses_cafe_id_fkey

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

-- fk constraint · public.ingredients ingredients_cafe_id_fkey

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

-- fk constraint · public.option_groups option_groups_cafe_id_fkey

ALTER TABLE ONLY public.option_groups
    ADD CONSTRAINT option_groups_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

-- fk constraint · public.options options_cafe_id_fkey

ALTER TABLE ONLY public.options
    ADD CONSTRAINT options_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

-- fk constraint · public.options options_cafe_id_group_id_fkey

ALTER TABLE ONLY public.options
    ADD CONSTRAINT options_cafe_id_group_id_fkey FOREIGN KEY (cafe_id, group_id) REFERENCES public.option_groups(cafe_id, id) ON DELETE CASCADE;

-- fk constraint · public.order_items order_items_cafe_id_order_id_fkey

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_cafe_id_order_id_fkey FOREIGN KEY (cafe_id, order_id) REFERENCES public.orders(cafe_id, id) ON DELETE CASCADE;

-- fk constraint · public.order_items order_items_cafe_id_product_id_fkey

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_cafe_id_product_id_fkey FOREIGN KEY (cafe_id, product_id) REFERENCES public.products(cafe_id, id) ON DELETE SET NULL (product_id);

-- fk constraint · public.order_items order_items_created_by_fkey

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- fk constraint · public.orders orders_cafe_id_fkey

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

-- fk constraint · public.orders orders_cafe_id_table_id_fkey

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_cafe_id_table_id_fkey FOREIGN KEY (cafe_id, table_id) REFERENCES public.dining_tables(cafe_id, id) ON DELETE SET NULL (table_id);

-- fk constraint · public.orders orders_closed_by_fkey

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- fk constraint · public.orders orders_opened_by_fkey

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_opened_by_fkey FOREIGN KEY (opened_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- fk constraint · public.payment_items payment_items_cafe_id_fkey

ALTER TABLE ONLY public.payment_items
    ADD CONSTRAINT payment_items_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

-- fk constraint · public.payment_items payment_items_item_id_fkey

ALTER TABLE ONLY public.payment_items
    ADD CONSTRAINT payment_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.order_items(id) ON DELETE CASCADE;

-- fk constraint · public.payment_items payment_items_payment_id_fkey

ALTER TABLE ONLY public.payment_items
    ADD CONSTRAINT payment_items_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;

-- fk constraint · public.payments payments_cafe_id_order_id_fkey

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_cafe_id_order_id_fkey FOREIGN KEY (cafe_id, order_id) REFERENCES public.orders(cafe_id, id) ON DELETE CASCADE;

-- fk constraint · public.payments payments_created_by_fkey

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- fk constraint · public.product_option_groups product_option_groups_cafe_id_group_id_fkey

ALTER TABLE ONLY public.product_option_groups
    ADD CONSTRAINT product_option_groups_cafe_id_group_id_fkey FOREIGN KEY (cafe_id, group_id) REFERENCES public.option_groups(cafe_id, id) ON DELETE CASCADE;

-- fk constraint · public.product_option_groups product_option_groups_cafe_id_product_id_fkey

ALTER TABLE ONLY public.product_option_groups
    ADD CONSTRAINT product_option_groups_cafe_id_product_id_fkey FOREIGN KEY (cafe_id, product_id) REFERENCES public.products(cafe_id, id) ON DELETE CASCADE;

-- fk constraint · public.products products_cafe_id_category_id_fkey

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_cafe_id_category_id_fkey FOREIGN KEY (cafe_id, category_id) REFERENCES public.categories(cafe_id, id) ON DELETE SET NULL (category_id);

-- fk constraint · public.products products_cafe_id_fkey

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

-- fk constraint · public.recipe_items recipe_items_cafe_id_fkey

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

-- fk constraint · public.recipe_items recipe_items_cafe_id_ingredient_id_fkey

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_cafe_id_ingredient_id_fkey FOREIGN KEY (cafe_id, ingredient_id) REFERENCES public.ingredients(cafe_id, id);

-- fk constraint · public.recipe_items recipe_items_cafe_id_option_id_fkey

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_cafe_id_option_id_fkey FOREIGN KEY (cafe_id, option_id) REFERENCES public.options(cafe_id, id) ON DELETE CASCADE;

-- fk constraint · public.recipe_items recipe_items_cafe_id_product_id_fkey

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_cafe_id_product_id_fkey FOREIGN KEY (cafe_id, product_id) REFERENCES public.products(cafe_id, id) ON DELETE CASCADE;

-- row security · public.areas

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

-- row security · public.cafe_days

ALTER TABLE public.cafe_days ENABLE ROW LEVEL SECURITY;

-- row security · public.cafe_members

ALTER TABLE public.cafe_members ENABLE ROW LEVEL SECURITY;

-- row security · public.cafes

ALTER TABLE public.cafes ENABLE ROW LEVEL SECURITY;

-- row security · public.categories

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- row security · public.dining_tables

ALTER TABLE public.dining_tables ENABLE ROW LEVEL SECURITY;

-- row security · public.expenses

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- row security · public.ingredients

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

-- row security · public.option_groups

ALTER TABLE public.option_groups ENABLE ROW LEVEL SECURITY;

-- row security · public.options

ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;

-- row security · public.order_items

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- row security · public.orders

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- policy · public.orders orders_select_member

CREATE POLICY orders_select_member ON public.orders FOR SELECT TO authenticated USING (private.is_member(cafe_id));

-- row security · public.payment_items

ALTER TABLE public.payment_items ENABLE ROW LEVEL SECURITY;

-- row security · public.payments

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- row security · public.product_option_groups

ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;

-- row security · public.products

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- row security · public.recipe_items

ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;

-- acl · SCHEMA private

GRANT USAGE ON SCHEMA private TO authenticated;

-- acl · private.FUNCTION assert_owner_remains(p_cafe uuid, p_user uuid)

REVOKE ALL ON FUNCTION private.assert_owner_remains(p_cafe uuid, p_user uuid) FROM PUBLIC;

-- acl · private.FUNCTION biz_date(p_ts timestamp with time zone, p_tz text)

REVOKE ALL ON FUNCTION private.biz_date(p_ts timestamp with time zone, p_tz text) FROM PUBLIC;

-- acl · private.FUNCTION cafes_after_insert()

REVOKE ALL ON FUNCTION private.cafes_after_insert() FROM PUBLIC;

-- acl · private.FUNCTION clean_text(p_value text, p_max integer)

REVOKE ALL ON FUNCTION private.clean_text(p_value text, p_max integer) FROM PUBLIC;

-- acl · private.FUNCTION day_cutoff()

REVOKE ALL ON FUNCTION private.day_cutoff() FROM PUBLIC;

-- acl · private.FUNCTION day_json(p_day public.cafe_days, p_money boolean)

REVOKE ALL ON FUNCTION private.day_json(p_day public.cafe_days, p_money boolean) FROM PUBLIC;

-- acl · private.FUNCTION day_totals(p_cafe uuid, p_date date)

REVOKE ALL ON FUNCTION private.day_totals(p_cafe uuid, p_date date) FROM PUBLIC;

-- acl · private.FUNCTION ensure_joker(p_cafe uuid)

REVOKE ALL ON FUNCTION private.ensure_joker(p_cafe uuid) FROM PUBLIC;

-- acl · private.FUNCTION is_member(p_cafe uuid)

REVOKE ALL ON FUNCTION private.is_member(p_cafe uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.is_member(p_cafe uuid) TO authenticated;

-- acl · private.FUNCTION item_paid_qty(p_item uuid)

REVOKE ALL ON FUNCTION private.item_paid_qty(p_item uuid) FROM PUBLIC;

-- acl · private.FUNCTION method_rate(p_cafe uuid, p_method public.payment_method)

REVOKE ALL ON FUNCTION private.method_rate(p_cafe uuid, p_method public.payment_method) FROM PUBLIC;

-- acl · private.FUNCTION normalize_uuids(p_ids uuid[])

REVOKE ALL ON FUNCTION private.normalize_uuids(p_ids uuid[]) FROM PUBLIC;

-- acl · private.FUNCTION open_day(p_cafe uuid)

REVOKE ALL ON FUNCTION private.open_day(p_cafe uuid) FROM PUBLIC;

-- acl · private.FUNCTION option_unit_cost(p_option uuid)

REVOKE ALL ON FUNCTION private.option_unit_cost(p_option uuid) FROM PUBLIC;

-- acl · private.FUNCTION order_json(p_order uuid)

REVOKE ALL ON FUNCTION private.order_json(p_order uuid) FROM PUBLIC;

-- acl · private.FUNCTION order_totals(p_order uuid)

REVOKE ALL ON FUNCTION private.order_totals(p_order uuid) FROM PUBLIC;

-- acl · private.FUNCTION payments_vat()

REVOKE ALL ON FUNCTION private.payments_vat() FROM PUBLIC;

-- acl · private.FUNCTION product_unit_cost(p_product uuid)

REVOKE ALL ON FUNCTION private.product_unit_cost(p_product uuid) FROM PUBLIC;

-- acl · private.FUNCTION recipe_json(p_product uuid, p_option uuid)

REVOKE ALL ON FUNCTION private.recipe_json(p_product uuid, p_option uuid) FROM PUBLIC;

-- acl · private.FUNCTION require_open_day(p_cafe uuid)

REVOKE ALL ON FUNCTION private.require_open_day(p_cafe uuid) FROM PUBLIC;

-- acl · private.FUNCTION require_role(p_cafe uuid, p_min public.member_role)

REVOKE ALL ON FUNCTION private.require_role(p_cafe uuid, p_min public.member_role) FROM PUBLIC;

-- acl · private.FUNCTION require_service()

REVOKE ALL ON FUNCTION private.require_service() FROM PUBLIC;

-- acl · private.FUNCTION resolve_line(p_cafe uuid, p_product uuid, p_option_ids uuid[])

REVOKE ALL ON FUNCTION private.resolve_line(p_cafe uuid, p_product uuid, p_option_ids uuid[]) FROM PUBLIC;

-- acl · private.FUNCTION role_rank(p_role public.member_role)

REVOKE ALL ON FUNCTION private.role_rank(p_role public.member_role) FROM PUBLIC;

-- acl · private.FUNCTION round_gap()

REVOKE ALL ON FUNCTION private.round_gap() FROM PUBLIC;

-- acl · private.FUNCTION sync_discount(p_order uuid)

REVOKE ALL ON FUNCTION private.sync_discount(p_order uuid) FROM PUBLIC;

-- acl · private.FUNCTION touch_order(p_order uuid)

REVOKE ALL ON FUNCTION private.touch_order(p_order uuid) FROM PUBLIC;

-- acl · private.FUNCTION window_summary(p_cafe uuid, p_from timestamp with time zone, p_to timestamp with time zone)

REVOKE ALL ON FUNCTION private.window_summary(p_cafe uuid, p_from timestamp with time zone, p_to timestamp with time zone) FROM PUBLIC;

-- acl · private.FUNCTION z_orders(p_cafe uuid, p_from timestamp with time zone, p_to timestamp with time zone)

REVOKE ALL ON FUNCTION private.z_orders(p_cafe uuid, p_from timestamp with time zone, p_to timestamp with time zone) FROM PUBLIC;

-- acl · public.FUNCTION admin_add_member(p_cafe uuid, p_user uuid, p_role public.member_role, p_display_name text)

REVOKE ALL ON FUNCTION public.admin_add_member(p_cafe uuid, p_user uuid, p_role public.member_role, p_display_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_add_member(p_cafe uuid, p_user uuid, p_role public.member_role, p_display_name text) TO service_role;

-- acl · public.FUNCTION admin_apply_prices(p_cafe uuid, p_payload jsonb)

REVOKE ALL ON FUNCTION public.admin_apply_prices(p_cafe uuid, p_payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_apply_prices(p_cafe uuid, p_payload jsonb) TO service_role;

-- acl · public.FUNCTION admin_cafe_by_slug(p_slug text)

REVOKE ALL ON FUNCTION public.admin_cafe_by_slug(p_slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_cafe_by_slug(p_slug text) TO service_role;

-- acl · public.FUNCTION admin_cafe_seed_ids(p_cafe uuid)

REVOKE ALL ON FUNCTION public.admin_cafe_seed_ids(p_cafe uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_cafe_seed_ids(p_cafe uuid) TO service_role;

-- acl · public.FUNCTION admin_create_cafe(p_owner uuid, p_owner_name text, p_payload jsonb)

REVOKE ALL ON FUNCTION public.admin_create_cafe(p_owner uuid, p_owner_name text, p_payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_create_cafe(p_owner uuid, p_owner_name text, p_payload jsonb) TO service_role;

-- acl · public.FUNCTION admin_import_expenses(p_cafe uuid, p_payload jsonb)

REVOKE ALL ON FUNCTION public.admin_import_expenses(p_cafe uuid, p_payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_import_expenses(p_cafe uuid, p_payload jsonb) TO service_role;

-- acl · public.FUNCTION admin_import_orders(p_cafe uuid, p_payload jsonb)

REVOKE ALL ON FUNCTION public.admin_import_orders(p_cafe uuid, p_payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_import_orders(p_cafe uuid, p_payload jsonb) TO service_role;

-- acl · public.FUNCTION app_cafe_context(p_slug text)

REVOKE ALL ON FUNCTION public.app_cafe_context(p_slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_cafe_context(p_slug text) TO authenticated;

-- acl · public.FUNCTION app_my_cafes()

REVOKE ALL ON FUNCTION public.app_my_cafes() FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_my_cafes() TO authenticated;

-- acl · public.FUNCTION cafe_update_settings(p_cafe uuid, p_settings jsonb)

REVOKE ALL ON FUNCTION public.cafe_update_settings(p_cafe uuid, p_settings jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cafe_update_settings(p_cafe uuid, p_settings jsonb) TO authenticated;

-- acl · public.FUNCTION day_close(p_cafe uuid, p_counted_cash numeric, p_note text, p_pos_total numeric)

REVOKE ALL ON FUNCTION public.day_close(p_cafe uuid, p_counted_cash numeric, p_note text, p_pos_total numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.day_close(p_cafe uuid, p_counted_cash numeric, p_note text, p_pos_total numeric) TO authenticated;

-- acl · public.FUNCTION day_open(p_cafe uuid, p_opening_cash numeric)

REVOKE ALL ON FUNCTION public.day_open(p_cafe uuid, p_opening_cash numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.day_open(p_cafe uuid, p_opening_cash numeric) TO authenticated;

-- acl · public.FUNCTION day_status(p_cafe uuid)

REVOKE ALL ON FUNCTION public.day_status(p_cafe uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.day_status(p_cafe uuid) TO authenticated;

-- acl · public.FUNCTION demo_purge(p_cafe uuid)

REVOKE ALL ON FUNCTION public.demo_purge(p_cafe uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.demo_purge(p_cafe uuid) TO authenticated;

-- acl · public.FUNCTION demo_status(p_cafe uuid)

REVOKE ALL ON FUNCTION public.demo_status(p_cafe uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.demo_status(p_cafe uuid) TO authenticated;

-- acl · public.FUNCTION finance_delete_expense(p_cafe uuid, p_id uuid)

REVOKE ALL ON FUNCTION public.finance_delete_expense(p_cafe uuid, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.finance_delete_expense(p_cafe uuid, p_id uuid) TO authenticated;

-- acl · public.FUNCTION finance_expenses(p_cafe uuid)

REVOKE ALL ON FUNCTION public.finance_expenses(p_cafe uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.finance_expenses(p_cafe uuid) TO authenticated;

-- acl · public.FUNCTION finance_save_expense(p_cafe uuid, p_expense jsonb)

REVOKE ALL ON FUNCTION public.finance_save_expense(p_cafe uuid, p_expense jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.finance_save_expense(p_cafe uuid, p_expense jsonb) TO authenticated;

-- acl · public.FUNCTION menu_admin_data(p_cafe uuid)

REVOKE ALL ON FUNCTION public.menu_admin_data(p_cafe uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.menu_admin_data(p_cafe uuid) TO authenticated;

-- acl · public.FUNCTION menu_delete_category(p_cafe uuid, p_id uuid)

REVOKE ALL ON FUNCTION public.menu_delete_category(p_cafe uuid, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.menu_delete_category(p_cafe uuid, p_id uuid) TO authenticated;

-- acl · public.FUNCTION menu_delete_group(p_cafe uuid, p_id uuid)

REVOKE ALL ON FUNCTION public.menu_delete_group(p_cafe uuid, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.menu_delete_group(p_cafe uuid, p_id uuid) TO authenticated;

-- acl · public.FUNCTION menu_delete_ingredient(p_cafe uuid, p_id uuid)

REVOKE ALL ON FUNCTION public.menu_delete_ingredient(p_cafe uuid, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.menu_delete_ingredient(p_cafe uuid, p_id uuid) TO authenticated;

-- acl · public.FUNCTION menu_delete_product(p_cafe uuid, p_id uuid)

REVOKE ALL ON FUNCTION public.menu_delete_product(p_cafe uuid, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.menu_delete_product(p_cafe uuid, p_id uuid) TO authenticated;

-- acl · public.FUNCTION menu_recalculate_costs(p_cafe uuid, p_from date, p_to date)

REVOKE ALL ON FUNCTION public.menu_recalculate_costs(p_cafe uuid, p_from date, p_to date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.menu_recalculate_costs(p_cafe uuid, p_from date, p_to date) TO authenticated;

-- acl · public.FUNCTION menu_reorder(p_cafe uuid, p_kind text, p_ids uuid[])

REVOKE ALL ON FUNCTION public.menu_reorder(p_cafe uuid, p_kind text, p_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.menu_reorder(p_cafe uuid, p_kind text, p_ids uuid[]) TO authenticated;

-- acl · public.FUNCTION menu_reorder_favorites(p_cafe uuid, p_ids uuid[])

REVOKE ALL ON FUNCTION public.menu_reorder_favorites(p_cafe uuid, p_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.menu_reorder_favorites(p_cafe uuid, p_ids uuid[]) TO authenticated;

-- acl · public.FUNCTION menu_save_category(p_cafe uuid, p_category jsonb)

REVOKE ALL ON FUNCTION public.menu_save_category(p_cafe uuid, p_category jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.menu_save_category(p_cafe uuid, p_category jsonb) TO authenticated;

-- acl · public.FUNCTION menu_save_group(p_cafe uuid, p_group jsonb)

REVOKE ALL ON FUNCTION public.menu_save_group(p_cafe uuid, p_group jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.menu_save_group(p_cafe uuid, p_group jsonb) TO authenticated;

-- acl · public.FUNCTION menu_save_ingredient(p_cafe uuid, p_ingredient jsonb)

REVOKE ALL ON FUNCTION public.menu_save_ingredient(p_cafe uuid, p_ingredient jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.menu_save_ingredient(p_cafe uuid, p_ingredient jsonb) TO authenticated;

-- acl · public.FUNCTION menu_save_product(p_cafe uuid, p_product jsonb)

REVOKE ALL ON FUNCTION public.menu_save_product(p_cafe uuid, p_product jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.menu_save_product(p_cafe uuid, p_product jsonb) TO authenticated;

-- acl · public.FUNCTION menu_set_favorite(p_cafe uuid, p_product uuid, p_favorite boolean)

REVOKE ALL ON FUNCTION public.menu_set_favorite(p_cafe uuid, p_product uuid, p_favorite boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.menu_set_favorite(p_cafe uuid, p_product uuid, p_favorite boolean) TO authenticated;

-- acl · public.FUNCTION menu_set_product_active(p_cafe uuid, p_id uuid, p_is_active boolean)

REVOKE ALL ON FUNCTION public.menu_set_product_active(p_cafe uuid, p_id uuid, p_is_active boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.menu_set_product_active(p_cafe uuid, p_id uuid, p_is_active boolean) TO authenticated;

-- acl · public.FUNCTION pos_add_item(p_cafe uuid, p_table uuid, p_product uuid, p_option_ids uuid[], p_quantity integer, p_note text, p_price numeric)

REVOKE ALL ON FUNCTION public.pos_add_item(p_cafe uuid, p_table uuid, p_product uuid, p_option_ids uuid[], p_quantity integer, p_note text, p_price numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_add_item(p_cafe uuid, p_table uuid, p_product uuid, p_option_ids uuid[], p_quantity integer, p_note text, p_price numeric) TO authenticated;

-- acl · public.FUNCTION pos_cancel_order(p_cafe uuid, p_order uuid, p_reason text)

REVOKE ALL ON FUNCTION public.pos_cancel_order(p_cafe uuid, p_order uuid, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_cancel_order(p_cafe uuid, p_order uuid, p_reason text) TO authenticated;

-- acl · public.FUNCTION pos_change_payment_method(p_cafe uuid, p_payment uuid, p_method public.payment_method)

REVOKE ALL ON FUNCTION public.pos_change_payment_method(p_cafe uuid, p_payment uuid, p_method public.payment_method) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_change_payment_method(p_cafe uuid, p_payment uuid, p_method public.payment_method) TO authenticated;

-- acl · public.FUNCTION pos_change_quantity(p_cafe uuid, p_item uuid, p_delta integer)

REVOKE ALL ON FUNCTION public.pos_change_quantity(p_cafe uuid, p_item uuid, p_delta integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_change_quantity(p_cafe uuid, p_item uuid, p_delta integer) TO authenticated;

-- acl · public.FUNCTION pos_delete_payment(p_cafe uuid, p_payment uuid)

REVOKE ALL ON FUNCTION public.pos_delete_payment(p_cafe uuid, p_payment uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_delete_payment(p_cafe uuid, p_payment uuid) TO authenticated;

-- acl · public.FUNCTION pos_floor(p_cafe uuid)

REVOKE ALL ON FUNCTION public.pos_floor(p_cafe uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_floor(p_cafe uuid) TO authenticated;

-- acl · public.FUNCTION pos_history(p_cafe uuid, p_date date)

REVOKE ALL ON FUNCTION public.pos_history(p_cafe uuid, p_date date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_history(p_cafe uuid, p_date date) TO authenticated;

-- acl · public.FUNCTION pos_menu(p_cafe uuid)

REVOKE ALL ON FUNCTION public.pos_menu(p_cafe uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_menu(p_cafe uuid) TO authenticated;

-- acl · public.FUNCTION pos_move_order(p_cafe uuid, p_order uuid, p_target_table uuid)

REVOKE ALL ON FUNCTION public.pos_move_order(p_cafe uuid, p_order uuid, p_target_table uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_move_order(p_cafe uuid, p_order uuid, p_target_table uuid) TO authenticated;

-- acl · public.FUNCTION pos_pay(p_cafe uuid, p_order uuid, p_method public.payment_method, p_amount numeric)

REVOKE ALL ON FUNCTION public.pos_pay(p_cafe uuid, p_order uuid, p_method public.payment_method, p_amount numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_pay(p_cafe uuid, p_order uuid, p_method public.payment_method, p_amount numeric) TO authenticated;

-- acl · public.FUNCTION pos_pay_items(p_cafe uuid, p_order uuid, p_method public.payment_method, p_lines jsonb)

REVOKE ALL ON FUNCTION public.pos_pay_items(p_cafe uuid, p_order uuid, p_method public.payment_method, p_lines jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_pay_items(p_cafe uuid, p_order uuid, p_method public.payment_method, p_lines jsonb) TO authenticated;

-- acl · public.FUNCTION pos_price_item(p_cafe uuid, p_item uuid, p_unit_price numeric, p_unit_discount numeric)

REVOKE ALL ON FUNCTION public.pos_price_item(p_cafe uuid, p_item uuid, p_unit_price numeric, p_unit_discount numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_price_item(p_cafe uuid, p_item uuid, p_unit_price numeric, p_unit_discount numeric) TO authenticated;

-- acl · public.FUNCTION pos_remove_item(p_cafe uuid, p_item uuid)

REVOKE ALL ON FUNCTION public.pos_remove_item(p_cafe uuid, p_item uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_remove_item(p_cafe uuid, p_item uuid) TO authenticated;

-- acl · public.FUNCTION pos_reopen_order(p_cafe uuid, p_order uuid)

REVOKE ALL ON FUNCTION public.pos_reopen_order(p_cafe uuid, p_order uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_reopen_order(p_cafe uuid, p_order uuid) TO authenticated;

-- acl · public.FUNCTION pos_set_guests(p_cafe uuid, p_order uuid, p_guests integer)

REVOKE ALL ON FUNCTION public.pos_set_guests(p_cafe uuid, p_order uuid, p_guests integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_set_guests(p_cafe uuid, p_order uuid, p_guests integer) TO authenticated;

-- acl · public.FUNCTION pos_split_item(p_cafe uuid, p_item uuid, p_parts integer)

REVOKE ALL ON FUNCTION public.pos_split_item(p_cafe uuid, p_item uuid, p_parts integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_split_item(p_cafe uuid, p_item uuid, p_parts integer) TO authenticated;

-- acl · public.FUNCTION pos_table_order(p_cafe uuid, p_table uuid)

REVOKE ALL ON FUNCTION public.pos_table_order(p_cafe uuid, p_table uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_table_order(p_cafe uuid, p_table uuid) TO authenticated;

-- acl · public.FUNCTION pos_update_item(p_cafe uuid, p_item uuid, p_option_ids uuid[], p_quantity integer, p_note text, p_is_comp boolean)

REVOKE ALL ON FUNCTION public.pos_update_item(p_cafe uuid, p_item uuid, p_option_ids uuid[], p_quantity integer, p_note text, p_is_comp boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_update_item(p_cafe uuid, p_item uuid, p_option_ids uuid[], p_quantity integer, p_note text, p_is_comp boolean) TO authenticated;

-- acl · public.FUNCTION pos_update_order(p_cafe uuid, p_order uuid, p_note text, p_discount numeric)

REVOKE ALL ON FUNCTION public.pos_update_order(p_cafe uuid, p_order uuid, p_note text, p_discount numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_update_order(p_cafe uuid, p_order uuid, p_note text, p_discount numeric) TO authenticated;

-- acl · public.FUNCTION pos_void_order(p_cafe uuid, p_order uuid, p_reason text)

REVOKE ALL ON FUNCTION public.pos_void_order(p_cafe uuid, p_order uuid, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_void_order(p_cafe uuid, p_order uuid, p_reason text) TO authenticated;

-- acl · public.FUNCTION report_product_daily(p_cafe uuid, p_from date, p_to date)

REVOKE ALL ON FUNCTION public.report_product_daily(p_cafe uuid, p_from date, p_to date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.report_product_daily(p_cafe uuid, p_from date, p_to date) TO authenticated;

-- acl · public.FUNCTION report_products(p_cafe uuid, p_from date, p_to date)

REVOKE ALL ON FUNCTION public.report_products(p_cafe uuid, p_from date, p_to date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.report_products(p_cafe uuid, p_from date, p_to date) TO authenticated;

-- acl · public.FUNCTION report_range(p_cafe uuid, p_from date, p_to date)

REVOKE ALL ON FUNCTION public.report_range(p_cafe uuid, p_from date, p_to date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.report_range(p_cafe uuid, p_from date, p_to date) TO authenticated;

-- acl · public.FUNCTION report_series(p_cafe uuid, p_from date, p_to date)

REVOKE ALL ON FUNCTION public.report_series(p_cafe uuid, p_from date, p_to date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.report_series(p_cafe uuid, p_from date, p_to date) TO authenticated;

-- acl · public.FUNCTION report_z(p_cafe uuid, p_date date)

REVOKE ALL ON FUNCTION public.report_z(p_cafe uuid, p_date date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.report_z(p_cafe uuid, p_date date) TO authenticated;

-- acl · public.FUNCTION tables_admin_data(p_cafe uuid)

REVOKE ALL ON FUNCTION public.tables_admin_data(p_cafe uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tables_admin_data(p_cafe uuid) TO authenticated;

-- acl · public.FUNCTION tables_bulk_create(p_cafe uuid, p_area uuid, p_prefix text, p_from integer, p_to integer)

REVOKE ALL ON FUNCTION public.tables_bulk_create(p_cafe uuid, p_area uuid, p_prefix text, p_from integer, p_to integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tables_bulk_create(p_cafe uuid, p_area uuid, p_prefix text, p_from integer, p_to integer) TO authenticated;

-- acl · public.FUNCTION tables_delete_area(p_cafe uuid, p_id uuid)

REVOKE ALL ON FUNCTION public.tables_delete_area(p_cafe uuid, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tables_delete_area(p_cafe uuid, p_id uuid) TO authenticated;

-- acl · public.FUNCTION tables_delete_table(p_cafe uuid, p_id uuid)

REVOKE ALL ON FUNCTION public.tables_delete_table(p_cafe uuid, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tables_delete_table(p_cafe uuid, p_id uuid) TO authenticated;

-- acl · public.FUNCTION tables_save_area(p_cafe uuid, p_area jsonb)

REVOKE ALL ON FUNCTION public.tables_save_area(p_cafe uuid, p_area jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tables_save_area(p_cafe uuid, p_area jsonb) TO authenticated;

-- acl · public.FUNCTION tables_save_table(p_cafe uuid, p_table jsonb)

REVOKE ALL ON FUNCTION public.tables_save_table(p_cafe uuid, p_table jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tables_save_table(p_cafe uuid, p_table jsonb) TO authenticated;

-- acl · public.FUNCTION team_add_member(p_cafe uuid, p_email text, p_role public.member_role, p_display_name text)

REVOKE ALL ON FUNCTION public.team_add_member(p_cafe uuid, p_email text, p_role public.member_role, p_display_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.team_add_member(p_cafe uuid, p_email text, p_role public.member_role, p_display_name text) TO authenticated;

-- acl · public.FUNCTION team_list(p_cafe uuid)

REVOKE ALL ON FUNCTION public.team_list(p_cafe uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.team_list(p_cafe uuid) TO authenticated;

-- acl · public.FUNCTION team_remove_member(p_cafe uuid, p_user uuid)

REVOKE ALL ON FUNCTION public.team_remove_member(p_cafe uuid, p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.team_remove_member(p_cafe uuid, p_user uuid) TO authenticated;

-- acl · public.FUNCTION team_update_member(p_cafe uuid, p_user uuid, p_role public.member_role, p_display_name text)

REVOKE ALL ON FUNCTION public.team_update_member(p_cafe uuid, p_user uuid, p_role public.member_role, p_display_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.team_update_member(p_cafe uuid, p_user uuid, p_role public.member_role, p_display_name text) TO authenticated;

-- acl · public.TABLE orders

GRANT SELECT ON TABLE public.orders TO authenticated;

-- ---------------------------------------------------------------------
-- Tablolara doğrudan erişim kapalı (yalnızca adisyon değişikliklerini
-- realtime ile dinlemek için orders üzerinde satır güvenlikli SELECT)
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
grant select on table public.orders to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
     ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end
$$;

reset check_function_bodies;
