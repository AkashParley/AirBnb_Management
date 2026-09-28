-- KEEYSTAY 0003: smallest possible addition for a real Check-in confirmation step.
-- Reason: bookings already has checkout_completed_at (set when checkout is confirmed)
-- but no equivalent for check-in, so there was no way to distinguish "template loaded,
-- still adjusting quantities" from "caretaker has confirmed the handover." One column,
-- no other changes, no data migration needed (existing rows simply have it null).
alter table bookings add column checkin_completed_at timestamptz;
