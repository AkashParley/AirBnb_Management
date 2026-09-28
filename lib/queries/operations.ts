import { requireUser } from '@/lib/supabase/server';
import {
  summarisePayments, reconcile, checklistProgress, detectTurnover, missingQty,
  occupiedNightsInRange, occupancyPercent, aggregatePaymentStatuses,
  type InventoryRow, type PaymentSummary, type ChecklistProgress, type Turnover,
} from '@/lib/calculations';
import { istAt } from '@/lib/time';

export interface StayRow {
  id: string; guestName: string; guestPhone: string | null;
  propertyId: string; propertyName: string;
  checkinDate: string; checkoutDate: string;
  checkinAt: Date; checkoutAt: Date;
  guestCount: number; source: string; status: string;
  payment: PaymentSummary;
  turnover: Turnover;
}

/**
 * One query per table for a date window, joined in memory. Avoids N+1 and never
 * pulls historical photos or activity. Window is inclusive of overlapping stays.
 */
export async function loadWindow(fromISO: string, toISO: string) {
  const { sb } = await requireUser();

  const [props, bookings] = await Promise.all([
    sb.from('properties').select('id,name,status,checkin_time,checkout_time,capacity').order('name'),
    sb.from('bookings')
      .select('id,property_id,guest_id,checkin_date,checkout_date,guest_count,total_amount,source,status,guests(name,phone)')
      .neq('status', 'CANCELLED')
      .lte('checkin_date', toISO).gte('checkout_date', fromISO)
      .order('checkin_date'),
  ]);
  if (props.error) throw props.error;
  if (bookings.error) throw bookings.error;

  const ids = bookings.data.map(b => b.id);
  const pays = ids.length
    ? await sb.from('payments').select('booking_id,amount').in('booking_id', ids)
    : { data: [], error: null };
  if (pays.error) throw pays.error;

  const byProp = new Map(props.data.map(p => [p.id, p]));
  const paysBy = new Map<string, { amount: number }[]>();
  for (const p of pays.data) {
    const list = paysBy.get(p.booking_id) ?? [];
    list.push({ amount: Number(p.amount) });
    paysBy.set(p.booking_id, list);
  }

  // next arrival per property, for turnover detection
  const arrivals = new Map<string, string[]>();
  for (const b of bookings.data) {
    const list = arrivals.get(b.property_id) ?? [];
    list.push(b.checkin_date);
    arrivals.set(b.property_id, list.sort());
  }

  const stays: StayRow[] = bookings.data.map(b => {
    const prop = byProp.get(b.property_id)!;
    const guest = b.guests as unknown as { name: string; phone: string | null };
    const checkoutAt = istAt(b.checkout_date, prop.checkout_time);
    const nextArrival = (arrivals.get(b.property_id) ?? []).find(d => d === b.checkout_date);
    return {
      id: b.id, guestName: guest?.name ?? 'Guest', guestPhone: guest?.phone ?? null,
      propertyId: prop.id, propertyName: prop.name,
      checkinDate: b.checkin_date, checkoutDate: b.checkout_date,
      checkinAt: istAt(b.checkin_date, prop.checkin_time), checkoutAt,
      guestCount: b.guest_count, source: b.source, status: b.status,
      payment: summarisePayments(Number(b.total_amount), paysBy.get(b.id) ?? []),
      turnover: detectTurnover(checkoutAt, nextArrival ? istAt(nextArrival, prop.checkin_time) : null),
    };
  });

  return { properties: props.data, stays };
}

export interface StayDetail {
  bookingStatus: string;
  checkinCompletedAt: string | null;
  guestName: string; guestPhone: string | null;
  propertyId: string; propertyName: string; checkinTime: string; checkoutTime: string;
  checkinDate: string; checkoutDate: string;
  payment: PaymentSummary;
  inventory: (InventoryRow & { id: string; itemId: string; itemName: string; note: string | null })[];
  recon: ReturnType<typeof reconcile>;
  checklist: { id: string; category: string; label: string; required: boolean; state: 'PENDING' | 'COMPLETED' | 'SKIPPED' }[];
  progress: ChecklistProgress;
}

export async function loadStayDetail(bookingId: string): Promise<StayDetail> {
  const { sb } = await requireUser();
  const [b, inv, chk, pays] = await Promise.all([
    sb.from('bookings')
      .select('status,checkin_completed_at,checkin_date,checkout_date,total_amount,property_id,guests(name,phone),properties(name,checkin_time,checkout_time)')
      .eq('id', bookingId).single(),
    sb.from('booking_inventory')
      .select('id,item_id,expected_qty,given_qty,returned_qty,condition,notes,replacement_cost_override,inventory_items(name,replacement_cost)')
      .eq('booking_id', bookingId),
    sb.from('booking_checklist_items')
      .select('id,category,label,required,state').eq('booking_id', bookingId).order('sort_order'),
    sb.from('payments').select('amount').eq('booking_id', bookingId),
  ]);
  if (b.error) throw b.error;
  if (inv.error) throw inv.error;
  if (chk.error) throw chk.error;
  if (pays.error) throw pays.error;

  const guest = b.data.guests as unknown as { name: string; phone: string | null };
  const prop = b.data.properties as unknown as { name: string; checkin_time: string; checkout_time: string };

  const inventory = inv.data.map(r => {
    const item = r.inventory_items as unknown as { name: string; replacement_cost: number };
    return {
      id: r.id, itemId: r.item_id, itemName: item?.name ?? 'Item', note: r.notes,
      expectedQty: r.expected_qty, givenQty: r.given_qty, returnedQty: r.returned_qty,
      condition: r.condition,
      replacementCost: Number(r.replacement_cost_override ?? item?.replacement_cost ?? 0),
    };
  });
  return {
    bookingStatus: b.data.status, checkinCompletedAt: b.data.checkin_completed_at,
    guestName: guest?.name ?? 'Guest', guestPhone: guest?.phone ?? null,
    propertyId: b.data.property_id, propertyName: prop?.name ?? '',
    checkinTime: prop?.checkin_time ?? '14:00', checkoutTime: prop?.checkout_time ?? '11:00',
    checkinDate: b.data.checkin_date, checkoutDate: b.data.checkout_date,
    payment: summarisePayments(Number(b.data.total_amount), pays.data),
    inventory,
    recon: reconcile(inventory),
    checklist: chk.data,
    progress: checklistProgress(chk.data),
  };
}

/* ---------- property inventory template ---------- */
export interface TemplateRow { id: string; itemId: string; itemName: string; unit: string; expectedQty: number; replacementCost: number }

export async function listInventoryItems() {
  const { sb } = await requireUser();
  const { data, error } = await sb.from('inventory_items').select('id,name,unit,replacement_cost').order('name');
  if (error) throw error;
  return data;
}

export async function listPropertyTemplate(propertyId: string): Promise<TemplateRow[]> {
  const { sb } = await requireUser();
  const { data, error } = await sb.from('property_inventory_templates')
    .select('id,item_id,expected_qty,inventory_items(name,unit,replacement_cost)')
    .eq('property_id', propertyId);
  if (error) throw error;
  return data.map(r => {
    const item = r.inventory_items as unknown as { name: string; unit: string; replacement_cost: number };
    return {
      id: r.id, itemId: r.item_id, itemName: item?.name ?? 'Item', unit: item?.unit ?? 'pc',
      expectedQty: r.expected_qty, replacementCost: Number(item?.replacement_cost ?? 0),
    };
  }).sort((a, b) => a.itemName.localeCompare(b.itemName));
}

/* ---------- property detail: current + recent stays ---------- */
export interface PropertyStayRow {
  id: string; guestName: string; checkinDate: string; checkoutDate: string; status: string;
  recon: { clean: boolean; totalMissing: number; damagedRows: number } | null; // null until checked out
}

export async function loadPropertyPage(propertyId: string) {
  const { sb } = await requireUser();
  const [prop, bookings] = await Promise.all([
    sb.from('properties').select('id,name,address,status,capacity,checkin_time,checkout_time').eq('id', propertyId).single(),
    sb.from('bookings')
      .select('id,checkin_date,checkout_date,status,guests(name)')
      .eq('property_id', propertyId).neq('status', 'CANCELLED')
      .order('checkin_date', { ascending: false }).limit(15),
  ]);
  if (prop.error || !prop.data) throw prop.error ?? new Error('Property not found');
  if (bookings.error) throw bookings.error;

  const ids = bookings.data.map(b => b.id);
  const { data: invRows } = ids.length
    ? await sb.from('booking_inventory').select('booking_id,expected_qty,given_qty,returned_qty,condition,replacement_cost_override,inventory_items(replacement_cost)')
    : { data: [] as never[] };
  const byBooking = new Map<string, InventoryRow[]>();
  for (const r of invRows ?? []) {
    const item = (r as { inventory_items: unknown }).inventory_items as unknown as { replacement_cost: number };
    const row: InventoryRow = {
      expectedQty: r.expected_qty, givenQty: r.given_qty, returnedQty: r.returned_qty, condition: r.condition,
      replacementCost: Number(r.replacement_cost_override ?? item?.replacement_cost ?? 0),
    };
    const list = byBooking.get(r.booking_id) ?? [];
    list.push(row);
    byBooking.set(r.booking_id, list);
  }

  const stays: PropertyStayRow[] = bookings.data.map(b => {
    const guest = b.guests as unknown as { name: string };
    const rows = byBooking.get(b.id);
    const recon = b.status === 'CHECKED_OUT' && rows ? reconcile(rows) : null;
    return {
      id: b.id, guestName: guest?.name ?? 'Guest', checkinDate: b.checkin_date, checkoutDate: b.checkout_date,
      status: b.status, recon: recon && { clean: recon.clean, totalMissing: recon.totalMissing, damagedRows: recon.damagedRows },
    };
  });

  const current = stays.find(s => s.status === 'IN_STAY') ?? null;
  const recent = stays.filter(s => s.id !== current?.id);
  return { property: prop.data, current, recent };
}

/** Derived attention feed. Nothing is stored; it is always computed from live state. */
export interface AttentionItem {
  key: string; severity: 'fault' | 'attend' | 'info';
  title: string; context: string; detail: string; bookingId?: string; propertyId?: string;
}
export async function loadAttention(): Promise<AttentionItem[]> {
  const { sb } = await requireUser();
  const today = new Date().toISOString().slice(0, 10);
  const { properties, stays } = await loadWindow(today, today);
  const out: AttentionItem[] = [];

  for (const s of stays) {
    if (s.payment.remaining > 0)
      out.push({ key: `pay-${s.id}`, severity: 'attend', title: 'Payment pending',
        context: `${s.guestName} · ${s.propertyName}`,
        detail: `₹${s.payment.remaining.toLocaleString('en-IN')} remaining`, bookingId: s.id });
    if (s.turnover.sameDay && s.turnover.tight)
      out.push({ key: `turn-${s.id}`, severity: 'info', title: 'Same-day turnover',
        context: s.propertyName, detail: s.turnover.label, propertyId: s.propertyId });
  }

  const live = stays.filter(s => s.status === 'IN_STAY' || s.checkoutDate === today);
  for (const s of live) {
    const d = await loadStayDetail(s.id);
    if (d.progress.blocksReady && d.progress.total > 0)
      out.push({ key: `chk-${s.id}`, severity: 'attend', title: 'Checkout incomplete',
        context: s.propertyName,
        detail: `${d.progress.requiredOutstanding} required task(s) remaining`, bookingId: s.id });
    if (!d.recon.clean)
      out.push({ key: `inv-${s.id}`, severity: 'fault', title: 'Inventory discrepancy',
        context: s.propertyName,
        detail: `${d.recon.totalMissing} missing · ₹${d.recon.estimatedCost.toLocaleString('en-IN')} est.`,
        bookingId: s.id });
  }

  const { data: mx } = await sb.from('maintenance_issues')
    .select('id,title,priority,property_id,properties(name)').neq('status', 'RESOLVED');
  for (const m of mx ?? []) {
    const p = m.properties as unknown as { name: string };
    out.push({ key: `mx-${m.id}`, severity: m.priority === 'URGENT' ? 'fault' : 'attend',
      title: 'Maintenance', context: p?.name ?? '', detail: `${m.title} · ${m.priority}`,
      propertyId: m.property_id });
  }

  const rank = { fault: 0, attend: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Month overview for the calendar shell: properties + stays in range, plus a few roll-up stats. */
export interface MonthStats {
  revenue: number; occupancyPct: number; activeBookings: number;
  maintenanceOpen: number; sameDayTurnovers: number;
}
export async function loadMonthOverview(fromISO: string, toISO: string) {
  const { sb } = await requireUser();
  const { properties, stays } = await loadWindow(fromISO, toISO);
  const { count: maintenanceOpen } = await sb
    .from('maintenance_issues').select('id', { count: 'exact', head: true }).neq('status', 'RESOLVED');

  const days = (new Date(toISO).getTime() - new Date(fromISO).getTime()) / 86_400_000 + 1;
  const nights = stays.reduce((a, s) => {
    const start = Math.max(new Date(s.checkinDate).getTime(), new Date(fromISO).getTime());
    const end = Math.min(new Date(s.checkoutDate).getTime(), new Date(toISO).getTime());
    return a + Math.max(0, (end - start) / 86_400_000);
  }, 0);

  const stats: MonthStats = {
    revenue: Math.round(stays.reduce((a, s) => a + s.payment.total, 0)),
    occupancyPct: properties.length ? Math.round((nights / (properties.length * days)) * 100) : 0,
    activeBookings: stays.length,
    maintenanceOpen: maintenanceOpen ?? 0,
    sameDayTurnovers: stays.filter(s => s.turnover.sameDay).length,
  };
  return { properties, stays, stats };
}

/** Row shape for the Bookings list page — deliberately flatter than StayRow (no turnover math needed here). */
export interface BookingListRow {
  id: string; guestName: string; propertyId: string; propertyName: string;
  checkinDate: string; checkoutDate: string; guestCount: number;
  status: string; payment: PaymentSummaryLite;
}
export interface PaymentSummaryLite { total: number; received: number; remaining: number; status: string }

export interface BookingListFilters {
  search?: string; status?: string; propertyId?: string;
  from?: string; to?: string; page?: number;
}
const PAGE_SIZE = 25;

export async function listBookings(filters: BookingListFilters) {
  const { sb } = await requireUser();
  const page = filters.page ?? 1;

  let query = sb.from('bookings')
    .select('id,property_id,checkin_date,checkout_date,guest_count,total_amount,status,guests(name),properties(name)',
      { count: 'exact' });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.propertyId) query = query.eq('property_id', filters.propertyId);
  if (filters.from) query = query.gte('checkout_date', filters.from);
  if (filters.to) query = query.lte('checkin_date', filters.to);
  // Guest-name search needs the joined table filtered client-side below (Supabase can't
  // filter on an embedded relation's column directly in one query without a view/RPC).
  query = query.order('checkin_date', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  const ids = (data ?? []).map(b => b.id);
  const { data: pays } = ids.length
    ? await sb.from('payments').select('booking_id,amount').in('booking_id', ids)
    : { data: [] as { booking_id: string; amount: number }[] };
  const paysBy = new Map<string, number>();
  for (const p of pays ?? []) paysBy.set(p.booking_id, (paysBy.get(p.booking_id) ?? 0) + Number(p.amount));

  let rows: BookingListRow[] = (data ?? []).map(b => {
    const guest = b.guests as unknown as { name: string };
    const prop = b.properties as unknown as { name: string };
    const total = Number(b.total_amount);
    const received = paysBy.get(b.id) ?? 0;
    const summary = summarisePayments(total, [{ amount: received }]);
    return {
      id: b.id, guestName: guest?.name ?? 'Guest', propertyId: b.property_id, propertyName: prop?.name ?? '',
      checkinDate: b.checkin_date, checkoutDate: b.checkout_date, guestCount: b.guest_count,
      status: b.status, payment: summary,
    };
  });

  if (filters.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter(r => r.guestName.toLowerCase().includes(q) || r.propertyName.toLowerCase().includes(q));
  }

  return { rows, total: count ?? rows.length, page, pageSize: PAGE_SIZE };
}

export async function searchGuests(query: string): Promise<{ name: string; phone: string | null }[]> {
  if (!query.trim()) return [];
  const { sb } = await requireUser();
  const { data } = await sb.from('guests').select('name,phone')
    .ilike('name', `%${query.trim()}%`).limit(6);
  return data ?? [];
}

export async function listProperties() {
  const { sb } = await requireUser();
  const { data, error } = await sb.from('properties').select('id,name,status,capacity,checkin_time,checkout_time').order('name');
  if (error) throw error;
  return data;
}

/* ---------- property checklist template ---------- */
export interface ChecklistTemplateRow { id: string; category: string; label: string; required: boolean }

export async function listPropertyChecklist(propertyId: string): Promise<ChecklistTemplateRow[]> {
  const { sb } = await requireUser();
  const { data: tmpl } = await sb.from('checklist_templates').select('id').eq('property_id', propertyId).eq('kind', 'CHECKOUT').maybeSingle();
  if (!tmpl) return [];
  const { data, error } = await sb.from('checklist_items')
    .select('id,category,label,required').eq('template_id', tmpl.id).order('sort_order');
  if (error) throw error;
  return data;
}

/* ---------- reports ---------- */
export interface ReportsData {
  // Level 1 — business overview
  revenue: number; collected: number; outstanding: number; bookingsCount: number; occupancyPct: number;
  // Level 2/3 — secondary management KPIs
  avgBookingValue: number; avgStayNights: number; revenuePerOccupiedNight: number;
  paidPct: number; partialCount: number; pendingCount: number;
  checkinsCount: number; checkoutsCount: number; sameDayTurnovers: number;
  // Property performance
  perProperty: {
    propertyId: string; propertyName: string; bookings: number; occupiedNights: number;
    revenue: number; collected: number; outstanding: number; occupancyPct: number;
  }[];
  // Payment distribution (booking count per derived status, in-period)
  paymentDistribution: { PAID: number; PARTIAL: number; PENDING: number };
  // Inventory / reconciliation
  reconciliation: {
    completedStays: number; fullyReconciled: number; missingStays: number; damagedStays: number;
    missingQtyTotal: number; estimatedValue: number;
  };
  recentIssues: { propertyName: string; guestName: string; itemName: string; issue: 'Missing' | 'Damaged'; date: string; cost: number | null }[];
  // Two axis-aligned series (same buckets), for the revenue-vs-collected chart
  revenueSeries: { label: string; value: number }[];
  collectedSeries: { label: string; value: number }[];
  bucketGranularity: 'day' | 'month';
}

export async function loadReports(fromISO: string, toISO: string): Promise<ReportsData> {
  const { sb } = await requireUser();
  const [{ data: properties, error: propErr }, { data: periodBookings, error: pbErr }, { data: overlapping, error: obErr }] = await Promise.all([
    sb.from('properties').select('id,name,capacity'),
    // Revenue/financial KPIs attribute a stay to the period it checked in, matching the
    // existing convention already established for the Calendar's month stats.
    sb.from('bookings')
      .select('id,property_id,checkin_date,checkout_date,total_amount,status,guests(name),properties(name)')
      .neq('status', 'CANCELLED').gte('checkin_date', fromISO).lte('checkin_date', toISO)
      .order('checkin_date'),
    // Occupancy and check-in/checkout counts need every stay that TOUCHES the period, not
    // just ones that started in it — a stay that began before the period start still
    // occupies nights within it. This is a deliberate correction from the first Reports
    // build, which only ever looked at checkin-in-range bookings for occupancy too.
    sb.from('bookings')
      .select('id,property_id,checkin_date,checkout_date')
      .neq('status', 'CANCELLED').lte('checkin_date', toISO).gte('checkout_date', fromISO),
  ]);
  if (propErr) throw propErr;
  if (pbErr) throw pbErr;
  if (obErr) throw obErr;

  const ids = periodBookings.map(b => b.id);
  const [{ data: pays }, { data: invRows }] = await Promise.all([
    ids.length ? sb.from('payments').select('booking_id,amount').in('booking_id', ids) : Promise.resolve({ data: [] as { booking_id: string; amount: number }[] }),
    ids.length ? sb.from('booking_inventory').select('booking_id,expected_qty,given_qty,returned_qty,condition,notes,replacement_cost_override,inventory_items(name,replacement_cost)') : Promise.resolve({ data: [] as never[] }),
  ]);

  const paysByBooking = new Map<string, number>();
  for (const p of pays ?? []) paysByBooking.set(p.booking_id, (paysByBooking.get(p.booking_id) ?? 0) + Number(p.amount));

  interface InvDetail extends InventoryRow { itemName: string }
  const invByBooking = new Map<string, InvDetail[]>();
  for (const r of invRows ?? []) {
    const item = (r as { inventory_items: unknown }).inventory_items as unknown as { name: string; replacement_cost: number };
    const row: InvDetail = {
      itemName: item?.name ?? 'Item',
      expectedQty: r.expected_qty, givenQty: r.given_qty, returnedQty: r.returned_qty, condition: r.condition,
      replacementCost: Number(r.replacement_cost_override ?? item?.replacement_cost ?? 0),
    };
    const list = invByBooking.get(r.booking_id) ?? [];
    list.push(row);
    invByBooking.set(r.booking_id, list);
  }

  const revenue = Math.round(periodBookings.reduce((a, b) => a + Number(b.total_amount), 0));
  const collected = Math.round(periodBookings.reduce((a, b) => a + (paysByBooking.get(b.id) ?? 0), 0));
  const outstanding = Math.max(0, revenue - collected);
  const bookingsCount = periodBookings.length;

  const rangeDays = Math.max(1, differenceInCalendarDaysUTC(fromISO, toISO) + 1);
  const totalOccupiedNights = overlapping.reduce(
    (a, b) => a + occupiedNightsInRange(b.checkin_date, b.checkout_date, fromISO, toISO), 0,
  );
  const occupancyPct = occupancyPercent(totalOccupiedNights, properties.length, rangeDays);

  const totalStayNights = periodBookings.reduce((a, b) => a + Math.max(1, differenceInCalendarDaysUTC(b.checkin_date, b.checkout_date)), 0);
  const avgBookingValue = bookingsCount ? Math.round(revenue / bookingsCount) : 0;
  const avgStayNights = bookingsCount ? Math.round((totalStayNights / bookingsCount) * 10) / 10 : 0;
  const revenuePerOccupiedNight = totalOccupiedNights > 0 ? Math.round(revenue / totalOccupiedNights) : 0;

  const paymentDistribution = aggregatePaymentStatuses(
    periodBookings.map(b => ({ total: Number(b.total_amount), received: paysByBooking.get(b.id) ?? 0 })),
  );
  const paidPct = bookingsCount ? Math.round((paymentDistribution.PAID / bookingsCount) * 100) : 0;

  const checkinsCount = periodBookings.length; // already filtered to checkin within range
  const checkoutsCount = overlapping.filter(b => b.checkout_date >= fromISO && b.checkout_date <= toISO).length;
  const checkinKeys = new Set(overlapping.map(b => `${b.property_id}|${b.checkin_date}`));
  const sameDayTurnovers = overlapping.filter(b =>
    b.checkout_date >= fromISO && b.checkout_date <= toISO && checkinKeys.has(`${b.property_id}|${b.checkout_date}`),
  ).length;

  // Reconciliation summary + item-level issues, over checked-out stays within the period.
  let completedStays = 0, fullyReconciled = 0, missingStays = 0, damagedStays = 0, missingQtyTotal = 0, estimatedValue = 0;
  const recentIssues: ReportsData['recentIssues'] = [];
  for (const b of periodBookings) {
    if (b.status !== 'CHECKED_OUT') continue;
    const rows = invByBooking.get(b.id);
    if (!rows?.length) continue;
    completedStays++;
    const summary = reconcile(rows);
    if (summary.clean) { fullyReconciled++; continue; }
    if (summary.totalMissing > 0) missingStays++;
    if (summary.damagedRows > 0) damagedStays++;
    missingQtyTotal += summary.totalMissing;
    estimatedValue += summary.estimatedCost;

    const guest = b.guests as unknown as { name: string };
    const prop = b.properties as unknown as { name: string };
    for (const r of rows) {
      const missing = missingQty(r);
      if (missing > 0) recentIssues.push({ propertyName: prop?.name ?? '', guestName: guest?.name ?? 'Guest', itemName: r.itemName, issue: 'Missing', date: b.checkout_date, cost: r.replacementCost || null });
      if (r.condition === 'DAMAGED') recentIssues.push({ propertyName: prop?.name ?? '', guestName: guest?.name ?? 'Guest', itemName: r.itemName, issue: 'Damaged', date: b.checkout_date, cost: r.replacementCost || null });
    }
  }
  recentIssues.sort((a, b) => b.date.localeCompare(a.date));

  // Per-property performance, including occupancy — the one figure the original
  // per-property breakdown never had.
  const perPropMap = new Map<string, { propertyName: string; bookings: number; revenue: number; collected: number; occupiedNights: number }>();
  for (const p of properties) perPropMap.set(p.id, { propertyName: p.name, bookings: 0, revenue: 0, collected: 0, occupiedNights: 0 });
  for (const b of periodBookings) {
    const e = perPropMap.get(b.property_id); if (!e) continue;
    e.bookings += 1; e.revenue += Number(b.total_amount); e.collected += paysByBooking.get(b.id) ?? 0;
  }
  for (const b of overlapping) {
    const e = perPropMap.get(b.property_id); if (!e) continue;
    e.occupiedNights += occupiedNightsInRange(b.checkin_date, b.checkout_date, fromISO, toISO);
  }
  const perProperty = [...perPropMap.entries()].map(([propertyId, v]) => ({
    propertyId, propertyName: v.propertyName, bookings: v.bookings,
    occupiedNights: Math.round(v.occupiedNights), revenue: Math.round(v.revenue), collected: Math.round(v.collected),
    outstanding: Math.max(0, Math.round(v.revenue - v.collected)),
    occupancyPct: occupancyPercent(v.occupiedNights, 1, rangeDays),
  })).sort((a, b) => b.revenue - a.revenue);

  // Two axis-aligned series for revenue-vs-collected: "Today"/"This week" get daily buckets,
  // "This year" etc. get monthly, matching the brief's granularity table. True hourly
  // buckets for "Today" are not possible — bookings only carry a check-in DATE, no
  // time-of-day — so Today falls back to a single daily bucket rather than a fabricated one.
  const bucketGranularity: 'day' | 'month' = rangeDays <= 62 ? 'day' : 'month';
  const revBuckets = new Map<string, number>();
  const colBuckets = new Map<string, number>();
  for (const b of periodBookings) {
    const key = bucketGranularity === 'day' ? b.checkin_date : b.checkin_date.slice(0, 7);
    revBuckets.set(key, (revBuckets.get(key) ?? 0) + Number(b.total_amount));
    colBuckets.set(key, (colBuckets.get(key) ?? 0) + (paysByBooking.get(b.id) ?? 0));
  }
  const allKeys = [...new Set([...revBuckets.keys(), ...colBuckets.keys()])].sort();
  const revenueSeries = allKeys.map(label => ({ label, value: Math.round(revBuckets.get(label) ?? 0) }));
  const collectedSeries = allKeys.map(label => ({ label, value: Math.round(colBuckets.get(label) ?? 0) }));

  return {
    revenue, collected, outstanding, bookingsCount, occupancyPct,
    avgBookingValue, avgStayNights, revenuePerOccupiedNight, paidPct,
    partialCount: paymentDistribution.PARTIAL, pendingCount: paymentDistribution.PENDING,
    checkinsCount, checkoutsCount, sameDayTurnovers,
    perProperty, paymentDistribution,
    reconciliation: { completedStays, fullyReconciled, missingStays, damagedStays, missingQtyTotal, estimatedValue: Math.round(estimatedValue) },
    recentIssues: recentIssues.slice(0, 8),
    revenueSeries, collectedSeries, bucketGranularity,
  };
}

function differenceInCalendarDaysUTC(aISO: string, bISO: string): number {
  return Math.round((new Date(bISO).getTime() - new Date(aISO).getTime()) / 86_400_000);
}