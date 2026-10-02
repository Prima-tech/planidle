-- ============================================================================
--  RESET NIVEL 2 — ARRASAR EL ESQUEMA ENTERO Y RECONSTRUIR
--  Pégalo en Supabase → SQL Editor SOLO si quieres rehacer también las tablas,
--  funciones y policies desde cero (no solo vaciar los datos).
--
--  ⚠️ ANTES: ejecuta 00_dump_helper.sql y guarda su salida. Este script borra
--     `handle_new_user`, `save_character`, `claim_offline` y todas las RLS,
--     que HOY NO ESTÁN EN EL REPO. Sin el volcado, no se pueden recuperar.
--
--  DESPUÉS de ejecutarlo, en este orden:
--    1. tu schema.sql volcado   (tablas + trigger handle_new_user + RPC + RLS)
--    2. supabase/forge_offline.sql
--    3. ../admin/supabase/admin-setup.sql   (+ su bloque 8 para darte admin)
-- ============================================================================

-- 1) Fuera el trigger que cuelga de auth.users (no vive en public, no cae con
--    el drop schema).
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists handle_new_user      on auth.users;

-- 2) Fuera todas las cuentas de acceso.
delete from auth.users where true;

-- 3) Fuera el esquema public entero y vuelta a crearlo vacío.
drop schema public cascade;
create schema public;

-- 4) Permisos por defecto de Supabase sobre el esquema nuevo.
grant usage  on schema public to postgres, anon, authenticated, service_role;
grant all    on schema public to postgres, service_role;
alter default privileges in schema public
  grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;

-- 5) Extensiones que usa el juego (gen_random_uuid).
create extension if not exists pgcrypto with schema extensions;

-- A partir de aquí: ejecuta tu schema.sql, forge_offline.sql y admin-setup.sql.
