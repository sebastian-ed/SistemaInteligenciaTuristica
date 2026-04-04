
-- Extensiones útiles
create extension if not exists pgcrypto;

-- MUNICIPIOS
create table if not exists public.municipalities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  province text,
  department text,
  public_contact_email text,
  created_at timestamptz not null default now()
);

-- PERFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin','carga','consulta')),
  created_at timestamptz not null default now()
);

-- ENCUESTAS
create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  visit_date date not null,
  capture_channel text not null,
  municipality_name text,
  province_label text,
  origin_place text not null,
  group_size integer not null default 1 check (group_size > 0),
  purpose text not null,
  nights integer not null default 0 check (nights >= 0),
  lodging_type text not null,
  transport_mode text,
  estimated_spend_ars numeric(14,2) not null default 0 check (estimated_spend_ars >= 0),
  satisfaction integer not null default 0,
  recommendation integer not null default 0,
  activities text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_survey_responses_municipality_id on public.survey_responses(municipality_id);
create index if not exists idx_survey_responses_visit_date on public.survey_responses(visit_date);

-- PATCH PARA BASES YA EXISTENTES
alter table public.survey_responses add column if not exists municipality_name text;
alter table public.survey_responses add column if not exists province_label text;
alter table public.survey_responses add column if not exists transport_mode text;
alter table public.survey_responses add column if not exists satisfaction integer not null default 0;
alter table public.survey_responses add column if not exists recommendation integer not null default 0;


-- ALOJAMIENTOS
create table if not exists public.lodging_inventory (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  name text not null,
  category text not null,
  units integer not null default 0 check (units >= 0),
  beds integer not null default 0 check (beds >= 0),
  address text,
  contact_name text,
  contact_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_lodging_inventory_municipality_id on public.lodging_inventory(municipality_id);

-- HELPER: obtener municipio del usuario actual
create or replace function public.current_municipality_id()
returns uuid
language sql
stable
as $$
  select municipality_id from public.profiles where id = auth.uid()
$$;

-- TRIGGER: alta automática de municipio + perfil al crear usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_municipality_id uuid;
  municipality_name text;
begin
  municipality_name := coalesce(new.raw_user_meta_data->>'municipality_name', 'Municipio sin nombre');

  insert into public.municipalities (name)
  values (municipality_name)
  returning id into new_municipality_id;

  insert into public.profiles (id, municipality_id, role)
  values (new.id, new_municipality_id, 'admin');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS
alter table public.municipalities enable row level security;
alter table public.profiles enable row level security;
alter table public.survey_responses enable row level security;
alter table public.lodging_inventory enable row level security;

-- POLÍTICAS MUNICIPALITIES
drop policy if exists "read own municipality" on public.municipalities;
create policy "read own municipality"
on public.municipalities
for select
using (id = public.current_municipality_id());

drop policy if exists "update own municipality admin" on public.municipalities;
create policy "update own municipality admin"
on public.municipalities
for update
using (
  id = public.current_municipality_id()
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
)
with check (
  id = public.current_municipality_id()
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

-- POLÍTICAS PROFILES
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
on public.profiles
for select
using (id = auth.uid());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

-- POLÍTICAS SURVEY_RESPONSES
drop policy if exists "select survey own municipality" on public.survey_responses;
create policy "select survey own municipality"
on public.survey_responses
for select
using (municipality_id = public.current_municipality_id());

drop policy if exists "insert survey own municipality" on public.survey_responses;
create policy "insert survey own municipality"
on public.survey_responses
for insert
with check (
  municipality_id = public.current_municipality_id()
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','carga')
  )
);

drop policy if exists "update survey own municipality" on public.survey_responses;
create policy "update survey own municipality"
on public.survey_responses
for update
using (municipality_id = public.current_municipality_id())
with check (municipality_id = public.current_municipality_id());

drop policy if exists "delete survey own municipality admin" on public.survey_responses;
create policy "delete survey own municipality admin"
on public.survey_responses
for delete
using (
  municipality_id = public.current_municipality_id()
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

-- POLÍTICAS LODGING
drop policy if exists "select lodging own municipality" on public.lodging_inventory;
create policy "select lodging own municipality"
on public.lodging_inventory
for select
using (municipality_id = public.current_municipality_id());

drop policy if exists "insert lodging own municipality" on public.lodging_inventory;
create policy "insert lodging own municipality"
on public.lodging_inventory
for insert
with check (
  municipality_id = public.current_municipality_id()
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','carga')
  )
);

drop policy if exists "update lodging own municipality" on public.lodging_inventory;
create policy "update lodging own municipality"
on public.lodging_inventory
for update
using (municipality_id = public.current_municipality_id())
with check (municipality_id = public.current_municipality_id());

drop policy if exists "delete lodging own municipality admin" on public.lodging_inventory;
create policy "delete lodging own municipality admin"
on public.lodging_inventory
for delete
using (
  municipality_id = public.current_municipality_id()
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);
