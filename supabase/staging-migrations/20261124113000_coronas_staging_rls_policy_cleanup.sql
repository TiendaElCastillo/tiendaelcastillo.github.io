-- Tighten only the isolated staging project's policies and privileges.
-- Private referral tables intentionally remain inaccessible to direct client queries.

-- Replace duplicate order/profile SELECT policies with one combined rule each.
drop policy if exists orders_read_own on public.orders;
drop policy if exists orders_read_own_or_admin on public.orders;
create policy orders_read_own_or_admin
  on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists profiles_read_self on public.profiles;
drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_read_self_or_admin
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

-- Customer catalog reads only published offers after login; administrators may
-- inspect unpublished offers in the staging admin panel.
drop policy if exists products_read_visible_authenticated on public.products;
create policy products_read_visible_authenticated
  on public.products for select to authenticated
  using (
    (active is true and storefront_visible is true)
    or (select private.is_admin())
  );

grant select on public.products to authenticated;
revoke all on public.products from anon, public;

-- Public profile/order/wallet data must never be queryable by an anonymous visitor.
revoke all on public.orders from anon, public;
revoke all on public.profiles from anon, public;
revoke all on public.wallet_settings from anon, public;

grant select on public.orders to authenticated;
grant select on public.profiles to authenticated;
grant select on public.wallet_settings to authenticated;
grant update on public.wallet_settings to authenticated;

create index if not exists wallet_settings_updated_by_idx
  on public.wallet_settings(updated_by);
