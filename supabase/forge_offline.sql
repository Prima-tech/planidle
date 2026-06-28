-- ============================================================================
-- Forjas de cuenta + tiempo offline a prueba de trampas (server-time).
-- Pegar y ejecutar en el SQL Editor de Supabase (una sola vez).
--
-- Modelo: las forjas son datos de CUENTA (globales entre personajes). Su estado
-- vive en la columna `forges` (JSONB) de `global_data`, y el momento del último
-- guardado lo SELLA EL SERVIDOR en `forges_last_seen`. Al entrar, el cliente
-- reclama el tiempo offline con `claim_forge_offline()`, que calcula
-- `now() - forges_last_seen` con la hora del servidor → no se puede falsear
-- adelantando el reloj del móvil.
-- ============================================================================

-- 1) Columnas en global_data (id = profile/auth.uid()).
alter table public.global_data
  add column if not exists forges            jsonb,
  add column if not exists forges_last_seen  timestamptz;

-- 2) Guardar las forjas. El SERVIDOR sella el tiempo (no el cliente).
--    SECURITY DEFINER: el cliente no tiene UPDATE directo; valida auth.uid() aquí.
create or replace function public.save_forges(p_forges jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.global_data
     set forges            = p_forges,
         forges_last_seen  = now(),
         last_modified     = now()
   where id = auth.uid();
end;
$$;

-- 3) Reclamar el tiempo offline de las forjas con la HORA DEL SERVIDOR.
--    Devuelve segundos transcurridos (capados a 8 h) desde el último sello y
--    re-sella `forges_last_seen = now()`. 0 si nunca se guardó.
create or replace function public.claim_forge_offline()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last     timestamptz;
  v_elapsed  integer;
begin
  select forges_last_seen into v_last
    from public.global_data
   where id = auth.uid();

  if v_last is null then
    -- Primer uso: no hay sello aún. Sella ahora y no concede tiempo.
    update public.global_data set forges_last_seen = now() where id = auth.uid();
    return 0;
  end if;

  v_elapsed := greatest(0, least(floor(extract(epoch from (now() - v_last)))::int, 8 * 3600));

  update public.global_data set forges_last_seen = now() where id = auth.uid();
  return v_elapsed;
end;
$$;

-- 4) Permisos: solo usuarios autenticados pueden llamarlas.
grant execute on function public.save_forges(jsonb)     to authenticated;
grant execute on function public.claim_forge_offline()  to authenticated;
