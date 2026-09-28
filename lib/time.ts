import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

export const TZ = 'Asia/Kolkata';
/** Combine a DB date ('2026-09-17') and time ('10:00:00') into an IST instant. */
export const istAt = (date: string, time: string) => new TZDate(`${date}T${time}`, TZ);
export const dayLabel = (d: Date) => format(d, 'EEE d MMM');
export const timeLabel = (d: Date) => format(d, 'HH:mm');
