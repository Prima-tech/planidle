-- ============================================================================
--  PASO 0 — VOLCAR LO QUE HAY (hazlo ANTES de borrar nada)
--  Pégalo en Supabase → SQL Editor y guarda el resultado en supabase/schema.sql
--
--  Objetos como `handle_new_user`, `save_character` y `claim_offline` NO están
--  en el repo: solo existen en la base de datos. Si reseteas sin volcarlos,
--  se pierden. Esta consulta los devuelve como SQL listo para re-ejecutar.
-- ============================================================================

-- 1) TODAS las funciones/RPC del esquema public (incluye los trigger functions).
select string_agg(pg_get_functiondef(p.oid), E';\n\n' order by p.proname) || ';'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public';

-- 2) Los triggers (el `on auth.users` de handle_new_user incluido).
select string_agg(
         format('-- %s on %I.%I%s%s;',
                t.tgname, n.nspname, c.relname, E'\n', pg_get_triggerdef(t.oid)),
         E'\n\n' order by t.tgname)
  from pg_trigger t
  join pg_class c     on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
 where not t.tgisinternal
   and n.nspname in ('public', 'auth');

-- 3) Las policies de RLS.
select string_agg(
         format('create policy %I on %I.%I for %s%s using (%s)%s;',
                policyname, schemaname, tablename, cmd,
                case when roles = '{public}' then '' else ' to ' || array_to_string(roles, ', ') end,
                coalesce(qual, 'true'),
                case when with_check is null then '' else ' with check (' || with_check || ')' end),
         E'\n' order by tablename, policyname)
  from pg_policies
 where schemaname = 'public';

-- 4) Las columnas reales de cada tabla (para reconstruir los CREATE TABLE).
select table_name, ordinal_position, column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
 order by table_name, ordinal_position;
