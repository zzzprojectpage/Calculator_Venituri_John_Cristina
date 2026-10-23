-- Visteria (Banii Noștri) · John & Cristina — configurare Supabase
-- Rulați în SQL Editor, ÎN ACELAȘI proiect Supabase ca și aplicația Marius & Diana.
-- Creează un set propriu de obiecte „jc_”, deci nu ating datele vechii aplicații.
--
-- PASUL cu codul de acces: înlocuiți PUNE_CODUL_DE_64_CARACTERE_DIN_CREDENTIALS
-- cu codul din fișierul Credentials.txt (în baza de date se salvează doar hașa lui).

begin;

create table if not exists public.jc_access (
  id boolean primary key default true check (id),
  code_hash text not null
);

create table if not exists public.jc_months (
  month text primary key check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  data jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.jc_access enable row level security;
alter table public.jc_months enable row level security;
revoke all on public.jc_access, public.jc_months from public, anon, authenticated;

-- Verifică codul de acces (compară hașa SHA-256; codul în sine nu se stochează).
create or replace function public.jc_check_access(p_code text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_code is null or length(p_code) <> 64 or not exists (
    select 1 from public.jc_access where id = true
    and code_hash = encode(sha256(convert_to(p_code, 'UTF8')), 'hex')
  ) then raise exception 'ACCESS_DENIED'; end if;
end; $$;

-- Citește o lună. Dacă luna nu e salvată, o „însămânțează” din cea mai apropiată
-- lună anterioară: Planificatul se moștenește, încasatul efectiv se golește.
create or replace function public.jc_read(p_code text, p_month text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; source jsonb;
begin
  perform public.jc_check_access(p_code);
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH'; end if;
  select jsonb_build_object('data', data, 'version', version, 'updated_at', updated_at, 'seeded', false)
  into result from public.jc_months where month = p_month;
  if result is not null then return result; end if;
  select jsonb_build_object(
           'rows', coalesce((select jsonb_agg(jsonb_build_object(
                        'id', r->>'id', 'owner', r->>'owner', 'kind', r->>'kind',
                        'label', r->>'label', 'planned', r->'planned',
                        'actual', null, 'date', ''))
                     from jsonb_array_elements(src.data->'rows') r), '[]'::jsonb),
           'transfers', '[]'::jsonb)
  into source from public.jc_months src
  where src.month < p_month and jsonb_typeof(src.data->'rows') = 'array'
  order by src.month desc limit 1;
  if source is null then
    return jsonb_build_object('data', null, 'version', 0, 'updated_at', null, 'seeded', false);
  end if;
  return jsonb_build_object('data', source, 'version', 0, 'updated_at', null, 'seeded', true);
end; $$;

-- Lista lunilor salvate (pentru selectorul de luni).
create or replace function public.jc_months_list(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public.jc_check_access(p_code);
  select coalesce(jsonb_agg(jsonb_build_object('month', month, 'updated_at', updated_at) order by month), '[]'::jsonb)
  into result from public.jc_months;
  return result;
end; $$;

-- Salvează o lună cu verificare de versiune (CONFLICT dacă a salvat altcineva între timp).
-- Dacă p_carry = true, noile valori „Planificat” se copiază în toate lunile
-- următoare deja salvate care au aceeași (owner, denumire, tip). Lunile viitoare
-- necreate se moștenesc oricum la citire (vezi jc_read).
create or replace function public.jc_save(
  p_code text, p_month text, p_data jsonb, p_version integer, p_carry boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare old_version integer; result jsonb; r jsonb; propagated integer := 0;
begin
  perform public.jc_check_access(p_code);
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH'; end if;
  if p_version is null or p_version < 0 then raise exception 'INVALID_VERSION'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 250000
  or jsonb_typeof(p_data->'rows') is distinct from 'array'
  or jsonb_typeof(p_data->'transfers') is distinct from 'array' then raise exception 'INVALID_DATA'; end if;
  if jsonb_array_length(p_data->'rows') > 200 or jsonb_array_length(p_data->'transfers') > 200 then raise exception 'TOO_MANY_ROWS'; end if;
  for r in select value from jsonb_array_elements(p_data->'rows') loop
    if not (r ?& array['id','owner','kind','label','planned','actual','date'])
    or jsonb_typeof(r->'id') is distinct from 'string' or length(r->>'id') not between 1 and 100
    or coalesce(r->>'owner','') not in ('John','Cristina')
    or coalesce(r->>'kind','') not in ('income','expense')
    or jsonb_typeof(r->'label') is distinct from 'string' or length(trim(r->>'label')) not between 1 and 100
    or jsonb_typeof(r->'planned') is distinct from 'number'
    or (r->>'planned') !~ '^[0-9]+$' or (r->>'planned')::numeric > 100000000
    or (r->'actual' <> 'null'::jsonb and (jsonb_typeof(r->'actual') <> 'number'
        or (r->>'actual') !~ '^[0-9]+$' or (r->>'actual')::numeric > 100000000))
    or jsonb_typeof(r->'date') is distinct from 'string'
    or (r->>'date' <> '' and (r->>'date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
    then raise exception 'INVALID_ROW'; end if;
  end loop;
  for r in select value from jsonb_array_elements(p_data->'transfers') loop
    if not (r ?& array['id','from','amount','date'])
    or jsonb_typeof(r->'id') is distinct from 'string' or length(r->>'id') not between 1 and 100
    or coalesce(r->>'from','') not in ('John','Cristina')
    or jsonb_typeof(r->'amount') is distinct from 'number' or (r->>'amount') !~ '^[0-9]+$'
    or (r->>'amount')::numeric not between 1 and 100000000
    or jsonb_typeof(r->'date') is distinct from 'string' or (r->>'date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    then raise exception 'INVALID_TRANSFER'; end if;
  end loop;
  if exists(select id from (
    select value->>'id' id from jsonb_array_elements(p_data->'rows')
    union all select value->>'id' from jsonb_array_elements(p_data->'transfers')
  ) all_rows group by id having count(*) > 1) then raise exception 'DUPLICATE_ID'; end if;

  perform pg_advisory_xact_lock(hashtext('banii nostri:' || p_month));
  select version into old_version from public.jc_months where month = p_month;
  if coalesce(old_version, 0) <> p_version then raise exception 'CONFLICT'; end if;

  insert into public.jc_months(month, data, version, updated_at)
  values (p_month, p_data, p_version + 1, now())
  on conflict(month) do update set data = excluded.data, version = excluded.version, updated_at = excluded.updated_at;

  if p_carry then
    update public.jc_months m
    set data = jsonb_set(m.data, '{rows}',
          (select coalesce(jsonb_agg(
                   case when s.src_planned is not null
                        then jsonb_set(drow, '{planned}', s.src_planned, false)
                        else drow end), '[]'::jsonb)
           from jsonb_array_elements(m.data->'rows') drow
           left join (
             select sr->>'owner' src_owner, sr->>'label' src_label, sr->>'kind' src_kind, sr->'planned' src_planned
             from jsonb_array_elements(p_data->'rows') sr
           ) s on s.src_owner = drow->>'owner' and s.src_label = drow->>'label' and s.src_kind = drow->>'kind'
          ), true)
    where m.month > p_month and jsonb_typeof(m.data->'rows') = 'array';
    get diagnostics propagated = row_count;
  end if;

  select jsonb_build_object('version', version, 'updated_at', updated_at) into result
  from public.jc_months where month = p_month;
  return result || jsonb_build_object('propagated', propagated);
end; $$;

revoke all on function public.jc_check_access(text) from public, anon, authenticated;
revoke all on function public.jc_read(text, text) from public, anon, authenticated;
revoke all on function public.jc_months_list(text) from public, anon, authenticated;
revoke all on function public.jc_save(text, text, jsonb, integer, boolean) from public, anon, authenticated;
grant execute on function public.jc_read(text, text) to anon;
grant execute on function public.jc_months_list(text) to anon;
grant execute on function public.jc_save(text, text, jsonb, integer, boolean) to anon;

commit;

-- ===== Bootstrap: cod de acces + prima lună =====
-- 1) Hașa codului de acces (codul real rămâne doar în Credentials.txt):
insert into public.jc_access(id, code_hash)
values (true, encode(sha256(convert_to('PUNE_CODUL_DE_64_CARACTERE_DIN_CREDENTIALS', 'UTF8')), 'hex'))
on conflict(id) do nothing;

-- 2) Prima lună: ambele salarii planificate la 5000 lei. Lunile următoare
--    moștenesc automat aceste valori (și orice modificare ulterioară a Planificatului).
insert into public.jc_months(month, data, version)
values ('2026-10', jsonb_build_object(
  'rows', jsonb_build_array(
    jsonb_build_object('id','seed-income-john','owner','John','kind','income','label','Salariu','planned',5000,'actual',null,'date',''),
    jsonb_build_object('id','seed-income-cristina','owner','Cristina','kind','income','label','Salariu','planned',5000,'actual',null,'date','')
  ),
  'transfers', '[]'::jsonb
), 1)
on conflict(month) do nothing;
