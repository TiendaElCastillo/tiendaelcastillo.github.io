-- Customer support tickets and private message threads.
-- Applied to the hosted Tienda-El-Castillo Supabase project as migration
-- 20261121135716_customer_support_inbox_and_private_ticket_messages.

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticket_code text not null unique default (
    'EC-S-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  ),
  category text not null check (
    category in ('pending','payment','duplicate','rejected','delivered','wallet_pending','wallet')
  ),
  subject text not null check (length(btrim(subject)) between 4 and 120),
  reference text check (reference is null or length(reference) <= 100),
  status text not null default 'open' check (
    status in ('open','in_progress','waiting_customer','resolved','closed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(btrim(body)) between 8 and 1500),
  created_at timestamptz not null default now()
);

create index support_tickets_user_updated_idx
  on public.support_tickets(user_id, updated_at desc);
create index support_messages_ticket_created_idx
  on public.support_messages(ticket_id, created_at asc);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

revoke all on table public.support_tickets from anon, public;
revoke all on table public.support_messages from anon, public;
grant select, insert on table public.support_tickets to authenticated;
grant update(status, updated_at) on table public.support_tickets to authenticated;
grant select, insert on table public.support_messages to authenticated;

create policy support_tickets_select_owner_or_admin
  on public.support_tickets
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy support_tickets_insert_owner
  on public.support_tickets
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'open'
  );

create policy support_tickets_update_owner_or_admin
  on public.support_tickets
  for update to authenticated
  using (
    user_id = (select auth.uid()) or (select private.is_admin())
  )
  with check (
    (select private.is_admin())
    or (
      user_id = (select auth.uid())
      and status = 'open'
    )
  );

create policy support_messages_select_ticket_owner_or_admin
  on public.support_messages
  for select to authenticated
  using (
    exists (
      select 1
      from public.support_tickets t
      where t.id = support_messages.ticket_id
        and (
          t.user_id = (select auth.uid())
          or (select private.is_admin())
        )
    )
  );

create policy support_messages_insert_ticket_owner_or_admin
  on public.support_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.support_tickets t
      where t.id = support_messages.ticket_id
        and t.status <> 'closed'
        and (
          t.user_id = (select auth.uid())
          or (select private.is_admin())
        )
    )
  );

create or replace function public.create_support_ticket(
  p_category text,
  p_subject text,
  p_reference text,
  p_message text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_ticket public.support_tickets%rowtype;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión para contactar con soporte.';
  end if;

  if p_category is null or p_category not in (
    'pending','payment','duplicate','rejected','delivered','wallet_pending','wallet'
  ) then
    raise exception 'Selecciona un motivo válido.';
  end if;

  if p_subject is null or length(btrim(p_subject)) not between 4 and 120 then
    raise exception 'El asunto debe tener entre 4 y 120 caracteres.';
  end if;

  if p_reference is not null and length(btrim(p_reference)) > 100 then
    raise exception 'La referencia es demasiado larga.';
  end if;

  if p_message is null or length(btrim(p_message)) not between 8 and 1500 then
    raise exception 'Describe la incidencia con al menos 8 caracteres.';
  end if;

  insert into public.support_tickets(user_id, category, subject, reference)
  values (
    v_user_id,
    p_category,
    btrim(p_subject),
    nullif(btrim(coalesce(p_reference, '')), '')
  )
  returning * into v_ticket;

  insert into public.support_messages(ticket_id, sender_id, body)
  values (v_ticket.id, v_user_id, btrim(p_message));

  return jsonb_build_object(
    'ok', true,
    'ticket_id', v_ticket.id,
    'ticket_code', v_ticket.ticket_code,
    'status', v_ticket.status
  );
end;
$function$;

create or replace function public.reply_support_ticket(
  p_ticket_id uuid,
  p_message text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_ticket public.support_tickets%rowtype;
  v_admin boolean;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión para responder.';
  end if;

  if p_ticket_id is null then
    raise exception 'No encontramos esa solicitud.';
  end if;

  if p_message is null or length(btrim(p_message)) not between 8 and 1500 then
    raise exception 'El mensaje debe tener entre 8 y 1500 caracteres.';
  end if;

  v_admin := (select private.is_admin());

  select *
    into v_ticket
    from public.support_tickets
   where id = p_ticket_id
   for update;

  if not found then
    raise exception 'No encontramos esa solicitud o no tienes acceso.';
  end if;

  if not v_admin and v_ticket.user_id <> v_user_id then
    raise exception 'No tienes permiso para responder a esta solicitud.';
  end if;

  if v_ticket.status = 'closed' then
    raise exception 'Esta solicitud está cerrada. Abre una nueva para recibir ayuda.';
  end if;

  insert into public.support_messages(ticket_id, sender_id, body)
  values (v_ticket.id, v_user_id, btrim(p_message));

  update public.support_tickets
     set status = case when v_admin then 'waiting_customer' else 'open' end,
         updated_at = now()
   where id = v_ticket.id;

  return jsonb_build_object(
    'ok', true,
    'ticket_id', v_ticket.id,
    'status', case when v_admin then 'waiting_customer' else 'open' end
  );
end;
$function$;

revoke all on function public.create_support_ticket(text,text,text,text) from public, anon;
revoke all on function public.reply_support_ticket(uuid,text) from public, anon;
grant execute on function public.create_support_ticket(text,text,text,text) to authenticated;
grant execute on function public.reply_support_ticket(uuid,text) to authenticated;
