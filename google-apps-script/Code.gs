/** The Lab Cafe booking data API, bound to a Google Spreadsheet.
 * Script properties: API_TOKEN, EVENT_DATE (YYYY-MM-DD, a Thursday).
 * Deploy as a Web app: Execute as Me, Who has access: Anyone.
 * The random API_TOKEN MUST NOT be shared publicly.
 */
const TAB = 'Reservations';
const HEADERS = ['id','event_date','start_hour','duration_hours','guest_name','guest_email','status','created_at'];
const CAPACITY = 10;
const OPEN = 10;
const CLOSE = 20;
const TZ = 'America/Los_Angeles';
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TAB) || ss.insertSheet(TAB);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, HEADERS.length);
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
  const values=sheet.getDataRange().getValues();
  if (values.length<2) return [];
  return values.slice(1).map((v,i)=>({row:i+2,id:String(v[0]),event_date:String(v[1]),start_hour:Number(v[2]),duration_hours:Number(v[3]),guest_name:String(v[4]),guest_email:String(v[5]||''),status:String(v[6]),created_at:String(v[7]||'')}));
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
    const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB);
    if(!sheet) throw new Error('Run setup() first to create the Reservations tab.');
    if(p.action==='list') {
      if(p.date!==date) return out('Wrong event date',400);
      return out(rows(sheet).filter(r=>r.event_date===date).map(visible));
    }
    if(p.action==='book') {
      validate(p,date);
      lock=LockService.getScriptLock();
      if(!lock.tryLock(18000)) return out('Booking system is busy. Please try again.',503);
      const all=rows(sheet).filter(r=>r.status==='confirmed'&&r.event_date===date);
      for(let h=p.startHour;h<p.startHour+p.durationHours;h++) {
        if(all.filter(r=>r.start_hour<=h&&r.start_hour+r.duration_hours>h).length>=CAPACITY)
          return out('That time just filled up. Please choose another.',409);
      }
      const id=Utilities.getUuid();
      sheet.appendRow([id,date,p.startHour,p.durationHours,p.name.trim(),String(p.email||'').toLowerCase(),'confirmed',new Date().toISOString()]);
      SpreadsheetApp.flush();
      return out({id:id});
    }
    if(p.action==='cancel') {
      lock=LockService.getScriptLock();
      if(!lock.tryLock(18000)) return out('Booking system busy.',503);
      const entry=rows(sheet).find(r=>r.id===p.id&&r.event_date===date);
      if(!entry||entry.status!=='confirmed') return out(false);
      sheet.getRange(entry.row,7).setValue('cancelled');
      SpreadsheetApp.flush();
      return out(true);
    }
    return out('Unknown action',400);
  } catch(err) { console.error(err); return out(String(err.message||err),400); }
  finally { if(lock) lock.releaseLock(); }
}
