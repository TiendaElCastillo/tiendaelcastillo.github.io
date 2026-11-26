-- Keep customer-facing wallet refund entries free of supplier details and internal order references.
-- This changes only the visible description; it does not alter balances, amounts or refund rules.

create or replace function private.customer_friendly_wallet_refund_description()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.kind = 'refund' then
    new.description := 'Devolución acreditada en tu Cartera de Tienda El Castillo.';
  end if;

  return new;
end;
$function$;

drop trigger if exists wallet_refund_customer_description
  on public.wallet_transactions;

create trigger wallet_refund_customer_description
before insert or update of kind, description
on public.wallet_transactions
for each row
execute function private.customer_friendly_wallet_refund_description();

-- Clean existing refund history as well; preserve transaction amounts, IDs and dates.
update public.wallet_transactions
set description = 'Devolución acreditada en tu Cartera de Tienda El Castillo.'
where kind = 'refund'
  and description is distinct from 'Devolución acreditada en tu Cartera de Tienda El Castillo.';
