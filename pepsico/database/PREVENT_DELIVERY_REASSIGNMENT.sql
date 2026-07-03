-- Migration: Prevent reassignment of delivery partners once an order is linked
-- Run this in the Supabase SQL editor after applying DELIVERY_PARTNER_SCHEMA.sql

create or replace function prevent_delivery_reassignment()
returns trigger
language plpgsql
as $$
begin
  -- Allow the first assignment (OLD is null) and no-op updates
  if TG_OP = 'UPDATE' then
    if OLD.delivery_partner_id is not null and (NEW.delivery_partner_id is distinct from OLD.delivery_partner_id) then
      raise exception 'Delivery partner already assigned for this order';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_prevent_delivery_reassignment on orders;

create trigger trg_prevent_delivery_reassignment
before update on orders
for each row
when (OLD.delivery_partner_id is not null)
execute function prevent_delivery_reassignment();
