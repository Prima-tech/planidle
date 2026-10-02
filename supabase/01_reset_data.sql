-- ============================================================================
--  RESET NIVEL 1 — BORRAR TODOS LOS DATOS, CONSERVAR EL ESQUEMA
--  Pégalo en Supabase → SQL Editor y ejecútalo.
--
--  Deja las tablas, triggers, RPC y RLS EXACTAMENTE como están, pero vacía
--  todo el contenido: cuentas de acceso, perfiles, personajes y logros.
--  Es lo que quieres el 95% de las veces para "empezar de cero".
--
--  ⚠️ IRREVERSIBLE. No hay papelera. Haz el volcado de 00_dump_helper.sql y,
--     si quieres conservar las partidas, un backup en Database → Backups.
-- ============================================================================

-- Las FK van en cascada desde auth.users:
--   auth.users → global_data (on delete cascade) → characters (on delete cascade)
-- así que borrando los usuarios cae todo lo demás solo.

begin;

-- --- OPCIÓN A (por defecto): borra a los JUGADORES, conserva a los ADMINS ----
--     Tu cuenta de admin sigue existiendo y puedes entrar al panel sin
--     volver a registrarte ni re-insertarte en `admins`.
delete from auth.users
 where id not in (select user_id from public.admins);

-- --- OPCIÓN B: borrar TODO, admins incluidos --------------------------------
--     Descomenta estas dos líneas (y comenta el delete de arriba) si quieres
--     el proyecto literalmente vacío. Después tendrás que registrarte otra vez
--     en el juego y re-ejecutar el bloque 8 de admin-setup.sql para ser admin.
-- delete from public.admins where true;
-- delete from auth.users where true;

-- --- Restos sueltos (por si alguna tabla no cuelga de auth.users) ------------
do $$
begin
  if to_regclass('public.achievements') is not null then
    delete from public.achievements
     where profile_id not in (select id from public.global_data);
  end if;
end $$;

commit;

-- --- Comprobación: todo esto debería devolver 0 (o solo tus admins) ----------
select 'auth.users'  as tabla, count(*) from auth.users
union all select 'global_data',  count(*) from public.global_data
union all select 'characters',   count(*) from public.characters
union all select 'admins',       count(*) from public.admins;
