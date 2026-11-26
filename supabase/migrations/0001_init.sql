-- Paddock · esquema inicial para Supabase
-- Ejecutar en Supabase › SQL Editor (o con `supabase db push`).
-- Cada promotora tiene miembros; solo sus miembros pueden ver y editar sus datos.

create table public.promoters (
  id          text primary key,
  name        text not null,
  description text,
  color       text not null default '#e10600',
  created_by  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.promoter_members (
  promoter_id text not null references public.promoters(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'editor' check (role in ('owner', 'editor')),
  created_at  timestamptz not null default now(),
  primary key (promoter_id, user_id)
);

create table public.drivers (
  id             text primary key,
  promoter_id    text not null references public.promoters(id) on delete cascade,
  name           text not null,
  nationality    text,
  default_number int
);

create table public.teams (
  id          text primary key,
  promoter_id text not null references public.promoters(id) on delete cascade,
  name        text not null,
  color       text not null default '#666666'
);

create table public.championships (
  id          text primary key,
  promoter_id text not null references public.promoters(id) on delete cascade,
  name        text not null,
  discipline  text not null default 'Otro',
  categories  jsonb not null default '[]'   -- [{id, name}]
);

-- Las rondas y resultados se guardan dentro de la temporada (jsonb):
-- se leen y escriben siempre juntos y así el motor de puntuación trabaja igual que en local.
create table public.seasons (
  id              text primary key,
  championship_id text not null references public.championships(id) on delete cascade,
  promoter_id     text not null references public.promoters(id) on delete cascade,
  category_id     text not null,
  name            text not null,
  year            int  not null,
  status          text not null default 'planned' check (status in ('planned', 'running', 'finished')),
  scoring         jsonb not null,
  entries         jsonb not null default '[]',
  rounds          jsonb not null default '[]',
  updated_at      timestamptz not null default now()
);

create table public.manual_titles (
  id              text primary key,
  promoter_id     text not null references public.promoters(id) on delete cascade,
  championship_id text not null references public.championships(id) on delete cascade,
  category_id     text not null,
  year            int  not null,
  driver_name     text not null,
  team_name       text
);

create index on public.drivers (promoter_id);
create index on public.teams (promoter_id);
create index on public.championships (promoter_id);
create index on public.seasons (promoter_id);
create index on public.manual_titles (promoter_id);

-- La temporada hereda la promotora de su campeonato (no se puede falsear desde el cliente)
create function public.seasons_set_promoter() returns trigger language plpgsql as $$
begin
  select promoter_id into new.promoter_id from public.championships where id = new.championship_id;
  new.updated_at := now();
  return new;
end $$;
create trigger seasons_set_promoter before insert or update on public.seasons
  for each row execute function public.seasons_set_promoter();

-- Quien crea una promotora pasa a ser su propietario
create function public.promoters_add_owner() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.promoter_members (promoter_id, user_id, role) values (new.id, new.created_by, 'owner');
  return new;
end $$;
create trigger promoters_add_owner after insert on public.promoters
  for each row execute function public.promoters_add_owner();

-- ¿Es el usuario actual miembro (o propietario) de la promotora?
create function public.is_member(p text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.promoter_members where promoter_id = p and user_id = auth.uid());
$$;
create function public.is_owner(p text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.promoter_members where promoter_id = p and user_id = auth.uid() and role = 'owner');
$$;

-- Invitar a otro organizador (ya registrado) por email. Solo el propietario.
create function public.invite_member(p text, member_email text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_owner(p) then raise exception 'Solo el propietario puede invitar'; end if;
  select id into uid from auth.users where lower(email) = lower(member_email);
  if uid is null then return 'not_found'; end if;
  insert into public.promoter_members (promoter_id, user_id) values (p, uid) on conflict do nothing;
  return 'ok';
end $$;

-- Lista de miembros con email (solo para miembros de esa promotora)
create function public.list_members(p text) returns table (user_id uuid, email text, role text)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text, m.role from public.promoter_members m join auth.users u on u.id = m.user_id
  where m.promoter_id = p and public.is_member(p);
$$;

-- Seguridad a nivel de fila
alter table public.promoters        enable row level security;
alter table public.promoter_members enable row level security;
alter table public.drivers          enable row level security;
alter table public.teams            enable row level security;
alter table public.championships    enable row level security;
alter table public.seasons          enable row level security;
alter table public.manual_titles    enable row level security;

create policy "ver mis promotoras"    on public.promoters for select using (public.is_member(id) or created_by = auth.uid());
create policy "crear promotora"      on public.promoters for insert with check (created_by = auth.uid());
create policy "editar promotora"     on public.promoters for update using (public.is_member(id));
create policy "borrar promotora"     on public.promoters for delete using (public.is_owner(id));

create policy "ver miembros"         on public.promoter_members for select using (public.is_member(promoter_id));
create policy "quitar miembros"      on public.promoter_members for delete using (public.is_owner(promoter_id) or user_id = auth.uid());

create policy "miembros" on public.drivers       for all using (public.is_member(promoter_id)) with check (public.is_member(promoter_id));
create policy "miembros" on public.teams         for all using (public.is_member(promoter_id)) with check (public.is_member(promoter_id));
create policy "miembros" on public.championships for all using (public.is_member(promoter_id)) with check (public.is_member(promoter_id));
create policy "miembros" on public.seasons       for all using (public.is_member(promoter_id)) with check (public.is_member(promoter_id));
create policy "miembros" on public.manual_titles for all using (public.is_member(promoter_id)) with check (public.is_member(promoter_id));

revoke execute on function public.invite_member(text, text) from anon;
revoke execute on function public.list_members(text) from anon;
