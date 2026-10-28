import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { dateForEvent, validateBooking, occupiedByHour, canReserve, googleCalendarUrl } from './logic.mjs';

const NOW = DateTime.fromISO('2026-10-27T17:00:00', { zone: 'America/Los_Angeles' });
test('fixed event date is a Thursday, invalid dates rejected', () => {
  assert.equal(dateForEvent('2026-10-29'), '2026-10-29');
  assert.throws(() => dateForEvent('2026-10-30'), /Thursday/);
});
test('respects hourly starts, 1-3 hour stays and closing time', () => {
  assert.equal(validateBooking({ date:'2026-10-29', startHour:17, durationHours:3,name:'Test Guest' },NOW).durationHours, 3);
  for (const [startHour,durationHours] of [[19,2],[18,3],[10,0],[10,4],[10.5,1]]) {
    assert.throws(() => validateBooking({date:'2026-10-29',startHour,durationHours,name:'Test Guest'},NOW));
  }
});
test('checks every hour of overlapping reservations',()=>{
  const bookings = Array.from({length:10},(_,i)=>({status:'confirmed', start_hour:12, duration_hours:3, id:i}));
  const counts=occupiedByHour([...bookings,{ status:'cancelled',start_hour:12,duration_hours:3 }]);
  assert.equal(counts.find(x=>x.hour===11).booked,0);
  assert.equal(counts.find(x=>x.hour===12).booked,10);
  assert.equal(counts.find(x=>x.hour===14).booked,10);
  assert.equal(counts.find(x=>x.hour===15).booked,0);
  assert.equal(canReserve(counts,11,1),true);
  assert.equal(canReserve(counts,11,2),false);
  assert.equal(canReserve(counts,14,2),false);
  assert.equal(canReserve(counts,15,3),true);
});
test('counts active reservations as occupied capacity',()=>{
  const counts = occupiedByHour([
    { status:'active', start_hour:13, duration_hours:2 },
    { status:'confirmed', start_hour:14, duration_hours:1 },
    { status:'cancelled', start_hour:13, duration_hours:2 }
  ]);
  assert.equal(counts.find(x=>x.hour===13).booked,1);
  assert.equal(counts.find(x=>x.hour===14).booked,2);
  assert.equal(counts.find(x=>x.hour===15).booked,0);
});
test('Google Calendar URL encodes daylight saving Pacific time',()=>{
  const url=new URL(googleCalendarUrl('2026-10-29',14,2));
  assert.equal(url.hostname,'calendar.google.com');
  assert.equal(url.searchParams.get('dates'),'20261029T210000Z/20261029T230000Z');
  assert.equal(url.searchParams.get('text'),'The Lab Cafe');
  assert.equal(url.searchParams.get('ctz'),'America/Los_Angeles');
});
