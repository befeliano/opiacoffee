-- =====================================================================
-- Adisyon · 04 · Kişiye özel yetkiler
-- =====================================================================
-- Sahip her şeyi yapar. Müdür ve barista için yetkiler rolün varsayılanından
-- gelir; sahip kişi başına değiştirebilir (cafe_members.permissions):
--
--   anahtar    değer                              barista   müdür
--   figures    none | today | two_days | all      two_days  all    ciro ve geçmiş günler
--   profit     true | false                       false     true   kâr ve maliyet
--   reports    true | false                       false     true   rapor, ürün satışları, analiz
--   void       true | false                       true      true   adisyon silme / iptal
--   payments   true | false                       true      true   ödeme yöntemi değiştirme, geri alma
--   discounts  true | false                       true      true   indirim, ikram, satır fiyatı
--   menu       true | false                       false     true   menü, maliyet ve masa düzeni
--
-- Kontroller veritabanı fonksiyonlarındadır (arayüzde gizlemek yetmez):
-- private.require_perm / private.can / private.figures_scope.
-- Finans, Z raporu, ekip ve kafe ayarları yalnızca sahipte kalır.
-- =====================================================================

alter table public.cafe_members
  add column if not exists permissions jsonb not null default '{}'::jsonb;
alter table public.cafe_members drop constraint if exists cafe_members_permissions_check;
alter table public.cafe_members add constraint cafe_members_permissions_check
  check (jsonb_typeof(permissions) = 'object');

-- Rolün varsayılan yetkileri
create or replace function private.perm_defaults(p_role public.member_role)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'staff' then '{"figures": "two_days", "profit": false, "reports": false, "void": true, "payments": true, "discounts": true, "menu": false}'::jsonb
    else '{"figures": "all", "profit": true, "reports": true, "void": true, "payments": true, "discounts": true, "menu": true}'::jsonb
  end
$$;

-- Geçerli yetkiler: rol varsayılanı + kişiye özel değerler (sahipte hep tam)
create or replace function private.member_perms(p_role public.member_role, p_custom jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_role = 'owner' then private.perm_defaults('owner')
    else private.perm_defaults(p_role) || coalesce((
      select jsonb_object_agg(e.key, e.value)
      from jsonb_each(coalesce(p_custom, '{}'::jsonb)) e
      where e.key in ('figures', 'profit', 'reports', 'void', 'payments', 'discounts', 'menu')
    ), '{}'::jsonb)
  end
$$;

-- Oturumdaki kullanıcının bu kafedeki yetkileri (üye değilse null)
create or replace function private.my_perms(p_cafe uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.member_perms(m.role, m.permissions)
  from public.cafe_members m
  where m.cafe_id = p_cafe and m.user_id = (select auth.uid())
$$;

create or replace function private.can(p_cafe uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.my_perms(p_cafe) ->> p_key = 'true', false)
$$;

-- Ciro kapsamı: none | today | two_days | all
create or replace function private.figures_scope(p_cafe uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.my_perms(p_cafe) ->> 'figures', 'none')
$$;

create or replace function private.require_perm(p_cafe uuid, p_key text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role(p_cafe, 'staff');
  if not private.can(p_cafe, p_key) then
    raise exception 'E_FORBIDDEN' using errcode = '42501';
  end if;
end
$$;

revoke all on function private.perm_defaults(public.member_role) from public;
revoke all on function private.member_perms(public.member_role, jsonb) from public;
revoke all on function private.my_perms(uuid) from public;
revoke all on function private.can(uuid, text) from public;
revoke all on function private.figures_scope(uuid) from public;
revoke all on function private.require_perm(uuid, text) from public;

-- ---------------------------------------------------------------------
-- Mevcut fonksiyonlar: rol kontrolü yerine (ya da yanında) yetki kontrolü
-- ---------------------------------------------------------------------

create or replace function public.report_range(p_cafe uuid, p_from date, p_to date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_tz text;
  v_from timestamptz;
  v_to timestamptz;
  v_result jsonb;
begin
  perform private.require_perm(p_cafe, 'reports');
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

create or replace function public.report_series(p_cafe uuid, p_from date, p_to date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_tz text;
  v_from timestamptz;
  v_to timestamptz;
  v_result jsonb;
begin
  perform private.require_perm(p_cafe, 'reports');
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

create or replace function public.report_products(p_cafe uuid, p_from date, p_to date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_tz text;
  v_from timestamptz;
  v_to timestamptz;
  v_result jsonb;
begin
  perform private.require_perm(p_cafe, 'reports');
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

create or replace function public.report_product_daily(p_cafe uuid, p_from date, p_to date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_tz text;
begin
  perform private.require_perm(p_cafe, 'reports');
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

create or replace function public.menu_admin_data(p_cafe uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_perm(p_cafe, 'menu');
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

create or replace function public.menu_delete_category(p_cafe uuid, p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_perm(p_cafe, 'menu');
  delete from public.categories where id = p_id and cafe_id = p_cafe;
  if not found then
    raise exception 'E_NOT_FOUND';
  end if;
end
$$;

create or replace function public.menu_delete_group(p_cafe uuid, p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_perm(p_cafe, 'menu');
  delete from public.option_groups where id = p_id and cafe_id = p_cafe;
  if not found then
    raise exception 'E_NOT_FOUND';
  end if;
end
$$;

create or replace function public.menu_delete_ingredient(p_cafe uuid, p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_perm(p_cafe, 'menu');
  if exists (select 1 from public.recipe_items ri where ri.ingredient_id = p_id and ri.cafe_id = p_cafe) then
    raise exception 'E_INGREDIENT_IN_USE';
  end if;
  delete from public.ingredients where id = p_id and cafe_id = p_cafe;
  if not found then
    raise exception 'E_NOT_FOUND';
  end if;
end
$$;

create or replace function public.menu_delete_product(p_cafe uuid, p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_perm(p_cafe, 'menu');
  -- Geçmiş satışlar ürün adının kopyasıyla raporlarda kalmaya devam eder
  delete from public.products where id = p_id and cafe_id = p_cafe;
  if not found then
    raise exception 'E_NOT_FOUND';
  end if;
end
$$;

create or replace function public.menu_recalculate_costs(p_cafe uuid, p_from date, p_to date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_tz text;
  v_count integer;
begin
  perform private.require_perm(p_cafe, 'menu');
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

create or replace function public.menu_reorder(p_cafe uuid, p_kind text, p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_perm(p_cafe, 'menu');
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

create or replace function public.menu_reorder_favorites(p_cafe uuid, p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_perm(p_cafe, 'menu');
  if cardinality(coalesce(p_ids, '{}'::uuid[])) > 200 then
    raise exception 'E_INVALID_INPUT';
  end if;
  update public.products t set favorite_rank = x.ord - 1
  from unnest(p_ids) with ordinality as x(id, ord)
  where t.id = x.id and t.cafe_id = p_cafe and t.favorite_rank is not null;
end
$$;

create or replace function public.menu_save_category(p_cafe uuid, p_category jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_id uuid := nullif(p_category ->> 'id', '')::uuid;
  v_name text := private.clean_text(p_category ->> 'name', 40);
  v_subtitle text := private.clean_text(p_category ->> 'subtitle', 60);
begin
  perform private.require_perm(p_cafe, 'menu');
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

create or replace function public.menu_save_group(p_cafe uuid, p_group jsonb) RETURNS jsonb
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
  perform private.require_perm(p_cafe, 'menu');
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

create or replace function public.menu_save_ingredient(p_cafe uuid, p_ingredient jsonb) RETURNS jsonb
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
  perform private.require_perm(p_cafe, 'menu');
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

create or replace function public.menu_save_product(p_cafe uuid, p_product jsonb) RETURNS jsonb
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
  perform private.require_perm(p_cafe, 'menu');

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

create or replace function public.menu_set_favorite(p_cafe uuid, p_product uuid, p_favorite boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_perm(p_cafe, 'menu');
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

create or replace function public.menu_set_product_active(p_cafe uuid, p_id uuid, p_is_active boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_perm(p_cafe, 'menu');
  update public.products
  set is_active = coalesce(p_is_active, true), updated_at = now()
  where id = p_id and cafe_id = p_cafe;
  if not found then
    raise exception 'E_NOT_FOUND';
  end if;
end
$$;

create or replace function public.tables_admin_data(p_cafe uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_perm(p_cafe, 'menu');
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

create or replace function public.tables_bulk_create(p_cafe uuid, p_area uuid, p_prefix text, p_from integer, p_to integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_prefix text := private.clean_text(p_prefix, 12);
  v_start integer;
  v_count integer;
begin
  perform private.require_perm(p_cafe, 'menu');
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

create or replace function public.tables_delete_area(p_cafe uuid, p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_perm(p_cafe, 'menu');
  delete from public.areas where id = p_id and cafe_id = p_cafe;
  if not found then
    raise exception 'E_NOT_FOUND';
  end if;
end
$$;

create or replace function public.tables_delete_table(p_cafe uuid, p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform private.require_perm(p_cafe, 'menu');
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

create or replace function public.tables_save_area(p_cafe uuid, p_area jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_id uuid := nullif(p_area ->> 'id', '')::uuid;
  v_name text := private.clean_text(p_area ->> 'name', 40);
begin
  perform private.require_perm(p_cafe, 'menu');
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

create or replace function public.tables_save_table(p_cafe uuid, p_table jsonb) RETURNS jsonb
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
  perform private.require_perm(p_cafe, 'menu');
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

create or replace function public.pos_void_order(p_cafe uuid, p_order uuid, p_reason text) RETURNS jsonb
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
  perform private.require_perm(p_cafe, 'void');
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

create or replace function public.pos_cancel_order(p_cafe uuid, p_order uuid, p_reason text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders;
begin
  perform private.require_perm(p_cafe, 'void');

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

create or replace function public.pos_change_payment_method(p_cafe uuid, p_payment uuid, p_method public.payment_method) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_role public.member_role;
  v_payment public.payments;
  v_rate numeric := 0;
begin
  v_role := private.require_role(p_cafe, 'staff');
  perform private.require_perm(p_cafe, 'payments');

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

create or replace function public.pos_reopen_order(p_cafe uuid, p_order uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_role public.member_role;
  v_order public.orders;
begin
  v_role := private.require_role(p_cafe, 'staff');
  perform private.require_perm(p_cafe, 'payments');

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

create or replace function public.pos_delete_payment(p_cafe uuid, p_payment uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_payment public.payments;
  v_order public.orders;
begin
  perform private.require_perm(p_cafe, 'payments');

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

create or replace function public.pos_price_item(p_cafe uuid, p_item uuid, p_unit_price numeric, p_unit_discount numeric) RETURNS jsonb
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
  -- Menü fiyatına dönmek serbest; indirim ve farklı fiyat yetki ister
  if v_discount > 0 or v_price <> coalesce(v_item.list_price, v_item.unit_price) then
    perform private.require_perm(p_cafe, 'discounts');
  end if;

  update public.order_items
  set unit_price = v_price,
      unit_discount = v_discount
  where id = v_item.id;

  perform private.touch_order(v_order.id);
  return public.pos_table_order(p_cafe, v_order.table_id);
end
$$;

create or replace function public.pos_update_item(p_cafe uuid, p_item uuid, p_option_ids uuid[], p_quantity integer, p_note text, p_is_comp boolean) RETURNS jsonb
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

  -- İkram yetki ister (ikramı geri almak serbest)
  if coalesce(p_is_comp, false) and not v_item.is_comp then
    perform private.require_perm(p_cafe, 'discounts');
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

create or replace function public.pos_update_order(p_cafe uuid, p_order uuid, p_note text, p_discount numeric) RETURNS jsonb
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
  -- Hesaba indirim yetki ister (kaldırmak ya da azaltmak serbest)
  if v_discount > coalesce(v_order.extra_discount, 0) then
    perform private.require_perm(p_cafe, 'discounts');
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

create or replace function public.pos_history(p_cafe uuid, p_date date) RETURNS jsonb
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
  -- Ciro kapsamı: none/today → yalnızca bugün, two_days → bugün ve dün, all → hepsi
  if (private.figures_scope(p_cafe) in ('none', 'today') and p_date < v_today)
     or (private.figures_scope(p_cafe) = 'two_days' and p_date < v_today - 1) then
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

create or replace function public.pos_floor(p_cafe uuid) RETURNS jsonb
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
    'today', case when private.figures_scope(p_cafe) = 'none' then null else jsonb_build_object(
      'date', v_today,
      'orders', v_totals.orders,
      'items', v_totals.items,
      'revenue', v_totals.revenue,
      'cost', case when private.can(p_cafe, 'profit') then v_totals.cost end,
      'commission', v_totals.commission,
      'profit', case when private.can(p_cafe, 'profit') then round(v_totals.revenue - v_totals.cost - v_totals.commission, 2) end
    ) end
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

create or replace function public.team_list(p_cafe uuid) RETURNS jsonb
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
      'permissions', private.member_perms(m.role, m.permissions),
      'custom_permissions', m.permissions,
      'created_at', m.created_at,
      'is_self', m.user_id = (select auth.uid())
    ) order by private.role_rank(m.role) desc, m.display_name, u.email)
    from public.cafe_members m
    join auth.users u on u.id = m.user_id
    where m.cafe_id = p_cafe
  ), '[]'::jsonb);
end
$$;

-- ---------------------------------------------------------------------
-- Bağlam: oturumdaki kullanıcının geçerli yetkileri de gelir
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
    'permissions', private.member_perms(m.role, m.permissions),
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
-- Sahip, ekipteki birinin yetkilerini belirler. Gönderilen nesne kişiye
-- özel değerlerin tamamıdır (boş nesne = rolün varsayılanı).
-- ---------------------------------------------------------------------
create or replace function public.team_set_permissions(p_cafe uuid, p_user uuid, p_permissions jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_input jsonb := coalesce(p_permissions, '{}'::jsonb);
  v_clean jsonb;
begin
  perform private.require_role(p_cafe, 'owner');
  if jsonb_typeof(v_input) <> 'object' then
    raise exception 'E_INVALID_INPUT';
  end if;

  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_clean
  from jsonb_each(v_input) e
  where (e.key = 'figures' and jsonb_typeof(e.value) = 'string' and e.value #>> '{}' in ('none', 'today', 'two_days', 'all'))
     or (e.key in ('profit', 'reports', 'void', 'payments', 'discounts', 'menu') and jsonb_typeof(e.value) = 'boolean');
  if (select count(*) from jsonb_object_keys(v_input)) <> (select count(*) from jsonb_object_keys(v_clean)) then
    raise exception 'E_INVALID_INPUT';
  end if;

  update public.cafe_members
  set permissions = v_clean
  where cafe_id = p_cafe and user_id = p_user;
  if not found then
    raise exception 'E_USER_NOT_FOUND';
  end if;
end
$$;

revoke all on function public.team_set_permissions(uuid, uuid, jsonb) from public, anon;
grant execute on function public.team_set_permissions(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Raporlar: kâr/maliyet yetkisi olmayana maliyet alanları hiç gönderilmez.
-- Asıl hesap private.*_raw'da; public sarmalayıcı gerekirse alanları ayıklar.
-- ---------------------------------------------------------------------
create or replace function private.strip_keys(p_value jsonb, p_keys text[])
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  case jsonb_typeof(p_value)
    when 'object' then
      select coalesce(jsonb_object_agg(e.key, private.strip_keys(e.value, p_keys)), '{}'::jsonb) into v_result
      from jsonb_each(p_value) e
      where not (e.key = any (p_keys));
      return v_result;
    when 'array' then
      select coalesce(jsonb_agg(private.strip_keys(a.value, p_keys) order by a.ord), '[]'::jsonb) into v_result
      from jsonb_array_elements(p_value) with ordinality a(value, ord);
      return v_result;
    else
      return p_value;
  end case;
end
$$;
revoke all on function private.strip_keys(jsonb, text[]) from public;

alter function public.report_range(uuid, date, date) rename to report_range_raw;
alter function public.report_range_raw(uuid, date, date) set schema private;
revoke all on function private.report_range_raw(uuid, date, date) from public, anon, authenticated;

create function public.report_range(p_cafe uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb := private.report_range_raw(p_cafe, p_from, p_to);
begin
  if private.can(p_cafe, 'profit') then
    return v_result;
  end if;
  return private.strip_keys(v_result, array['cost', 'unit_cost']);
end
$$;
revoke all on function public.report_range(uuid, date, date) from public, anon;
grant execute on function public.report_range(uuid, date, date) to authenticated;

alter function public.report_series(uuid, date, date) rename to report_series_raw;
alter function public.report_series_raw(uuid, date, date) set schema private;
revoke all on function private.report_series_raw(uuid, date, date) from public, anon, authenticated;

create function public.report_series(p_cafe uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb := private.report_series_raw(p_cafe, p_from, p_to);
begin
  if private.can(p_cafe, 'profit') then
    return v_result;
  end if;
  return private.strip_keys(v_result, array['cost', 'unit_cost']);
end
$$;
revoke all on function public.report_series(uuid, date, date) from public, anon;
grant execute on function public.report_series(uuid, date, date) to authenticated;

alter function public.report_products(uuid, date, date) rename to report_products_raw;
alter function public.report_products_raw(uuid, date, date) set schema private;
revoke all on function private.report_products_raw(uuid, date, date) from public, anon, authenticated;

create function public.report_products(p_cafe uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb := private.report_products_raw(p_cafe, p_from, p_to);
begin
  if private.can(p_cafe, 'profit') then
    return v_result;
  end if;
  return private.strip_keys(v_result, array['cost', 'unit_cost']);
end
$$;
revoke all on function public.report_products(uuid, date, date) from public, anon;
grant execute on function public.report_products(uuid, date, date) to authenticated;
