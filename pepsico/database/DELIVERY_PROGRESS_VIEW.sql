-- Delivery Progress View
-- Run this in Supabase SQL Editor to expose delivery journey data per order

create or replace view delivery_progress_view as
with logs as (
  select
    order_id,
    event_type,
    created_at,
    event_details,
    row_number() over (partition by order_id, event_type order by created_at asc) as event_rank
  from public.delivery_logs
)
select
  o.id as order_id,
  o.user_id,
  o.status,
  o.delivery_status,
  o.payment_method,
  o.total_amount,
  o.delivery_partner_id,
  o.created_at,
  o.updated_at,
  o.delivered_at,
  o.cod_amount_received,
  jsonb_build_object(
    'pending', o.created_at,
    'assigned', (select l.created_at from logs l where l.order_id = o.id and l.event_type = 'assigned' order by l.created_at asc limit 1),
    'packed', (select l.created_at from logs l where l.order_id = o.id and l.event_type in ('status_packed') order by l.created_at asc limit 1),
    'dispatched', (select l.created_at from logs l where l.order_id = o.id and l.event_type in ('status_dispatched', 'delivery_dispatched') order by l.created_at asc limit 1),
    'out_for_delivery', (select l.created_at from logs l where l.order_id = o.id and l.event_type in ('status_out_for_delivery','delivery_started') order by l.created_at asc limit 1),
    'delivered', o.delivered_at
  ) as stage_timestamps,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'event_type', l.event_type,
        'status', coalesce(l.event_details->>'status', replace(l.event_type, '_', ' ')),
        'note', l.event_details->>'note',
        'details', l.event_details,
        'created_at', l.created_at
      )
      order by l.created_at
    ) filter (where l.order_id is not null),
    '[]'::jsonb
  ) as journey
from public.orders o
left join logs l on l.order_id = o.id
group by
  o.id,
  o.user_id,
  o.status,
  o.delivery_status,
  o.payment_method,
  o.total_amount,
  o.delivery_partner_id,
  o.created_at,
  o.updated_at,
  o.delivered_at,
  o.cod_amount_received
order by o.created_at desc;

comment on view delivery_progress_view is 'Aggregated delivery timeline per order combining delivery_logs entries and order milestones.';
