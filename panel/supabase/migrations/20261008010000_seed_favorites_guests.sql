-- =====================================================================
-- Adisyon · 02 · Test verisi: favoriler ve kişi sayısı
-- =====================================================================
-- * admin_create_cafe ürünlerde favorite_rank alır (kurulumda Favoriler
--   sekmesi dolu gelsin).
-- * admin_import_orders adisyonlarda guests (kişi sayısı) alır (müşteri
--   analizi test verisinde de görünsün).
-- İkisi de yalnızca servis rolüyle çağrılır; davranış başka yerde değişmez.
-- =====================================================================

create or replace function public.admin_create_cafe(p_owner uuid, p_owner_name text, p_payload jsonb) RETURNS jsonb
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

  insert into public.products (id, cafe_id, category_id, name, description, price, cost_mode, fixed_cost, tags, sort_order, favorite_rank)
  select x.id, v_cafe, x.category_id, x.name, coalesce(x.description, ''), x.price,
         coalesce(x.cost_mode, 'recipe')::public.cost_mode, coalesce(x.fixed_cost, 0),
         coalesce(x.tags, '{}'::text[]), x.sort_order, x.favorite_rank
  from jsonb_to_recordset(coalesce(p_payload -> 'products', '[]'::jsonb))
    as x(id uuid, category_id uuid, name text, description text, price numeric, cost_mode text,
         fixed_cost numeric, tags text[], sort_order integer, favorite_rank integer);

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

create or replace function public.admin_import_orders(p_cafe uuid, p_payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_orders integer;
begin
  perform private.require_service();

  insert into public.orders (
    id, cafe_id, table_id, table_name, is_takeaway, status, note, discount_amount,
    cancel_reason, opened_at, closed_at, updated_at, is_demo, guests
  )
  select x.id, p_cafe, x.table_id, x.table_name, coalesce(x.is_takeaway, false),
         x.status::public.order_status, coalesce(x.note, ''), coalesce(x.discount_amount, 0),
         coalesce(x.cancel_reason, ''), x.opened_at, x.closed_at, coalesce(x.closed_at, x.opened_at),
         coalesce(x.is_demo, false), x.guests
  from jsonb_to_recordset(coalesce(p_payload -> 'orders', '[]'::jsonb))
    as x(id uuid, table_id uuid, table_name text, is_takeaway boolean, status text, note text,
         discount_amount numeric, cancel_reason text, opened_at timestamptz, closed_at timestamptz,
         is_demo boolean, guests integer);
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
