import { DateTime } from 'luxon';

export const ZONE = 'America/Los_Angeles';
export const CAPACITY = 10;
export const OPEN_HOUR = 10;
export const CLOSE_HOUR = 20;
export const VALID_DURATIONS = [1, 2, 3];

export function dateForEvent(fixedDate = '', now = DateTime.now()) {
  if (fixedDate) {
    const requested = DateTime.fromISO(fixedDate, { zone: ZONE });
    if (!requested.isValid || requested.toISODate() !== fixedDate || requested.weekday !== 4) {
      throw new Error('EVENT_DATE must be an actual Thursday formatted YYYY-MM-DD.');
    }
    return fixedDate;
  }
  let day = now.setZone(ZONE);
  const delta = (4 - day.weekday + 7) % 7;
  day = day.plus({ days: delta });
  if (delta === 0 && day.hour >= CLOSE_HOUR - 1) day = day.plus({ weeks: 1 });
  return day.toISODate();
}

export function timeFor(date, hour) {
  return DateTime.fromISO(`${date}T${String(hour).padStart(2, '0')}:00`, { zone: ZONE });
}

export function validateBooking({ date, startHour, durationHours, name, email }, now = DateTime.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || dateForEvent(date) !== date) throw new Error('Invalid reservation date.');
  if (!Number.isInteger(startHour) || startHour < OPEN_HOUR || startHour >= CLOSE_HOUR) throw new Error('Choose an hourly start between 10 AM and 7 PM.');
  if (!VALID_DURATIONS.includes(durationHours) || startHour + durationHours > CLOSE_HOUR) throw new Error('Choose a 1-, 2-, or 3-hour visit ending by 8 PM.');
  if (timeFor(date, startHour).toMillis() <= now.toMillis()) throw new Error('That start time has already passed.');
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) throw new Error('Enter your name (2 to 100 characters).');
  if (email != null && email !== '' && (typeof email !== 'string' || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Enter a valid email or leave it blank.');
  return { date, startHour, durationHours, name: name.trim(), email: typeof email === 'string' ? email.trim().toLowerCase() : '' };
}

export function occupiedByHour(bookings = []) {
  const hours = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => ({ hour: OPEN_HOUR + i, booked: 0 }));
  for (const b of bookings) {
    if (b.status !== 'confirmed') continue;
    for (let h = b.start_hour; h < b.start_hour + b.duration_hours; h++) {
      if (h >= OPEN_HOUR && h < CLOSE_HOUR) hours[h - OPEN_HOUR].booked += 1;
    }
  }
  return hours;
}

export function canReserve(hours, startHour, durationHours, capacity = CAPACITY) {
  if (!VALID_DURATIONS.includes(durationHours) || startHour + durationHours > CLOSE_HOUR || startHour < OPEN_HOUR) return false;
  return Array.from({ length: durationHours }, (_, i) => hours.find(h => h.hour === startHour + i))
    .every(h => h && h.booked < capacity);
}

export function googleCalendarUrl(date, startHour, durationHours) {
  const start = timeFor(date, startHour).toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
  const end = timeFor(date, startHour + durationHours).toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'The Lab Cafe',
    dates: `${start}/${end}`,
    ctz: ZONE,
    location: 'Cardinal Gardens, USC, Los Angeles, CA',
    details: 'Your reserved visit to The Lab Cafe at Cardinal Gardens, USC. Booking is managed by The Lab Cafe website.'
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
