import { dateForEvent, ZONE, CAPACITY, OPEN_HOUR, CLOSE_HOUR } from '../server/logic.mjs';
import { isConfigured } from '../server/sheets.mjs';
import { only, respond } from '../server/http.mjs';

export default async function handler(req, res) {
  try {
    only(req, 'GET');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ date: dateForEvent(process.env.EVENT_DATE), zone: ZONE, capacity: CAPACITY, openHour: OPEN_HOUR, closeHour: CLOSE_HOUR, durations: [1,2,3], databaseConfigured: isConfigured() });
  } catch (err) { return respond(res, err); }
}
