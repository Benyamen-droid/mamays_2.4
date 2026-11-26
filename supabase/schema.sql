-- =====================================================================
--  MAMAYS · Esquema de base de datos para Supabase
--  Pégalo completo en: Supabase → SQL Editor → New query → Run
--  Es idempotente: puedes volver a ejecutarlo sin perder datos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PERFILES (comensales y mamitas)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  role              text not null check (role in ('comensal','mamita')),
  full_name         text not null default '',
  email             text not null default '',
  phone             text not null default '',
  zone              text not null default '',
  address           text not null default '',          -- privada
  allergies         text[] not null default '{}',
  other_allergies   text not null default '',
  preferences       text not null default '',
  avoid_foods       text not null default '',
  public_zone_label text not null default '',
  bio               text not null default '',
  home_description  text not null default '',
  show_home         boolean not null default false,
  home_photos       text[] not null default '{}',
  avatar_url        text not null default '',
  yape_name         text not null default '',
  yape_phone        text not null default '',
  lat               double precision,
  lng               double precision,
  created_at        timestamptz not null default now()
);

-- Ubicación EXACTA de la cocina (privada): solo se comparte en un pedido aceptado de recojo / comer en el hogar.
-- (lat/lng públicos son solo la zona aproximada)
alter table public.profiles add column if not exists home_lat double precision;
alter table public.profiles add column if not exists home_lng double precision;

-- Coordenadas válidas dentro del Perú (o vacías)
create or replace function public.coords_validas(la double precision, ln double precision)
returns boolean language sql immutable as $$
  select (la is null and ln is null) or (la between -18.6 and 0.1 and ln between -81.5 and -68.5)
$$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_home_coords') then
    alter table public.profiles add constraint profiles_home_coords check (public.coords_validas(home_lat, home_lng));
  end if;
end $$;

-- onboarded: las cuentas que ya existían no ven la bienvenida; las nuevas sí
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='onboarded') then
    alter table public.profiles add column onboarded boolean not null default true;
    alter table public.profiles alter column onboarded set default false;
  end if;
end $$;

alter table public.profiles enable row level security;

drop policy if exists "perfil: leer el propio" on public.profiles;
create policy "perfil: leer el propio" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "perfil: editar el propio" on public.profiles;
create policy "perfil: editar el propio" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Nadie puede cambiarse de rol ni de correo editando su perfil
create or replace function public.protect_profile_fields()
returns trigger language plpgsql as $$
begin
  new.role  := old.role;
  new.email := old.email;
  new.id    := old.id;
  return new;
end $$;

drop trigger if exists trg_protect_profile on public.profiles;
create trigger trg_protect_profile before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Crea el perfil automáticamente al registrarse (datos enviados en signUp → options.data)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (
    id, role, full_name, email, phone, zone, address,
    allergies, other_allergies, preferences, avoid_foods,
    public_zone_label, bio, home_description, show_home, yape_name, yape_phone
  ) values (
    new.id,
    case when m->>'role' = 'mamita' then 'mamita' else 'comensal' end,
    coalesce(m->>'full_name',''),
    coalesce(new.email,''),
    coalesce(m->>'phone',''),
    coalesce(m->>'zone',''),
    coalesce(m->>'address',''),
    coalesce(array(select jsonb_array_elements_text(coalesce(m->'allergies','[]'::jsonb))), '{}'),
    coalesce(m->>'other_allergies',''),
    coalesce(m->>'preferences',''),
    coalesce(m->>'avoid_foods',''),
    coalesce(m->>'public_zone_label',''),
    coalesce(m->>'bio',''),
    coalesce(m->>'home_description',''),
    coalesce((m->>'show_home')::boolean, false),
    coalesce(m->>'yape_name',''),
    coalesce(m->>'yape_phone','')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. PLATOS
-- ---------------------------------------------------------------------
create table if not exists public.dishes (
  id             uuid primary key default gen_random_uuid(),
  mamita_id      uuid not null references public.profiles(id) on delete cascade,
  name           text not null check (length(trim(name)) between 2 and 80),
  description    text not null default '',
  category       text not null default 'Tradicional',
  price          numeric(8,2) not null check (price > 0 and price <= 500),
  portions       int not null default 0 check (portions between 0 and 500),
  ingredients    text not null check (length(trim(ingredients)) >= 3),
  allergens      text[] not null default '{}',
  tags           text[] not null default '{}',
  delivery_mode  text not null default 'ambos' check (delivery_mode in ('delivery','recojo','ambos')),
  delivery_cost  numeric(6,2) check (delivery_cost is null or delivery_cost >= 0),
  available_from text not null default '11:30',
  available_to   text not null default '15:00',
  conservation   text not null default '',
  photos         text[] not null default '{}',
  paused         boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- si hay delivery, el costo es obligatorio
  constraint delivery_cost_si_hay_delivery
    check (delivery_mode = 'recojo' or delivery_cost is not null)
);

create index if not exists dishes_mamita_idx on public.dishes(mamita_id);

-- Extras / acompañamientos que la mamita ofrece con el plato: [{"id":"x1","name":"Gelatina","price":2}]
create or replace function public.extras_validos(e jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(e) = 'array' and jsonb_array_length(e) <= 10 and coalesce(bool_and(
           jsonb_typeof(x) = 'object'
           and length(coalesce(x->>'id','')) between 1 and 40
           and length(trim(coalesce(x->>'name',''))) between 2 and 40
           and (x->>'price') ~ '^[0-9]+(\.[0-9]{1,2})?$' and (x->>'price')::numeric <= 50
         ), true)
  from jsonb_array_elements(case when jsonb_typeof(e) = 'array' then e else '[]'::jsonb end) x
$$;
alter table public.dishes add column if not exists extras  jsonb   not null default '[]'::jsonb;
alter table public.dishes add column if not exists dine_in boolean not null default false;  -- recibe comensales en su hogar
alter table public.dishes drop constraint if exists extras_validos;
alter table public.dishes add constraint extras_validos check (public.extras_validos(extras));

alter table public.dishes enable row level security;

drop policy if exists "platos: todos pueden ver" on public.dishes;
create policy "platos: todos pueden ver" on public.dishes for select using (true);

drop policy if exists "platos: la mamita crea los suyos" on public.dishes;
create policy "platos: la mamita crea los suyos" on public.dishes for insert
  with check (
    mamita_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'mamita')
  );

drop policy if exists "platos: la mamita edita los suyos" on public.dishes;
create policy "platos: la mamita edita los suyos" on public.dishes for update
  using (mamita_id = auth.uid()) with check (mamita_id = auth.uid());

drop policy if exists "platos: la mamita borra los suyos" on public.dishes;
create policy "platos: la mamita borra los suyos" on public.dishes for delete
  using (mamita_id = auth.uid());

-- ---------------------------------------------------------------------
-- 3. PEDIDOS
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  comensal_id      uuid not null references public.profiles(id) on delete cascade,
  comensal_name    text not null default '',
  mamita_id        uuid not null references public.profiles(id) on delete cascade,
  mamita_name      text not null default '',
  status           text not null check (status in
                    ('reservado','enviado','aceptado','preparando','listo','en_camino',
                     'entregado','rechazado','cancelado','expirado')),
  mode             text not null,
  payment_method   text not null,
  subtotal         numeric(8,2) not null,
  delivery_cost    numeric(6,2) not null default 0,
  total            numeric(8,2) not null,
  delivery_address text not null default '',
  receiver_name    text not null default '',
  receiver_phone   text not null default '',
  payer_name       text not null default '',
  notes            text not null default '',
  voucher_url      text not null default '',
  reserved_until   timestamptz,
  history          jsonb not null default '[]'::jsonb,
  rating           int check (rating between 1 and 5),
  review           text not null default '',
  created_at       timestamptz not null default now()
);

-- Dirección de recojo: se copia al pedido solo cuando la mamita lo acepta
alter table public.orders add column if not exists pickup_address text not null default '';
-- Punto de entrega (si el comensal compartió su ubicación) y punto exacto de recojo (se revela al aceptar)
alter table public.orders add column if not exists delivery_lat double precision;
alter table public.orders add column if not exists delivery_lng double precision;
alter table public.orders add column if not exists pickup_lat double precision;
alter table public.orders add column if not exists pickup_lng double precision;

-- Pagos en línea (Mercado Pago): Yape con código de aprobación y tarjeta con 3-D Secure
--   yape        → Yape en línea (celular + código de aprobación)
--   tarjeta     → tarjeta de crédito/débito con verificación 3-D Secure
--   yape_manual → Yape directo a la mamita + captura de constancia
--   efectivo    → se paga al recibir
alter table public.orders add column if not exists payment_id     text not null default '';
alter table public.orders add column if not exists payment_detail text not null default '';
alter table public.orders add column if not exists paid_at        timestamptz;
-- Comer en el hogar de la mamita: comensales y aceptación de términos de seguridad y convivencia
alter table public.orders add column if not exists guests            int not null default 1;
alter table public.orders add column if not exists terms_accepted_at timestamptz;
alter table public.orders add column if not exists terms_version     text not null default '';
alter table public.orders drop constraint if exists orders_mode_check;
alter table public.orders add constraint orders_mode_check check (mode in ('delivery','recojo','en_casa'));
alter table public.orders drop constraint if exists orders_guests_check;
alter table public.orders add constraint orders_guests_check check (guests between 1 and 6);
alter table public.orders drop constraint if exists terminos_si_come_en_casa;
alter table public.orders add constraint terminos_si_come_en_casa check (mode <> 'en_casa' or terms_accepted_at is not null);

alter table public.orders drop constraint if exists orders_payment_method_check;
update public.orders set payment_method = 'yape_manual' where payment_method = 'yape' and voucher_url <> '' and payment_id = '';
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('yape','tarjeta','yape_manual','efectivo'));

create index if not exists orders_comensal_idx on public.orders(comensal_id, created_at desc);
create index if not exists orders_mamita_idx   on public.orders(mamita_id, created_at desc);

create table if not exists public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  dish_id    uuid references public.dishes(id) on delete set null,
  dish_name  text not null,
  unit_price numeric(8,2) not null,
  qty        int not null check (qty between 1 and 20),
  photo      text not null default ''
);

alter table public.order_items add column if not exists extras       jsonb not null default '[]'::jsonb;
alter table public.order_items add column if not exists extras_total numeric(8,2) not null default 0;

create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_items_dish_idx  on public.order_items(dish_id);

alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Solo lectura directa: comensal y mamita ven sus pedidos. Crear y cambiar estados va por funciones (RPC).
drop policy if exists "pedidos: ver los míos" on public.orders;
create policy "pedidos: ver los míos" on public.orders for select
  using (comensal_id = auth.uid() or mamita_id = auth.uid());

drop policy if exists "items: ver los de mis pedidos" on public.order_items;
create policy "items: ver los de mis pedidos" on public.order_items for select
  using (exists (select 1 from public.orders o
                 where o.id = order_id and (o.comensal_id = auth.uid() or o.mamita_id = auth.uid())));

-- ---------------------------------------------------------------------
-- 4. NOTIFICACIONES Y FAVORITOS
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text not null default '',
  order_id   uuid references public.orders(id) on delete cascade,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "avisos: ver los míos" on public.notifications;
create policy "avisos: ver los míos" on public.notifications for select using (user_id = auth.uid());
drop policy if exists "avisos: marcar leídos" on public.notifications;
create policy "avisos: marcar leídos" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.favorites (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  dish_id    uuid not null references public.dishes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, dish_id)
);
alter table public.favorites enable row level security;
drop policy if exists "favoritos: los míos" on public.favorites;
create policy "favoritos: los míos" on public.favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 4b. RESEÑAS Y COMENTARIOS
--   dish    → calificación del plato (compra verificada)
--   mamita  → calificación de la mamá cocinera (compra verificada)
--   comment → comentario libre en un plato (cualquier comensal)
-- ---------------------------------------------------------------------
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('dish','mamita','comment')),
  dish_id     uuid references public.dishes(id) on delete cascade,
  mamita_id   uuid not null references public.profiles(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  author_name text not null default '',
  rating      int check (rating between 1 and 5),
  body        text not null default '' check (length(body) <= 500),
  verified    boolean not null default false,
  reply       text not null default '' check (length(reply) <= 500),
  replied_at  timestamptz,
  created_at  timestamptz not null default now(),
  constraint rating_segun_tipo check ((kind = 'comment' and rating is null) or (kind <> 'comment' and rating is not null)),
  constraint plato_segun_tipo  check ((kind = 'mamita' and dish_id is null) or (kind <> 'mamita' and dish_id is not null))
);
create index if not exists reviews_dish_idx   on public.reviews(dish_id, created_at desc);
create index if not exists reviews_mamita_idx on public.reviews(mamita_id, created_at desc);
create unique index if not exists reviews_una_por_pedido
  on public.reviews(order_id, kind, coalesce(dish_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where kind <> 'comment';

alter table public.reviews enable row level security;
drop policy if exists "reseñas: todos pueden leer" on public.reviews;
create policy "reseñas: todos pueden leer" on public.reviews for select using (true);
drop policy if exists "comentarios: borrar los míos" on public.reviews;
create policy "comentarios: borrar los míos" on public.reviews for delete using (author_id = auth.uid() and kind = 'comment');
-- crear y responder solo mediante funciones (ver más abajo)

-- ---------------------------------------------------------------------
-- 5. STOCK DEL DÍA (hora de Lima) Y VISTAS PÚBLICAS
-- ---------------------------------------------------------------------
create or replace function public.lima_today() returns date
language sql stable as $$ select (now() at time zone 'America/Lima')::date $$;

-- Porciones vendidas y reservadas HOY de un plato (las reservas vencidas no cuentan)
create or replace function public.dish_counts(p_dish uuid, out sold int, out reserved int)
language sql stable security definer set search_path = public as $$
  select
    coalesce(sum(oi.qty) filter (where o.status <> 'reservado'), 0)::int,
    coalesce(sum(oi.qty) filter (where o.status = 'reservado'), 0)::int
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.dish_id = p_dish
    and o.status not in ('rechazado','cancelado','expirado')
    and not (o.status = 'reservado' and o.reserved_until < now())
    and (o.created_at at time zone 'America/Lima')::date = public.lima_today()
$$;

drop view if exists public.dishes_view;
create view public.dishes_view as
select
  d.*,
  c.sold,
  c.reserved,
  greatest(d.portions - c.sold - c.reserved, 0) as available,
  p.full_name as mamita_name,
  p.zone      as mamita_zone,
  (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.kind = 'mamita' and r.mamita_id = d.mamita_id) as mamita_rating,
  (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.kind = 'dish' and r.dish_id = d.id) as rating,
  (select count(*) from public.reviews r where r.dish_id = d.id)::int as review_count
from public.dishes d
join public.profiles p on p.id = d.mamita_id
cross join lateral public.dish_counts(d.id) c;

-- Datos públicos de las mamitas (nunca expone la dirección privada ni el correo)
drop view if exists public.mamitas_public;
create view public.mamitas_public as
select
  p.id, p.full_name, p.zone, p.public_zone_label, p.bio,
  case when p.show_home then p.home_description else '' end as home_description,
  case when p.show_home then p.home_photos else '{}'::text[] end as home_photos,
  p.avatar_url, p.yape_name, p.yape_phone, p.lat, p.lng,
  (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.kind = 'mamita' and r.mamita_id = p.id) as rating,
  (select count(*) from public.reviews r where r.kind = 'mamita' and r.mamita_id = p.id)::int as rating_count,
  (select count(*) from public.dishes d where d.mamita_id = p.id and not d.paused)::int as dish_count
from public.profiles p
where p.role = 'mamita';

grant select on public.dishes_view, public.mamitas_public to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. FUNCIONES DE PEDIDOS (toda la lógica sensible vive en el servidor)
-- ---------------------------------------------------------------------
create or replace function public.notify(p_user uuid, p_title text, p_body text, p_order uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, title, body, order_id) values (p_user, p_title, p_body, p_order);
$$;
revoke all on function public.notify(uuid,text,text,uuid) from public, anon, authenticated;

create or replace function public.expire_reservations()
returns void language sql security definer set search_path = public as $$
  update public.orders
     set status = 'expirado',
         history = history || jsonb_build_array(jsonb_build_object('status','expirado','at',now()))
   where status = 'reservado' and reserved_until < now();
$$;

-- Crea el pedido, valida stock con bloqueo de fila y reserva 15 min si el pago es Yape
create or replace function public.place_order(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_me       public.profiles%rowtype;
  v_mamita   public.profiles%rowtype;
  v_mode     text := p->>'mode';
  v_pay      text := p->>'payment_method';
  v_item     jsonb;
  v_dish     public.dishes%rowtype;
  v_qty      int;
  v_avail    int;
  v_sub      numeric := 0;
  v_deliv    numeric := 0;
  v_code     text;
  v_order    uuid;
  v_status   text;
  v_now      timestamptz := now();
  v_guests   int := coalesce((p->>'guests')::int, 1);
  v_dlat     double precision := nullif(p->>'delivery_lat','')::double precision;
  v_dlng     double precision := nullif(p->>'delivery_lng','')::double precision;
  v_ext      jsonb;
  v_ext_tot  numeric;
  v_ext_id   text;
  v_found    jsonb;
begin
  if v_uid is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into v_me from public.profiles where id = v_uid;
  if v_me.role is distinct from 'comensal' then raise exception 'SOLO_COMENSALES'; end if;

  select * into v_mamita from public.profiles where id = (p->>'mamita_id')::uuid and role = 'mamita';
  if not found then raise exception 'MAMITA_NO_EXISTE'; end if;

  if v_mode not in ('delivery','recojo','en_casa') then raise exception 'MODALIDAD_INVALIDA'; end if;
  if v_mode = 'en_casa' then
    if coalesce((p->>'terms_accepted')::boolean, false) is not true then raise exception 'TERMINOS_REQUERIDOS'; end if;
    if v_guests not between 1 and 6 then raise exception 'COMENSALES_INVALIDOS'; end if;
  else
    v_guests := 1;
  end if;
  if v_pay  not in ('yape','tarjeta','yape_manual','efectivo') then raise exception 'PAGO_INVALIDO'; end if;
  if v_mode = 'delivery' and length(trim(coalesce(p->>'delivery_address',''))) < 5 then
    raise exception 'FALTA_DIRECCION';
  end if;
  if jsonb_array_length(coalesce(p->'items','[]'::jsonb)) = 0 then raise exception 'CARRITO_VACIO'; end if;

  perform public.expire_reservations();

  -- código único
  loop
    v_code := 'MAM-' || (1000000 + floor(random() * 8999999))::int::text;
    exit when not exists (select 1 from public.orders where code = v_code);
  end loop;

  -- Todo pago previo (Yape, tarjeta o constancia) reserva la porción 15 minutos; el efectivo va directo
  v_status := case when v_pay = 'efectivo' then 'enviado' else 'reservado' end;

  if (v_dlat is null) <> (v_dlng is null) or not public.coords_validas(v_dlat, v_dlng) then
    raise exception 'UBICACION_INVALIDA';
  end if;

  insert into public.orders (code, comensal_id, comensal_name, mamita_id, mamita_name, status, mode,
                             payment_method, subtotal, delivery_cost, total, delivery_address,
                             receiver_name, receiver_phone, payer_name, notes, reserved_until, history,
                             guests, terms_accepted_at, terms_version, delivery_lat, delivery_lng)
  values (v_code, v_uid, v_me.full_name, v_mamita.id, v_mamita.full_name, v_status, v_mode, v_pay,
          0, 0, 0,
          case when v_mode = 'delivery' then trim(p->>'delivery_address') else '' end,
          coalesce(nullif(trim(p->>'receiver_name'),''), v_me.full_name),
          coalesce(nullif(trim(p->>'receiver_phone'),''), v_me.phone),
          coalesce(nullif(trim(p->>'payer_name'),''), v_me.full_name),
          left(coalesce(p->>'notes',''), 300),
          case when v_pay <> 'efectivo' then v_now + interval '15 minutes' end,
          jsonb_build_array(jsonb_build_object('status', v_status, 'at', v_now)),
          v_guests,
          case when v_mode = 'en_casa' then v_now end,
          case when v_mode = 'en_casa' then left(coalesce(p->>'terms_version', 'v1'), 20) else '' end,
          case when v_mode = 'delivery' then v_dlat end,
          case when v_mode = 'delivery' then v_dlng end)
  returning id into v_order;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 20 then raise exception 'CANTIDAD_INVALIDA'; end if;

    -- Bloquea el plato: dos pedidos simultáneos no pueden llevarse la misma porción
    select * into v_dish from public.dishes where id = (v_item->>'dish_id')::uuid for update;
    if not found then raise exception 'PLATO_NO_EXISTE'; end if;
    if v_dish.mamita_id <> v_mamita.id then raise exception 'PLATOS_DE_OTRA_MAMITA'; end if;
    if v_dish.paused then raise exception 'PLATO_PAUSADO:%', v_dish.name; end if;
    if v_mode = 'delivery' and v_dish.delivery_mode = 'recojo' then
      raise exception 'SOLO_RECOJO:%', v_dish.name; end if;
    if v_mode = 'recojo' and v_dish.delivery_mode = 'delivery' then
      raise exception 'SOLO_DELIVERY:%', v_dish.name; end if;
    if v_mode = 'en_casa' and not v_dish.dine_in then
      raise exception 'SIN_COMER_EN_CASA:%', v_dish.name; end if;

    -- Extras elegidos: se validan contra los que ofrece la mamita y el precio sale de la base de datos
    v_ext := '[]'::jsonb; v_ext_tot := 0;
    for v_ext_id in select jsonb_array_elements_text(coalesce(v_item->'extras', '[]'::jsonb)) loop
      select x into v_found from jsonb_array_elements(v_dish.extras) x where x->>'id' = v_ext_id;
      if v_found is null then raise exception 'EXTRA_INVALIDO:%', v_dish.name; end if;
      if v_ext @> jsonb_build_array(jsonb_build_object('id', v_ext_id)) then continue; end if;
      v_ext := v_ext || jsonb_build_array(jsonb_build_object('id', v_ext_id, 'name', v_found->>'name', 'price', (v_found->>'price')::numeric));
      v_ext_tot := v_ext_tot + (v_found->>'price')::numeric;
    end loop;

    select v_dish.portions - c.sold - c.reserved into v_avail from public.dish_counts(v_dish.id) c;
    if v_qty > v_avail then raise exception 'SIN_STOCK:%', v_dish.name; end if;

    insert into public.order_items(order_id, dish_id, dish_name, unit_price, qty, photo, extras, extras_total)
    values (v_order, v_dish.id, v_dish.name, v_dish.price, v_qty, coalesce(v_dish.photos[1], ''), v_ext, v_ext_tot);

    v_sub := v_sub + (v_dish.price + v_ext_tot) * v_qty;
    if v_mode = 'delivery' then v_deliv := greatest(v_deliv, coalesce(v_dish.delivery_cost, 0)); end if;
  end loop;

  update public.orders set subtotal = v_sub, delivery_cost = v_deliv, total = v_sub + v_deliv
   where id = v_order;

  if v_status = 'enviado' then
    perform public.notify(v_mamita.id, '¡Nuevo pedido!', v_me.full_name || ' pidió (' || v_code || '), pago en efectivo.', v_order);
  end if;

  return v_order;
end $$;

-- El comensal adjunta la constancia de Yape dentro de los 15 minutos
create or replace function public.submit_voucher(p_order uuid, p_voucher text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.orders%rowtype;
begin
  select * into v from public.orders where id = p_order for update;
  if not found or v.comensal_id <> auth.uid() then raise exception 'PEDIDO_NO_EXISTE'; end if;
  if v.status <> 'reservado' or v.payment_method <> 'yape_manual' then raise exception 'ESTADO_INVALIDO'; end if;
  if v.reserved_until < now() then
    update public.orders set status = 'expirado',
      history = history || jsonb_build_array(jsonb_build_object('status','expirado','at',now()))
     where id = p_order;
    raise exception 'RESERVA_VENCIDA';
  end if;
  if length(coalesce(p_voucher,'')) < 5 then raise exception 'FALTA_CONSTANCIA'; end if;

  update public.orders
     set voucher_url = p_voucher, status = 'enviado', reserved_until = null,
         history = history || jsonb_build_array(jsonb_build_object('status','enviado','at',now()))
   where id = p_order;

  perform public.notify(v.mamita_id, '¡Nuevo pedido!',
    v.comensal_name || ' pagó con Yape S/ ' || to_char(v.total,'FM9990.00') || ' (' || v.code || '). Revisa la constancia.', p_order);
end $$;

-- Cambios de estado: la mamita avanza/rechaza; el comensal puede cancelar antes de que lo acepten
create or replace function public.set_order_status(p_order uuid, p_status text, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  v  public.orders%rowtype;
  ok boolean := false;
  v_msg text;
begin
  select * into v from public.orders where id = p_order for update;
  if not found then raise exception 'PEDIDO_NO_EXISTE'; end if;

  if v.mamita_id = auth.uid() then
    ok := (v.status = 'enviado'    and p_status in ('aceptado','rechazado'))
       or (v.status = 'aceptado'   and p_status in ('preparando','rechazado'))
       or (v.status = 'preparando' and p_status = case when v.mode = 'delivery' then 'en_camino' else 'listo' end)
       or (v.status in ('listo','en_camino') and p_status = 'entregado');
  elsif v.comensal_id = auth.uid() then
    ok := v.status in ('reservado','enviado') and p_status = 'cancelado';
  end if;

  if not ok then raise exception 'TRANSICION_NO_PERMITIDA'; end if;

  update public.orders
     set status = p_status,
         history = history || jsonb_build_array(jsonb_build_object('status',p_status,'at',now(),'reason',coalesce(p_reason,''))),
         pickup_address = case
           when p_status = 'aceptado' and v.mode in ('recojo','en_casa')
             then (select address from public.profiles where id = v.mamita_id)
           else pickup_address end,
         -- punto exacto de la cocina si la mamita lo marcó; si no, su zona aproximada
         pickup_lat = case
           when p_status = 'aceptado' and v.mode in ('recojo','en_casa')
             then (select coalesce(home_lat, lat) from public.profiles where id = v.mamita_id)
           else pickup_lat end,
         pickup_lng = case
           when p_status = 'aceptado' and v.mode in ('recojo','en_casa')
             then (select coalesce(home_lng, lng) from public.profiles where id = v.mamita_id)
           else pickup_lng end
   where id = p_order;

  v_msg := case p_status
    when 'aceptado'   then '¡La mamita aceptó tu pedido! Ya verificó tu pago.'
    when 'preparando' then 'Tu almuerzo se está preparando con mucho cariño.'
    when 'listo'      then case when v.mode = 'en_casa' then '¡Tu mesa está lista! La mamita te espera.' else 'Tu pedido está listo para recojo.' end
    when 'en_camino'  then 'Tu pedido va en camino.'
    when 'entregado'  then '¡Buen provecho! Cuéntanos qué tal estuvo.'
    when 'rechazado'  then 'La mamita no pudo aceptar tu pedido. ' || coalesce(p_reason,'')
    else null end;

  if p_status = 'cancelado' then
    if v.status = 'enviado' then
      perform public.notify(v.mamita_id, 'Pedido cancelado', v.comensal_name || ' canceló el pedido ' || v.code || '.', p_order);
    end if;
  elsif v_msg is not null then
    perform public.notify(v.comensal_id, v.code || ' · ' || initcap(replace(p_status,'_',' ')), v_msg, p_order);
  end if;
end $$;

-- ===== Pagos en línea: SOLO las llama la Edge Function "pagar" con la service_role key =====
-- Guarda el intento de pago y alarga la reserva mientras el comensal completa la verificación
create or replace function public.register_payment_attempt(p_order uuid, p_payment_id text, p_detail text)
returns void language sql security definer set search_path = public as $$
  update public.orders
     set payment_id = coalesce(p_payment_id, ''), payment_detail = coalesce(p_detail, ''),
         reserved_until = greatest(coalesce(reserved_until, now()), now() + interval '10 minutes')
   where id = p_order and status = 'reservado';
$$;

-- Pago aprobado por Mercado Pago → el pedido llega a la mamita (idempotente)
create or replace function public.confirm_online_payment(p_order uuid, p_payment_id text, p_detail text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.orders%rowtype;
begin
  select * into v from public.orders where id = p_order for update;
  if not found then raise exception 'PEDIDO_NO_EXISTE'; end if;
  if v.paid_at is not null then return; end if;                       -- ya confirmado
  if v.payment_method not in ('yape','tarjeta') then raise exception 'ESTADO_INVALIDO'; end if;
  -- si el cobro se aprobó justo al vencer la reserva, igual se respeta: el dinero ya se cobró
  if v.status not in ('reservado','expirado') then raise exception 'ESTADO_INVALIDO'; end if;

  update public.orders
     set status = 'enviado', paid_at = now(), reserved_until = null,
         payment_id = p_payment_id, payment_detail = coalesce(p_detail, 'accredited'),
         history = history || jsonb_build_array(jsonb_build_object('status','enviado','at',now()))
   where id = p_order;

  perform public.notify(v.mamita_id, '¡Nuevo pedido pagado!',
    v.comensal_name || ' pagó S/ ' || to_char(v.total,'FM9990.00') || ' con ' ||
    case when v.payment_method = 'yape' then 'Yape' else 'tarjeta' end || ' (' || v.code || ').', p_order);
end $$;

revoke all on function public.register_payment_attempt(uuid,text,text) from public, anon, authenticated;
revoke all on function public.confirm_online_payment(uuid,text,text)   from public, anon, authenticated;
grant execute on function public.register_payment_attempt(uuid,text,text) to service_role;
grant execute on function public.confirm_online_payment(uuid,text,text)   to service_role;

drop function if exists public.rate_order(uuid,int,text);

-- Calificación tras la entrega: la mamita (obligatorio) y cada plato del pedido
create or replace function public.submit_reviews(p_order uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v    public.orders%rowtype;
  v_r  int := (p->'mamita'->>'rating')::int;
  d    jsonb;
  v_dr int;
begin
  select * into v from public.orders where id = p_order for update;
  if not found or v.comensal_id <> auth.uid() then raise exception 'PEDIDO_NO_EXISTE'; end if;
  if v.status <> 'entregado' then raise exception 'AUN_NO_ENTREGADO'; end if;
  if v.rating is not null then raise exception 'YA_VALORADO'; end if;
  if v_r is null or v_r not between 1 and 5 then raise exception 'VALORACION_INVALIDA'; end if;

  insert into public.reviews(kind, mamita_id, order_id, author_id, author_name, rating, body, verified)
  values ('mamita', v.mamita_id, v.id, v.comensal_id, v.comensal_name, v_r, left(coalesce(p->'mamita'->>'body',''), 500), true);

  for d in select * from jsonb_array_elements(coalesce(p->'dishes', '[]'::jsonb)) loop
    v_dr := (d->>'rating')::int;
    if v_dr is null or v_dr not between 1 and 5 then raise exception 'VALORACION_INVALIDA'; end if;
    if not exists (select 1 from public.order_items i where i.order_id = v.id and i.dish_id = (d->>'dish_id')::uuid) then
      raise exception 'PLATO_NO_ESTA_EN_EL_PEDIDO';
    end if;
    insert into public.reviews(kind, dish_id, mamita_id, order_id, author_id, author_name, rating, body, verified)
    values ('dish', (d->>'dish_id')::uuid, v.mamita_id, v.id, v.comensal_id, v.comensal_name, v_dr, left(coalesce(d->>'body',''), 500), true);
  end loop;

  update public.orders set rating = v_r, review = left(coalesce(p->'mamita'->>'body',''), 400) where id = p_order;
  perform public.notify(v.mamita_id, 'Nueva calificación ★' || v_r, v.comensal_name || ' calificó su pedido ' || v.code || '.', p_order);
end $$;

-- Comentario libre en un plato (máx. 10 por día por persona)
create or replace function public.add_comment(p_dish uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_me public.profiles%rowtype; v_dish public.dishes%rowtype; v_id uuid;
begin
  select * into v_me from public.profiles where id = auth.uid();
  if v_me.role is distinct from 'comensal' then raise exception 'SOLO_COMENSALES'; end if;
  select * into v_dish from public.dishes where id = p_dish;
  if not found then raise exception 'PLATO_NO_EXISTE'; end if;
  if length(trim(coalesce(p_body,''))) < 2 then raise exception 'COMENTARIO_VACIO'; end if;
  if (select count(*) from public.reviews where author_id = v_me.id and kind = 'comment' and created_at > now() - interval '1 day') >= 10 then
    raise exception 'DEMASIADOS_COMENTARIOS';
  end if;
  insert into public.reviews(kind, dish_id, mamita_id, author_id, author_name, body, verified)
  values ('comment', v_dish.id, v_dish.mamita_id, v_me.id, v_me.full_name, left(trim(p_body), 500),
          exists (select 1 from public.orders o join public.order_items i on i.order_id = o.id
                   where o.comensal_id = v_me.id and o.status = 'entregado' and i.dish_id = v_dish.id))
  returning id into v_id;
  perform public.notify(v_dish.mamita_id, 'Nuevo comentario en ' || v_dish.name, v_me.full_name || ': ' || left(trim(p_body), 80), null);
  return v_id;
end $$;

-- La mamita responde una reseña o comentario sobre ella o sus platos
create or replace function public.reply_review(p_review uuid, p_reply text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.reviews%rowtype;
begin
  select * into r from public.reviews where id = p_review for update;
  if not found or r.mamita_id <> auth.uid() then raise exception 'RESENA_NO_EXISTE'; end if;
  update public.reviews set reply = left(trim(coalesce(p_reply,'')), 500), replied_at = now() where id = p_review;
  if length(trim(coalesce(p_reply,''))) > 0 then
    perform public.notify(r.author_id, 'La mamita respondió tu comentario', left(trim(p_reply), 120), r.order_id);
  end if;
end $$;

revoke all on function public.place_order(jsonb)                  from public, anon;
revoke all on function public.submit_voucher(uuid,text)           from public, anon;
revoke all on function public.set_order_status(uuid,text,text)    from public, anon;
revoke all on function public.submit_reviews(uuid,jsonb)          from public, anon;
revoke all on function public.add_comment(uuid,text)              from public, anon;
revoke all on function public.reply_review(uuid,text)             from public, anon;
revoke all on function public.expire_reservations()               from public, anon;
grant execute on function public.place_order(jsonb)               to authenticated;
grant execute on function public.submit_voucher(uuid,text)        to authenticated;
grant execute on function public.set_order_status(uuid,text,text) to authenticated;
grant execute on function public.submit_reviews(uuid,jsonb)       to authenticated;
grant execute on function public.add_comment(uuid,text)           to authenticated;
grant execute on function public.reply_review(uuid,text)          to authenticated;
grant execute on function public.expire_reservations()            to authenticated;

-- ---------------------------------------------------------------------
-- 7. ALMACENAMIENTO DE IMÁGENES
--    public-images: fotos de platos, avatar y cocina (públicas)
--    vouchers: constancias de Yape (privadas: solo comensal y su mamita)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('public-images', 'public-images', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('vouchers', 'vouchers', false)
  on conflict (id) do nothing;

drop policy if exists "imagenes: subir a mi carpeta" on storage.objects;
create policy "imagenes: subir a mi carpeta" on storage.objects for insert to authenticated
  with check (bucket_id in ('public-images','vouchers') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "imagenes: borrar las mías" on storage.objects;
create policy "imagenes: borrar las mías" on storage.objects for delete to authenticated
  using (bucket_id = 'public-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "imagenes públicas: leer" on storage.objects;
create policy "imagenes públicas: leer" on storage.objects for select
  using (bucket_id = 'public-images');

drop policy if exists "constancias: comensal y su mamita" on storage.objects;
create policy "constancias: comensal y su mamita" on storage.objects for select to authenticated
  using (
    bucket_id = 'vouchers' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.orders o where o.voucher_url = name and o.mamita_id = auth.uid())
    )
  );
