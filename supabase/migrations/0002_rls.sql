-- KEEYSTAY 0002: Row Level Security. Ownership is derived, never trusted from the client.
alter table properties        enable row level security;
alter table guests            enable row level security;
alter table bookings          enable row level security;
alter table payments          enable row level security;
alter table inventory_items   enable row level security;
alter table maintenance_issues enable row level security;
alter table damage_reports    enable row level security;
alter table photos            enable row level security;
alter table activity_logs     enable row level security;
alter table property_inventory_templates enable row level security;
alter table booking_inventory  enable row level security;
alter table checklist_templates enable row level security;
alter table checklist_items     enable row level security;
alter table booking_checklist_items enable row level security;

-- Tables carrying owner_id directly
do $$ declare t text;
begin
  foreach t in array array['properties','guests','bookings','payments','inventory_items',
    'maintenance_issues','damage_reports','photos','activity_logs'] loop
    execute format($f$
      create policy owner_select on %1$I for select using (owner_id = auth.uid());
      create policy owner_insert on %1$I for insert with check (owner_id = auth.uid());
      create policy owner_update on %1$I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
      create policy owner_delete on %1$I for delete using (owner_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- Child tables: ownership inherited via parent
create policy pit_all on property_inventory_templates for all
  using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));

create policy binv_all on booking_inventory for all
  using (exists (select 1 from bookings b where b.id = booking_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from bookings b where b.id = booking_id and b.owner_id = auth.uid()));

create policy ct_all on checklist_templates for all
  using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));

create policy ci_all on checklist_items for all
  using (exists (select 1 from checklist_templates t join properties p on p.id = t.property_id
                 where t.id = template_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from checklist_templates t join properties p on p.id = t.property_id
                 where t.id = template_id and p.owner_id = auth.uid()));

create policy bcli_all on booking_checklist_items for all
  using (exists (select 1 from bookings b where b.id = booking_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from bookings b where b.id = booking_id and b.owner_id = auth.uid()));

-- Storage: private bucket, per-user folder prefix
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('keeystay','keeystay', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

create policy storage_read on storage.objects for select
  using (bucket_id = 'keeystay' and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_write on storage.objects for insert
  with check (bucket_id = 'keeystay' and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_delete on storage.objects for delete
  using (bucket_id = 'keeystay' and (storage.foldername(name))[1] = auth.uid()::text);
