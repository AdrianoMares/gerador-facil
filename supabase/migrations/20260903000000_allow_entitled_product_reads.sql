-- A product's commercial availability is independent from fulfillment of an already paid order.
-- The existing active-product policy remains in place; this policy adds the entitlement case.
create policy "Entitled users can read fulfilled products"
on public.products for select to authenticated
using (exists (
  select 1
  from public.entitlements e
  where e.product_id = products.id
    and e.user_id = (select auth.uid())
    and e.revoked_at is null
));
