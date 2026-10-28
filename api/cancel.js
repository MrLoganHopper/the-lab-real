import { ApiError, sheetsRequest } from '../server/sheets.mjs';
import { only, respond, requireAdmin } from '../server/http.mjs';

export default async function handler(req, res) {
  try {
    only(req, 'POST'); requireAdmin(req);
    const id = req.body?.id;
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id || '')) throw new ApiError('Invalid reservation ID.', 400, 'invalid');
    const result = await sheetsRequest('cancel', { id });
    return res.status(200).json({ cancelled: result === true });
  } catch (err) { return respond(res, err); }
}
