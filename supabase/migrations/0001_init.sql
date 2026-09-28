-- KEEYSTAY 0001: schema, constraints, indexes
create extension if not exists "pgcrypto";

create type property_status as enum ('OCCUPIED','CHECKOUT_DUE','CLEANING','INSPECTION','MAINTENANCE','READY','BLOCKED');
create type booking_source  as enum ('DIRECT','AIRBNB','OTHER');
create type booking_status  as enum ('CONFIRMED','IN_STAY','CHECKED_OUT','CANCELLED');
create type payment_method  as enum ('CASH','UPI','BANK_TRANSFER','OTHER');
create type item_condition  as enum ('GOOD','FAIR','DAMAGED','MISSING');
create type task_state      as enum ('PENDING','COMPLETED','SKIPPED');
create type mx_category     as enum ('AC','PLUMBING','ELECTRICAL','FURNITURE','APPLIANCE','WIFI','LOCK','OTHER');
create type mx_priority     as enum ('LOW','MEDIUM','HIGH','URGENT');
create type mx_status       as enum ('OPEN','IN_PROGRESS','RESOLVED');
create type photo_kind      as enum ('PROPERTY','CHECKIN','CHECKOUT','DAMAGE','MAINTENANCE');
create type damage_status   as enum ('OPEN','REVIEWED','RESOLVED');

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text,
  capacity int not null check (capacity between 1 and 50),
  checkin_time time not null default '14:00',
  checkout_time time not null default '11:00',
  description text, wifi_ssid text, wifi_password text,
  emergency_info text, house_rules text, notes text,
  status property_status not null default 'READY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table guests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null, phone text, email text, notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guests_name_fts on guests using gin (to_tsvector('simple', name));

create table bookings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references properties(id) on delete restrict,
  guest_id uuid not null references guests(id) on delete restrict,
  checkin_date date not null,
  checkout_date date not null,
  guest_count int not null check (guest_count > 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  source booking_source not null default 'DIRECT',
  status booking_status not null default 'CONFIRMED',
  checkout_completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dates_ordered check (checkout_date > checkin_date)
);
create index bookings_prop_dates on bookings (property_id, checkin_date, checkout_date);
create index bookings_checkin on bookings (checkin_date) where status <> 'CANCELLED';
create index bookings_checkout on bookings (checkout_date) where status <> 'CANCELLED';

create table payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid not null references bookings(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method payment_method not null,
  paid_at timestamptz not null default now(),
  reference text, notes text,
  created_at timestamptz not null default now()
);
create index payments_booking on payments (booking_id);

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null, unit text default 'pc',
  replacement_cost numeric(10,2) not null default 0 check (replacement_cost >= 0),
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table property_inventory_templates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  item_id uuid not null references inventory_items(id) on delete restrict,
  expected_qty int not null check (expected_qty > 0),
  unique (property_id, item_id)
);

create table booking_inventory (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  item_id uuid not null references inventory_items(id) on delete restrict,
  expected_qty int not null check (expected_qty >= 0),
  given_qty int check (given_qty >= 0),
  returned_qty int check (returned_qty >= 0),
  condition item_condition not null default 'GOOD',
  replacement_cost_override numeric(10,2) check (replacement_cost_override >= 0),
  notes text,
  updated_at timestamptz not null default now(),
  unique (booking_id, item_id),
  constraint given_not_over check (given_qty is null or given_qty <= expected_qty),
  constraint returned_not_over check (returned_qty is null or given_qty is null or returned_qty <= given_qty)
);
create index binv_booking on booking_inventory (booking_id);
create trigger binv_touch before update on booking_inventory for each row execute function touch_updated_at();

create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null, kind text not null default 'CHECKOUT',
  unique (property_id, name)
);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references checklist_templates(id) on delete cascade,
  category text not null, label text not null,
  required boolean not null default true,
  sort_order int not null default 0
);
create index cli_template on checklist_items (template_id, sort_order);

create table booking_checklist_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  checklist_item_id uuid references checklist_items(id) on delete set null,
  category text not null, label text not null,
  required boolean not null default true,
  state task_state not null default 'PENDING',
  note text, completed_at timestamptz,
  sort_order int not null default 0
);
create index bcli_booking on booking_checklist_items (booking_id, sort_order);

create table maintenance_issues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  category mx_category not null,
  title text not null, description text,
  priority mx_priority not null default 'MEDIUM',
  status mx_status not null default 'OPEN',
  cost numeric(10,2) check (cost >= 0),
  resolution_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint resolved_needs_ts check (status <> 'RESOLVED' or resolved_at is not null)
);
create index mx_open on maintenance_issues (property_id) where status <> 'RESOLVED';

create table damage_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  item_id uuid references inventory_items(id) on delete set null,
  location text, description text not null,
  estimated_cost numeric(10,2) check (estimated_cost >= 0),
  status damage_status not null default 'OPEN',
  notes text,
  created_at timestamptz not null default now()
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind photo_kind not null,
  storage_path text not null unique,
  property_id uuid references properties(id) on delete cascade,
  booking_id uuid references bookings(id) on delete cascade,
  booking_inventory_id uuid references booking_inventory(id) on delete cascade,
  maintenance_id uuid references maintenance_issues(id) on delete cascade,
  width int, height int,
  bytes int check (bytes is null or bytes <= 10485760),
  caption text,
  created_at timestamptz not null default now(),
  constraint photo_has_parent check (
    property_id is not null or booking_id is not null
    or booking_inventory_id is not null or maintenance_id is not null)
);
create index photos_booking on photos (booking_id, kind);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  booking_id uuid references bookings(id) on delete cascade,
  verb text not null, summary text not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index activity_recent on activity_logs (owner_id, created_at desc);
create index activity_booking on activity_logs (booking_id, created_at desc);

create trigger prop_touch before update on properties for each row execute function touch_updated_at();
create trigger guest_touch before update on guests for each row execute function touch_updated_at();
create trigger booking_touch before update on bookings for each row execute function touch_updated_at();
