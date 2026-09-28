-- KEEYSTAY seed. Run after migrations, as the service role.
-- Set the owner to your signed-up auth user:
--   psql "$SUPABASE_DB_URL" -v owner="'<your-auth-uid>'" -f supabase/seed/seed.sql
-- Falls back to the first user in auth.users if :owner is not supplied.
\set ON_ERROR_STOP on
begin;

create temp table cfg as
  select coalesce(nullif(:'owner','owner')::uuid, (select id from auth.users order by created_at limit 1)) as owner_id;

insert into properties (owner_id,name,address,capacity,checkin_time,checkout_time,description,wifi_ssid,wifi_password,emergency_info,house_rules,status)
select owner_id, x.name, x.address, x.capacity, x.checkin_time::time, x.checkout_time::time,
       x.description, x.wifi_ssid, x.wifi_password, x.emergency_info, x.house_rules, x.status::property_status
from cfg, (values
 ('Villa Deodar','Hillside Road, Bhowali, Nainital 263132',6,'14:00','11:00','Three-bedroom stone cottage with valley-facing deck.','Deodar_5G','pine@2024','Caretaker Bhuwan 98765 43210 · B.D. Pandey Hospital 6 km','No loud music after 10 pm. Bonfire only with permission.','CLEANING'),
 ('Riverside Cottage','Near Kosi Bridge, Mohan, Ramnagar 244715',4,'13:00','10:00','Two-bedroom riverside cottage, 12 km from Dhikala gate.','Riverside','kosi1234','Caretaker Deepak 98111 22334 · Ramnagar CHC 14 km','No plastic below the river path. Safari pickup at 5 am.','MAINTENANCE'),
 ('Pine Ridge 2BHK','Tipin Top Road, Landour, Mussoorie 248179',5,'14:00','11:00','Top-floor apartment with deodar views and a wood stove.','PineRidge_2','ridge@321','Caretaker Sunita 90123 45678 · Landour Community Hospital 2 km','Shoes off indoors. Stove instructions in the folder.','OCCUPIED')
) as x(name,address,capacity,checkin_time,checkout_time,description,wifi_ssid,wifi_password,emergency_info,house_rules,status);

insert into guests (owner_id,name,phone,notes)
select owner_id, x.* from cfg, (values
 ('Rahul Sharma','+91 98200 41123','Repeat guest, prefers early check-in'),
 ('Priya Menon','+91 99401 55210',null),
 ('Anitha Krishnan','+91 90080 77341','Travelling with two children'),
 ('Imran Qureshi','+91 98330 21984',null),
 ('Sneha Deshpande','+91 88790 66512','Vegetarian meals arranged'),
 ('Vikram Rathore','+91 94140 33876',null),
 ('Meera Iyer','+91 98450 90233','Asked for a high chair'),
 ('Joseph Thomas','+91 94470 11298',null),
 ('Harpreet Kaur','+91 98140 55007','Corporate booking, GST invoice needed'),
 ('Ananya Bose','+91 98300 44561',null)
) as x(name,phone,notes);

insert into inventory_items (owner_id,name,unit,replacement_cost)
select owner_id, x.* from cfg, (values
 ('Bath towel','pc',450),('Pillow','pc',600),('Bedsheet set','set',1200),
 ('Water bottle','pc',20),('Key','pc',250),('TV remote','pc',900),
 ('AC remote','pc',750),('Hair dryer','pc',1400),('Iron','pc',1100),
 ('Hanger','pc',60),('Blanket','pc',1800),('Bath mat','pc',350)
) as x(name,unit,replacement_cost);

-- Inventory templates: sized to each property's capacity
insert into property_inventory_templates (property_id,item_id,expected_qty)
select p.id, i.id, q.qty
from properties p
join cfg on true
join (values
 ('Bath towel',4),('Pillow',4),('Bedsheet set',2),('Water bottle',8),
 ('Key',2),('TV remote',1),('AC remote',1),('Hair dryer',1),
 ('Iron',1),('Hanger',4),('Blanket',2),('Bath mat',2)
) as q(item_name,qty) on true
join inventory_items i on i.name = q.item_name and i.owner_id = cfg.owner_id
where p.owner_id = cfg.owner_id;

-- Checkout checklist template per property
insert into checklist_templates (property_id,name,kind)
select id,'Standard checkout','CHECKOUT' from properties;

insert into checklist_items (template_id,category,label,required,sort_order)
select t.id, c.category, c.label, c.required, c.ord
from checklist_templates t
join (values
 ('Bedroom','Bedsheets collected',true,1),('Bedroom','Pillows collected',true,2),
 ('Bedroom','Drawers checked',true,3),('Bedroom','Wardrobe checked',true,4),
 ('Bedroom','Under bed checked',false,5),
 ('Bathroom','Towels collected',true,6),('Bathroom','Toiletries checked',false,7),
 ('Bathroom','Water heater off',true,8),('Bathroom','Plumbing checked',true,9),
 ('Kitchen','Plates and glasses counted',true,10),('Kitchen','Cutlery counted',true,11),
 ('Kitchen','Refrigerator emptied',true,12),('Kitchen','Gas stove off',true,13),
 ('Living Room','Furniture inspected',false,14),
 ('Electronics','TV remote present',true,15),('Electronics','AC remote present',true,16),
 ('Electronics','Wi-Fi router powered',false,17),('Electronics','Guest chargers left behind',false,18),
 ('Security','Windows locked',true,19),('Security','Doors locked',true,20),
 ('Final Inspection','Lights and AC off',true,21),('Final Inspection','Water taps off',true,22),
 ('Final Inspection','Overall cleanliness',true,23),('Final Inspection','Damage checked',true,24)
) as c(category,label,required,ord) on true;

-- 15 bookings across the three properties, anchored to today
with p as (select id, name, row_number() over (order by name) rn from properties),
     g as (select id, name, row_number() over (order by name) rn from guests),
     spec(offset_in, len, gi, pi, amt, src, st) as (values
      (-32, 3, 1, 1, 16800,'AIRBNB','CHECKED_OUT'),
      (-27, 2, 2, 2,  9400,'DIRECT','CHECKED_OUT'),
      (-24, 4, 3, 3, 24000,'AIRBNB','CHECKED_OUT'),
      (-18, 3, 4, 1, 17400,'OTHER','CHECKED_OUT'),
      (-14, 2, 5, 2,  9800,'DIRECT','CHECKED_OUT'),
      (-11, 5, 6, 3, 31500,'AIRBNB','CHECKED_OUT'),
      ( -7, 3, 7, 1, 18600,'OTHER','CHECKED_OUT'),
      ( -5, 4, 8, 2, 19200,'DIRECT','CHECKED_OUT'),
      ( -3, 3, 9, 1, 18600,'OTHER','IN_STAY'),
      ( -2, 5,10, 3, 32000,'AIRBNB','IN_STAY'),
      (  0, 2, 1, 1, 12000,'AIRBNB','CONFIRMED'),
      (  0, 4, 3, 3, 26400,'DIRECT','CONFIRMED'),
      (  2, 3, 5, 2, 14100,'DIRECT','CONFIRMED'),
      (  6, 2, 7, 1, 12800,'AIRBNB','CONFIRMED'),
      ( 11, 4, 9, 2, 20800,'OTHER','CONFIRMED')
     )
insert into bookings (owner_id,property_id,guest_id,checkin_date,checkout_date,guest_count,total_amount,source,status,checkout_completed_at)
select cfg.owner_id, p.id, g.id,
       (current_date + spec.offset_in), (current_date + spec.offset_in + spec.len),
       2 + (spec.gi % 3), spec.amt, spec.src::booking_source, spec.st::booking_status,
       case when spec.st = 'CHECKED_OUT' then (current_date + spec.offset_in + spec.len)::timestamptz + interval '10 hours' end
from cfg, spec join p on p.rn = spec.pi join g on g.rn = spec.gi;

-- Payments: past stays fully paid, current stays partly paid, one arrival unpaid
insert into payments (owner_id,booking_id,amount,method,paid_at)
select b.owner_id, b.id, b.total_amount, 'UPI', b.checkin_date::timestamptz
from bookings b where b.status = 'CHECKED_OUT';

insert into payments (owner_id,booking_id,amount,method,paid_at)
select b.owner_id, b.id, round(b.total_amount * 0.6, 0), 'UPI', b.checkin_date::timestamptz
from bookings b where b.status in ('IN_STAY','CONFIRMED') and b.total_amount > 13000;

insert into payments (owner_id,booking_id,amount,method,paid_at)
select b.owner_id, b.id, 3000, 'CASH', b.checkin_date::timestamptz + interval '1 day'
from bookings b where b.status = 'IN_STAY';

-- Booking inventory from templates, with one real discrepancy on the stay checking out today
insert into booking_inventory (booking_id,item_id,expected_qty,given_qty,returned_qty,condition)
select b.id, t.item_id, t.expected_qty, t.expected_qty,
       case when b.status = 'CHECKED_OUT' then t.expected_qty else null end,
       'GOOD'
from bookings b join property_inventory_templates t on t.property_id = b.property_id
where b.status in ('CHECKED_OUT','IN_STAY');

update booking_inventory bi set returned_qty = expected_qty - 1, condition = 'MISSING'
where bi.item_id = (select id from inventory_items where name = 'Bath towel' limit 1)
  and bi.booking_id = (select id from bookings where status = 'IN_STAY' order by checkout_date limit 1);

-- Checklist rows for live and recent stays
insert into booking_checklist_items (booking_id,checklist_item_id,category,label,required,state,completed_at,sort_order)
select b.id, ci.id, ci.category, ci.label, ci.required,
       case when b.status = 'CHECKED_OUT' then 'COMPLETED'
            when ci.sort_order <= 12 then 'COMPLETED' else 'PENDING' end::task_state,
       case when b.status = 'CHECKED_OUT' or ci.sort_order <= 12
            then b.checkout_date::timestamptz + interval '10 hours' end,
       ci.sort_order
from bookings b
join checklist_templates t on t.property_id = b.property_id
join checklist_items ci on ci.template_id = t.id
where b.status in ('CHECKED_OUT','IN_STAY');

insert into maintenance_issues (owner_id,property_id,booking_id,category,title,description,priority,status,cost,created_at,resolved_at)
select cfg.owner_id, p.id, null, x.cat::mx_category, x.title, x.descr, x.pri::mx_priority, x.st::mx_status, x.cost,
       now() - (x.days || ' days')::interval,
       case when x.st = 'RESOLVED' then now() - interval '1 day' end
from cfg join properties p on p.owner_id = cfg.owner_id
join (values
 ('Riverside Cottage','PLUMBING','Geyser not heating','Bathroom 1 geyser trips the switch after two minutes.','URGENT','OPEN',null,2),
 ('Villa Deodar','AC','Bedroom 2 AC not cooling','Blowing warm air; gas top-up likely needed.','HIGH','IN_PROGRESS',2800,4),
 ('Pine Ridge 2BHK','WIFI','Router drops in the evening','Reboots fix it for a few hours. ISP ticket raised.','MEDIUM','OPEN',null,6),
 ('Villa Deodar','FURNITURE','Deck chair armrest cracked','Replaced with a spare from storage.','LOW','RESOLVED',1500,9)
) as x(prop,cat,title,descr,pri,st,cost,days) on x.prop = p.name;

insert into activity_logs (owner_id,property_id,booking_id,verb,summary,created_at)
select b.owner_id, b.property_id, b.id, v.verb, v.summary, b.checkin_date::timestamptz + v.off
from bookings b
join (values
 ('BOOKING_CREATED','Booking created', interval '-2 days'),
 ('INVENTORY_LOADED','Property inventory loaded (12 items)', interval '13 hours'),
 ('PAYMENT_RECEIVED','Payment received', interval '14 hours')
) as v(verb,summary,off) on true
where b.status in ('CHECKED_OUT','IN_STAY','CONFIRMED');

commit;
