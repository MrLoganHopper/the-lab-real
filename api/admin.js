import { dateForEvent, occupiedByHour, CAPACITY } from '../server/logic.mjs';
import { bookingsForDate } from '../server/sheets.mjs';
import { only, respond, requireAdmin } from '../server/http.mjs';

export default async function handler(req, res) {
  try {
    only(req, 'GET'); requireAdmin(req);
    res.setHeader('Cache-Control', 'no-store');
    const date = dateForEvent(process.env.EVENT_DATE);
    const bookings = await bookingsForDate(date);
    return res.status(200).json({ date, capacity: CAPACITY, hours: occupiedByHour(bookings), bookings: bookings.filter(b => b.status === 'confirmed') });
  } catch (err) { return respond(res, err); }
}
