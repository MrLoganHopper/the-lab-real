import { DateTime } from 'luxon';
import { dateForEvent, validateBooking, CAPACITY, googleCalendarUrl, ZONE } from '../server/logic.mjs';
import { ApiError, sheetsRequest } from '../server/sheets.mjs';
import { only, respond } from '../server/http.mjs';

export default async function handler(req, res) {
  try {
    only(req, 'POST');
    res.setHeader('Cache-Control', 'no-store');
    if (JSON.stringify(req.body || {}).length > 1500) throw new ApiError('Request too large.', 413, 'too_large');
    if (req.body?.website) throw new ApiError('Reservation request rejected.', 400, 'invalid');
    const date = dateForEvent(process.env.EVENT_DATE);
    if (req.body?.date !== date) throw new ApiError('This cafe date is no longer accepting reservations.', 400, 'wrong_date');
    let input;
    try { input = validateBooking({ date, startHour: req.body?.startHour, durationHours: req.body?.durationHours, name: req.body?.name, email: req.body?.email }, DateTime.now()); }
    catch (e) { throw new ApiError(e.message, 400, 'validation'); }
    const data = await sheetsRequest('book', { date, startHour:input.startHour, durationHours:input.durationHours, name:input.name, email:input.email || '' });
    const booking = { id: data.id, date, startHour: input.startHour, durationHours: input.durationHours, name: input.name, calendarUrl: googleCalendarUrl(date, input.startHour, input.durationHours), zone: ZONE, location: 'Cardinal Gardens, USC' };
    return res.status(201).json({ booking });
  } catch (err) { return respond(res, err); }
}
