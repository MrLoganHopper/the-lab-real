import { DateTime } from 'luxon';
import { bookingsForDate } from '../server/sheets.mjs';
import { occupiedByHour, dateForEvent, ZONE, CAPACITY, timeFor } from '../server/logic.mjs';
import { only, respond } from '../server/http.mjs';

export default async function handler(req, res) {
  try {
    only(req, 'GET');
    res.setHeader('Cache-Control', 'no-store');
    const date = dateForEvent(process.env.EVENT_DATE);
    const bookings = await bookingsForDate(date);
    const now = DateTime.now();
    const hours = occupiedByHour(bookings).map(h => ({ ...h, remaining: Math.max(0, CAPACITY - h.booked), past: timeFor(date, h.hour).toMillis() <= now.toMillis() }));
    return res.status(200).json({ date, zone: ZONE, capacity: CAPACITY, hours });
  } catch (err) { return respond(res, err); }
}
