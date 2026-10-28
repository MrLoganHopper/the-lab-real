export class ApiError extends Error {
  constructor(message, status=500, code='error') { super(message); this.status=status; this.code=code; }
}
export function isConfigured() { return Boolean(process.env.SHEETS_WEB_APP_URL && process.env.SHEETS_API_TOKEN); }
export async function sheetsRequest(action, params={}) {
  if (!isConfigured()) throw new ApiError('Google Sheets has not been connected yet. See README.',503,'not_configured');
  let response;
  try {
    response=await fetch(process.env.SHEETS_WEB_APP_URL, {
      method:'POST', redirect:'follow',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({token:process.env.SHEETS_API_TOKEN,action,...params}),
      signal:AbortSignal.timeout(20000)
    });
  } catch(e){ console.error('[Sheets network]',e); throw new ApiError('Could not reach the Google Sheet. Check your Apps Script deployment.',502,'sheets_connection'); }
  let result;
  try { result=await response.json(); } catch(e) { throw new ApiError('Google Apps Script did not return JSON. Check deployment access and URL.',502,'sheets_response'); }
  if (!result.ok) throw new ApiError(result.error || 'Sheet operation failed.',Number(result.status)||400,result.code||'sheets_error');
  return result.data;
}
export async function bookingsForDate(date) { return sheetsRequest('list',{date}); }
