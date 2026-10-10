-- Zitronenkorb: Datenbank für den Abgleich zwischen euren Handys
-- Einmal komplett im Supabase SQL-Editor ausführen (Projekt der Zitronenpresse).
-- Kann gefahrlos mehrfach ausgeführt werden; vorhandene Daten bleiben erhalten.
--
-- Prinzip: Jeder Datensatz (Artikel, Listeneintrag, Kategorie, …) ist eine Zeile.
-- Die Tabelle ist für Fremdzugriff gesperrt. Lesen und Schreiben geht nur über
-- zk_pull / zk_push und nur mit dem geheimen Korb-Code. Gespeichert wird nicht
-- der Code selbst, sondern nur sein SHA-256-Hash.

create table if not exists public.zk_records (
  space      text        not null,               -- sha256 des Korb-Codes
  kind       text        not null,               -- item, list, cat, trip, …
  id         text        not null,
  data       jsonb,
  mtime      bigint      not null,               -- Änderungszeit vom Handy (ms)
  deleted    boolean     not null default false,
  rev        bigint      not null,               -- fortlaufende Server-Nummer fürs Nachladen
  updated_at timestamptz not null default now(),
  primary key (space, kind, id)
);

create sequence if not exists public.zk_rev_seq;
create index if not exists zk_records_space_rev on public.zk_records (space, rev);

alter table public.zk_records enable row level security;
revoke all on public.zk_records from public, anon, authenticated;
revoke all on sequence public.zk_rev_seq from public, anon, authenticated;

create or replace function public.zk_space(p_code text)
returns text
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_code is null or length(p_code) < 20 or length(p_code) > 100 then
    raise exception 'Ungültiger Korb-Code';
  end if;
  return encode(sha256(convert_to(lower(trim(p_code)), 'UTF8')), 'hex');
end;
$$;

-- Schreibt geänderte Datensätze. Der neuere Stand (mtime) gewinnt.
create or replace function public.zk_push(p_code text, p_rows jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  s text := public.zk_space(p_code);
  r jsonb;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'Ungültige Daten';
  end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    if (r->>'kind') !~ '^[a-z]{1,16}$'
       or coalesce(length(r->>'id'), 0) not between 1 and 64
       or (r->>'mtime') !~ '^[0-9]{1,15}$'
       or length(r::text) > 30000 then
      raise exception 'Ungültiger Datensatz';
    end if;
    insert into public.zk_records as t (space, kind, id, data, mtime, deleted, rev, updated_at)
    values (s, r->>'kind', r->>'id', r->'data', (r->>'mtime')::bigint,
            coalesce((r->>'deleted')::boolean, false), nextval('public.zk_rev_seq'), now())
    on conflict (space, kind, id) do update
      set data = excluded.data, mtime = excluded.mtime, deleted = excluded.deleted,
          rev = excluded.rev, updated_at = now()
      where t.mtime <= excluded.mtime;
  end loop;
  return (select coalesce(max(rev), 0) from public.zk_records where space = s);
end;
$$;

-- Liefert alle Datensätze, die sich seit p_since (Server-Nummer) geändert haben.
create or replace function public.zk_pull(p_code text, p_since bigint default 0)
returns table (kind text, id text, data jsonb, mtime bigint, deleted boolean, rev bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s text := public.zk_space(p_code);
begin
  return query
    select t.kind, t.id, t.data, t.mtime, t.deleted, t.rev
    from public.zk_records t
    where t.space = s and t.rev > coalesce(p_since, 0)
    order by t.rev
    limit 2000;
end;
$$;

revoke all on function public.zk_push(text, jsonb) from public;
revoke all on function public.zk_pull(text, bigint) from public;
grant execute on function public.zk_push(text, jsonb) to anon, authenticated;
grant execute on function public.zk_pull(text, bigint) to anon, authenticated;
