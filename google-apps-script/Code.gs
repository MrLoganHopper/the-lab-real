/** The Lab Cafe booking data API, bound to a Google Spreadsheet.
 * Script properties: API_TOKEN, EVENT_DATE (YYYY-MM-DD, a Thursday).
 * Deploy as a Web app: Execute as Me, Who has access: Anyone.
 * The random API_TOKEN MUST NOT be shared publicly.
 */
const TAB_CANDIDATES = ['Reservations', 'reservastions', 'reserved'];
const HEADERS = ['id', 'event_date', 'start_hour', 'duration_hours', 'guest_name', 'guest_email', 'status', 'created_at'];
const CAPACITY = 10;
const OPEN = 10;
const CLOSE = 20;
const TZ = 'America/Los_Angeles';

const FIELD_ALIASES = {
  id: ['id'],
  event_date: ['event_date', 'date', 'eventdate'],
  start_hour: ['start_hour', 'start', 'start_time', 'starthour'],
  duration_hours: ['duration_hours', 'duration', 'hours', 'durationhour'],
  guest_name: ['guest_name', 'name', 'guest'],
  guest_email: ['guest_email', 'email'],
  status: ['status', 'state'],
  created_at: ['created_at', 'created', 'timestamp']
};

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function activeStatus(status) {
  const value = normalizeKey(status);
  return value === 'confirmed' || value === 'active';
}

function resolveSheet(ss, createIfMissing) {
  const sheets = ss.getSheets();
  const matches = [];
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const sheetName = sheet.getName();
    const normalizedSheetName = normalizeKey(sheetName);
    for (let c = 0; c < TAB_CANDIDATES.length; c++) {
      const candidate = TAB_CANDIDATES[c];
      if (sheetName === candidate || normalizedSheetName === normalizeKey(candidate)) {
        matches.push({ sheet: sheet, priority: c, rows: sheet.getLastRow() });
        break;
      }
    }
  }
  if (matches.length > 0) {
    matches.sort((a, b) => {
      const aHasData = a.rows > 1 ? 1 : 0;
      const bHasData = b.rows > 1 ? 1 : 0;
      if (aHasData !== bHasData) return bHasData - aHasData;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.rows - a.rows;
    });
    return matches[0].sheet;
  }
  if (!createIfMissing) return null;
  return ss.insertSheet(TAB_CANDIDATES[0]);
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow(HEADERS);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, HEADERS.length);
}

function getColumnMap(sheet) {
  const defaultMap = {
    id: 1,
    event_date: 2,
    start_hour: 3,
    duration_hours: 4,
    guest_name: 5,
    guest_email: 6,
    status: 7,
    created_at: 8
  };

  const lastCol = Math.max(sheet.getLastColumn(), HEADERS.length);
  const headerValues = (sheet.getRange(1, 1, 1, lastCol).getValues()[0] || []).map(normalizeKey);
  const map = { ...defaultMap };

  Object.keys(FIELD_ALIASES).forEach((field) => {
    const aliases = FIELD_ALIASES[field].map(normalizeKey);
    for (let i = 0; i < headerValues.length; i++) {
      if (aliases.includes(headerValues[i])) {
        map[field] = i + 1;
        return;
      }
    }
  });

  return { map, lastCol };
}

function cellAt(rowValues, oneBasedColumn) {
  return rowValues[oneBasedColumn - 1];
}

function toIsoDate(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, TZ, 'yyyy-MM-dd');
  }
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, TZ, 'yyyy-MM-dd');
  }
  return text;
}

function rowToRecord(values, rowNumber, map) {
  return {
    row: rowNumber,
    id: String(cellAt(values, map.id) || ''),
    event_date: toIsoDate(cellAt(values, map.event_date)),
    start_hour: Number(cellAt(values, map.start_hour)),
    duration_hours: Number(cellAt(values, map.duration_hours)),
    guest_name: String(cellAt(values, map.guest_name) || ''),
    guest_email: String(cellAt(values, map.guest_email) || ''),
    status: String(cellAt(values, map.status) || ''),
    created_at: String(cellAt(values, map.created_at) || '')
  };
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = resolveSheet(ss, true);
  ensureHeaders(sheet);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, Math.max(sheet.getLastColumn(), HEADERS.length));
  return 'Ready: ' + ss.getUrl();
}
function out(data, status) {
  return ContentService.createTextOutput(JSON.stringify(status ? {ok:false, error:data, status:status} : {ok:true,data:data}))
    .setMimeType(ContentService.MimeType.JSON);
}
function requiredDate() {
  const date=PropertiesService.getScriptProperties().getProperty('EVENT_DATE');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('Set EVENT_DATE script property to YYYY-MM-DD');
  const d = new Date(date+'T12:00:00Z');
  if (isNaN(d.getTime()) || d.toISOString().slice(0,10)!==date || d.getUTCDay()!==4) throw new Error('EVENT_DATE must be a Thursday');
  return date;
}
function rows(sheet) {
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length < 2) return [];
  const info = getColumnMap(sheet);
  return values.slice(1).map((v, i) => rowToRecord(v, i + 2, info.map));
}
function visible(row) { const {row:sheetRow,...rest}=row; return rest; }
function validate(p,date) {
  if(p.date!==date) throw new Error('Wrong event date');
  if(!Number.isInteger(p.startHour)||p.startHour<OPEN||p.startHour>=CLOSE || ![1,2,3].includes(p.durationHours)||p.startHour+p.durationHours>CLOSE) throw new Error('Choose a 1-, 2-, or 3-hour visit ending by 8 PM.');
  if(typeof p.name!=='string'||p.name.trim().length<2||p.name.trim().length>100) throw new Error('Enter a name (2-100 characters).');
  if(p.email && (typeof p.email!=='string'||p.email.length>200||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))) throw new Error('Invalid email address.');
  const nowDay=Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const nowHour=Number(Utilities.formatDate(new Date(), TZ, 'H'));
  if(date<nowDay||(date===nowDay&&p.startHour<=nowHour)) throw new Error('This start time has already passed.');
}
function doPost(e) {
  let lock;
  try {
    const p=JSON.parse((e.postData && e.postData.contents)||'{}');
    const secret=PropertiesService.getScriptProperties().getProperty('API_TOKEN');
    if(!secret||p.token!==secret) return out('Unauthorized',403);
    const date=requiredDate();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = resolveSheet(ss, false);
    if(!sheet) throw new Error('Run setup() first to create a reservation tab (reserved or Reservations).');
    if(p.action==='list') {
      if(p.date!==date) return out('Wrong event date',400);
      return out(rows(sheet).filter(r=>r.event_date===date).map(visible));
    }
    if(p.action==='book') {
      validate(p,date);
      lock=LockService.getScriptLock();
      if(!lock.tryLock(18000)) return out('Booking system is busy. Please try again.',503);
      const all=rows(sheet).filter(r=>activeStatus(r.status)&&r.event_date===date);
      for(let h=p.startHour;h<p.startHour+p.durationHours;h++) {
        if(all.filter(r=>r.start_hour<=h&&r.start_hour+r.duration_hours>h).length>=CAPACITY)
          return out('That time just filled up. Please choose another.',409);
      }
      const id=Utilities.getUuid();
      const info = getColumnMap(sheet);
      const width = Math.max(sheet.getLastColumn(), info.lastCol, HEADERS.length);
      const newRow = new Array(width).fill('');
      newRow[info.map.id - 1] = id;
      newRow[info.map.event_date - 1] = date;
      newRow[info.map.start_hour - 1] = p.startHour;
      newRow[info.map.duration_hours - 1] = p.durationHours;
      newRow[info.map.guest_name - 1] = p.name.trim();
      newRow[info.map.guest_email - 1] = String(p.email || '').toLowerCase();
      newRow[info.map.status - 1] = 'confirmed';
      newRow[info.map.created_at - 1] = new Date().toISOString();
      sheet.appendRow(newRow);
      SpreadsheetApp.flush();
      return out({id:id});
    }
    if(p.action==='cancel') {
      lock=LockService.getScriptLock();
      if(!lock.tryLock(18000)) return out('Booking system busy.',503);
      const entry=rows(sheet).find(r=>r.id===p.id&&r.event_date===date);
      if(!entry||!activeStatus(entry.status)) return out(false);
      const info = getColumnMap(sheet);
      sheet.getRange(entry.row, info.map.status).setValue('cancelled');
      SpreadsheetApp.flush();
      return out(true);
    }
    return out('Unknown action',400);
  } catch(err) { console.error(err); return out(String(err.message||err),400); }
  finally { if(lock) lock.releaseLock(); }
}
