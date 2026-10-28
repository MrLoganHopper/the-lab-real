import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QRCodeSVG } from 'qrcode.react';
import { DateTime } from 'luxon';
import './styles.css';

const ZONE = 'America/Los_Angeles';
const SUPPORT_EMAIL = 'maialuciarocha@gmail.com';

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { cache:'no-store', ...options, headers: { ...(options.body !== undefined ? {'Content-Type':'application/json'} : {}), ...options.headers } });
  } catch (_) {
    throw new Error('Could not reach the reservation server. Check the connection and try again.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

function labelHour(h) { return `${h === 12 ? 12 : h > 12 ? h - 12 : h} ${h < 12 ? 'AM' : 'PM'}`; }
function timeRange(hour, duration) { return `${labelHour(hour)} - ${labelHour(hour + duration)}`; }
function dateLabel(date) { return DateTime.fromISO(date, {zone:ZONE}).toFormat('cccc, LLLL d'); }
function LabGlyph(){return <svg viewBox="0 0 130 115" className="lab-glyph" aria-hidden="true"><path d="M17 20L39 20 45 45 17 38Z" fill="currentColor"/><path d="M16 81L72 81 72 97 16 96Z" fill="currentColor"/><path d="M65 20L80 12 113 94 94 94Z" fill="currentColor"/></svg>}
function Brand(){return <div className="brand" aria-label="The Lab Cafe">LΛB</div>}
function Notice({message,onDismiss}) { if(!message)return null; return <div className="notice" role="alert"><span>{message}</span>{onDismiss&&<button aria-label="Dismiss" onClick={onDismiss}>×</button>}</div>; }
function Footer(){return <footer className="site-footer"><span>cardinal gardens · usc</span><div><a href="/privacy">privacy</a> · <a href="/terms">terms</a> · <a href="mailto:maialuciarocha@gmail.com">contact</a></div></footer>}
function Shell({children,styleName=''}){return <div className={`app-shell ${styleName}`}>{children}<Footer/></div>}

function Welcome({config,onStart,error}){
  return <Shell styleName="welcome-screen">
    <Brand/>
    <div className="hero-script hero-welcome"><span>Find</span><strong>Availability</strong></div>
    <button className="portal-card" onClick={onStart} aria-label="Find a time at The Lab Cafe">
      <div className="portal-graphic" aria-hidden="true"><span/><span/><span/></div>
      <span className="portal-label">TAP TO FIND A SEAT ↗</span>
    </button>
    <div className="subportal"><span>{config?.date ? dateLabel(config.date) : 'Thursday'}</span><span>10 AM - 8 PM</span></div>
    <p className="welcome-description">1-3 hour visits · 10 seats at a time<br/>no account needed</p>
    {!config?.databaseConfigured && <Notice message="Reservations aren't connected yet. Add the Google Sheets environment variables to activate bookings."/>}
    <Notice message={error}/>
  </Shell>;
}

function StartOptions({selected,config,onClose,onBook,working}) {
  const [duration,setDuration]=useState(1);
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [error,setError]=useState('');
  if (!selected) return null;
  const choices = [1,2,3].map(d=>{
    const target = config.hours.filter(h=>h.hour>=selected.hour && h.hour<selected.hour+d);
    const allowed = selected.hour + d <= 20 && target.length === d && target.every(h=>!h.past && h.remaining>0);
    return { duration:d, allowed, remaining: Math.min(...target.map(h=>h.remaining)) };
  });
  async function submit(event){
    event.preventDefault(); setError('');
    if(!choices.find(o=>o.duration===duration)?.allowed){setError('This duration is unavailable. Please choose another.');return;}
    try {await onBook({ startHour:selected.hour,durationHours:duration,name,email });}
    catch(e){setError(e.message);}
  }
  return <div className="sheet-backdrop" onClick={e=>{if(e.target===e.currentTarget && !working)onClose()}}>
    <section className="booking-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div className="sheet-grip"/>
      <div className="sheet-head"><div><div className="eyebrow">THE LAB CAFE</div><h2 id="sheet-title" className="script-heading">Stay awhile.</h2></div><button className="close-btn" onClick={onClose} disabled={working} aria-label="Close">×</button></div>
      <div className="chosen-time">{dateLabel(config.date)}<strong>{labelHour(selected.hour)} start</strong></div>
      <form onSubmit={submit}>
        <label className="form-caption">HOW LONG WOULD YOU LIKE TO STAY?</label>
        <div className="duration-choice">{choices.map(opt=><button type="button" key={opt.duration} className={duration===opt.duration?'active':''} disabled={!opt.allowed || working} onClick={()=>setDuration(opt.duration)}><strong>{opt.duration}</strong><span>{opt.duration===1?'hour':'hours'}</span></button>)}</div>
        <p className="ending">{timeRange(selected.hour,duration)} · {choices.find(o=>o.duration===duration)?.remaining ?? 0} seats open throughout your visit</p>
        <label className="form-caption" htmlFor="guest-name">YOUR NAME</label><input className="form-input" id="guest-name" autoComplete="name" maxLength={100} minLength={2} placeholder="First and last name" required value={name} onChange={e=>setName(e.target.value)}/>
        <label className="form-caption" htmlFor="guest-email">EMAIL <span>(optional)</span></label><input className="form-input" id="guest-email" autoComplete="email" maxLength={200} type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/>
        <label className="trap" aria-hidden="true">Website <input type="text" tabIndex="-1" autoComplete="off" name="website"/></label>
        <Notice message={error} onDismiss={()=>setError('')}/>
        <button className="primary-button" disabled={working}>{working?'Reserving your seat...':'Reserve this time ↗'}</button>
        <p className="booking-fineprint">Your spot is reserved when you tap this button. You can then add the visit to Google Calendar.</p>
      </form>
    </section>
  </div>
}

function Schedule({data,onBack,onRefresh,onBook,working,error,clearError}) {
  const [selected,setSelected]=useState(null);
  const allFull=data.hours.every(x=>x.past||x.booked>=data.capacity);
  return <Shell styleName="schedule-screen">
    <header className="schedule-header"><button aria-label="Back" onClick={onBack} className="header-action">‹</button><div><Brand/><div className="subtitle-script">pick a time</div></div><button aria-label="Refresh available seats" title="Refresh seats" className="header-action refresh" onClick={onRefresh}>↻</button></header>
    <div className="schedule-meta"><span>{dateLabel(data.date)}</span><span>{data.capacity} seats · hourly starts</span></div>
    <Notice message={error} onDismiss={clearError}/>
    {allFull && <p className="full-label">All remaining hours are full or have passed.</p>}
    <div className="timeline">
      <div className="times-rail">{data.hours.map((hour,i)=><div key={hour.hour} className="times-number" style={{top: i*62+8}}>{hour.hour > 12 ? hour.hour-12 : hour.hour}</div>)}<div className="times-number" style={{top:10*62+4}}>8</div></div>
      <div className="hours-stack">{data.hours.map((hour,i)=>{
        const disabled=hour.past||hour.remaining===0;
        return <button className={`hour-block ${disabled?'hour-unavailable':(['hour-red','hour-blue','hour-green'][i%3])}`} key={hour.hour} disabled={disabled} onClick={()=>setSelected(hour)}>
          <div><span className="hour-label">{labelHour(hour.hour)} - {labelHour(hour.hour+1)}</span><span className="hour-remaining">{hour.past?'past':hour.remaining===0?'fully booked':`${hour.remaining} / 10 seats open`}</span></div>
          {!disabled && <span aria-hidden="true" className="hour-arrow">↗</span>}
        </button>;
      })}</div>
    </div>
    <p className="schedule-instructions">Tap an available hour, then choose a 1-, 2-, or 3-hour stay. Each hour must have capacity.</p>
    {selected && <StartOptions key={selected.hour} selected={selected} config={data} onClose={()=>setSelected(null)} working={working} onBook={onBook}/>}
  </Shell>;
}

function Confirmation({booking,onAnother}) {
  return <Shell styleName="confirmation-screen">
    <Brand/>
    <h1 className="hero-script hero-confirm"><span>See you</span><strong>Soon!</strong></h1>
    <div className="confirm-card"><LabGlyph/></div>
    <p className="booking-confirm">SEAT RESERVED <span className="checkmark">✓</span></p>
    <div className="confirmation-details"><strong>{dateLabel(booking.date)}</strong><span>{timeRange(booking.startHour,booking.durationHours)}</span><span>Cardinal Gardens, USC</span></div>
    <a className="primary-button calendar-button" href={booking.calendarUrl} target="_blank" rel="noopener noreferrer">Add to Google Calendar ↗</a>
    <p className="booking-fineprint after-confirm">A new Google Calendar page opens. Tap <strong>Save</strong> there to add the event. Your seat is already reserved.</p>
    <button className="text-button" onClick={onAnother}>View available times ↗</button>
  </Shell>;
}

function QRPage() {
  const [url,setUrl]=useState(window.location.origin);
  const isLocal=['localhost','127.0.0.1'].includes(window.location.hostname);
  return <div className="utility-page"><div className="utility-head"><Brand/><a href="/">← reservation app</a></div><h1 className="script-heading utility-title">Scan to reserve.</h1>
    <div className="qr-square"><QRCodeSVG value={url || window.location.origin} size={245} marginSize={2}/></div>
    <p>Place this QR code at the cafe so students can book on their phones.</p>
    <label className="form-caption" htmlFor="qr-destination">QR DESTINATION</label><input className="form-input" id="qr-destination" value={url} onChange={e=>setUrl(e.target.value)} spellCheck="false"/>
    {isLocal && <p className="quiet-info">Your computer's localhost URL won't open on other phones. Open /qr on your deployed Vercel site for a public QR code.</p>}
    <div className="utility-buttons"><button onClick={()=>navigator.clipboard?.writeText(url)}>Copy link</button><button onClick={()=>window.print()}>Print QR</button></div>
    <Footer/>
  </div>;
}

function AdminPage(){
  const [key,setKey]=useState(''); const [data,setData]=useState(null); const [error,setError]=useState(''); const [working,setWorking]=useState(false);
  async function load(e){e?.preventDefault();setWorking(true);setError('');try{setData(await request('/api/admin',{headers:{'x-admin-key':key}}));}catch(e){setError(e.message)}finally{setWorking(false)}}
  async function cancel(id){if(!window.confirm('Cancel this guest reservation and free the occupied hours?'))return;setWorking(true);setError('');try{await request('/api/cancel',{method:'POST',headers:{'x-admin-key':key},body:JSON.stringify({id})});await load();}catch(e){setError(e.message)}finally{setWorking(false)}}
  return <div className="utility-page"><div className="utility-head"><Brand/><a href="/">← reservation app</a></div><h1 className="script-heading utility-title">Guest list.</h1>
    <form onSubmit={load}><label className="form-caption" htmlFor="admin-key">ADMIN PASSWORD</label><input required type="password" className="form-input" id="admin-key" value={key} onChange={e=>setKey(e.target.value)}/><button className="primary-button" disabled={working}>{working?'Loading...':'View reservations'}</button></form><Notice message={error}/>
    {data&&<><h2>{data.bookings.length} guests · {dateLabel(data.date)}</h2><div className="admin-counts">{data.hours.map(h=><div className="count-row" key={h.hour}><span>{labelHour(h.hour)}</span><div><div style={{width:`${h.booked/10*100}%`}}/></div><span>{h.booked}/10</span></div>)}</div>
      <h2>Who's coming</h2>{data.bookings.length===0&&<p>No reservations yet.</p>}{data.bookings.map(b=><div className="guest-row" key={b.id}><div><strong>{b.guest_name}</strong><small>{b.guest_email||'No email'}</small><small>{timeRange(b.start_hour,b.duration_hours)}</small></div><button disabled={working} onClick={()=>cancel(b.id)}>Cancel</button></div>)}
    </>}
    <Footer/>
  </div>;
}

function LegalPage({type}){
  const privacy=type==='privacy';
  return <div className="utility-page legal-page"><div className="utility-head"><Brand/><a href="/">← reservation app</a></div><h1>{privacy?'Privacy Policy':'Terms of Service'}</h1><p className="updated">Effective October 27, 2026</p>
    {privacy?<>
      <h2>Who operates this site</h2><p>The Lab Cafe, a small event at Cardinal Gardens, USC. For privacy questions or deletion requests, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
      <h2>Information collected</h2><p>When you reserve, we collect your name, selected date, start time, visit duration, and optionally your email address. Technical hosting services may process standard connection information such as IP addresses in service logs.</p>
      <h2>How the information is used</h2><p>We use reservation details to manage attendance, prevent more than 10 overlapping guests, assist with cancellations, and operate the event. Reservation details are hosted using Vercel and Google Sheets (Apps Script). Your information is available to the event organizer through a password-protected admin page.</p>
      <h2>Google Calendar</h2><p>Our site generates a prefilled Google Calendar link after a reservation. We do not request permission to view your Google Calendar or access your Google account. If you choose to open and save the calendar event, Google's own privacy policy applies.</p>
      <h2>Deletion and retention</h2><p>The organizer retains reservations until they are no longer needed to run or administer the event, and can delete them from the database. To request deletion of your booking information, email the address above with the name and time on your reservation.</p>
      <h2>Changes</h2><p>We may update this policy as the event changes. Updates will be posted on this page.</p>
    </>:<>
      <h2>Reservations</h2><p>Reservations are for The Lab Cafe at Cardinal Gardens, USC, for the date shown in the booking app. Available start times are hourly from 10 AM to 7 PM. You can book a 1-, 2-, or 3-hour visit that ends by 8 PM.</p>
      <h2>Capacity</h2><p>Each one-hour period can hold a maximum of 10 simultaneous reservations. A time is available only while capacity remains across your whole selected visit. Reservations are first-come, first-served.</p>
      <h2>Confirmations and calendars</h2><p>Your reservation is created when the website displays its confirmation. Adding an event to your personal calendar is optional and does not change your reservation. We cannot access or monitor the events on your personal calendar.</p>
      <h2>Cancellations</h2><p>To cancel a reservation, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your name and reservation time. The organizer can remove your reservation and reopen the space.</p>
      <h2>Changes or cancellation of the event</h2><p>The event organizer may need to adjust or cancel cafe operations. Contact us using the email above for any questions or problems.</p>
    </>}
    <Footer/>
  </div>;
}

function App(){
  const [config,setConfig]=useState(null);
  const [availability,setAvailability]=useState(null);
  const [page,setPage]=useState('welcome');
  const [booking,setBooking]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    request('/api/config').then(setConfig).catch(e=>setError(e.message));
    try { const stored=sessionStorage.getItem('lab-latest-booking'); if(stored){ const obj=JSON.parse(stored); if(obj.date&&obj.calendarUrl){setBooking(obj);setPage('confirmation')} } } catch(_){}
  },[]);
  async function refresh(){
    setLoading(true);setError('');
    try{const slots=await request('/api/availability');setAvailability(slots);setPage('schedule');}
    catch(e){setError(e.message);}
    finally{setLoading(false)}
  }
  async function reserve(input){
    setLoading(true);setError('');
    try {
      const data=await request('/api/book',{method:'POST',body:JSON.stringify({...input,date:availability.date})});
      setBooking(data.booking);sessionStorage.setItem('lab-latest-booking', JSON.stringify(data.booking));setPage('confirmation');
    } catch(e){setError(e.message);await refresh().catch(()=>{});throw e;}
    finally{setLoading(false)}
  }
  const path=window.location.pathname;
  if(path==='/qr')return <QRPage/>;
  if(path==='/admin')return <AdminPage/>;
  if(path==='/privacy')return <LegalPage type="privacy"/>;
  if(path==='/terms')return <LegalPage type="terms"/>;
  if(page==='confirmation'&&booking)return <Confirmation booking={booking} onAnother={()=>{sessionStorage.removeItem('lab-latest-booking');refresh()}}/>;
  if(page==='schedule'&&availability)return <Schedule data={availability} onBack={()=>setPage('welcome')} onRefresh={refresh} onBook={reserve} working={loading} error={error} clearError={()=>setError('')}/>;
  return <Welcome config={config} onStart={refresh} error={error}/>;
}

createRoot(document.getElementById('root')).render(<App/>);
