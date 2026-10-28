# The Lab Cafe: Google Sheets edition

This version uses **Google Sheets + Apps Script** as shared storage, **Vercel Functions** for a thin private proxy, and the original **React/Vite** mobile interface. There is **no Google OAuth**, no Supabase, and no Calendar API access. Students reserve a spot and then choose to save a prefilled Google Calendar event.

- Thursday, October 29, 2026, 10 AM to 8 PM in Los Angeles (change the date for another event)
- Start times on the hour. Reservations are 1, 2, or 3 hours, never ending later than 8 PM.
- Maximum 10 simultaneous guests, across every hour of each visit. Apps Script uses `LockService` when confirming bookings, so parallel bookings cannot take the same last spot.
- Bookings remain in your personal Google Sheet; only the organizer can see the admin listing.

## 1. Create the sheet and Apps Script

1. Create a new Google Sheet named **The Lab Cafe Reservations**. In that sheet open **Extensions → Apps Script**.
2. Replace the starter `Code.gs` with the entire contents of [`google-apps-script/Code.gs`](google-apps-script/Code.gs). Save.
3. Open **Project Settings → Script properties**. Create **two** properties:
   - `EVENT_DATE` = `2026-10-29`
   - `API_TOKEN` = a long random secret, at least 32 characters. For example, generate one locally with `openssl rand -hex 32` and copy it here.
4. From the Apps Script editor run the `setup` function once and authorize it. This creates the `Reservations` tab.
5. Choose **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Click Deploy and approve authorization. Copy the **Web app URL ending in `/exec`**. A third-party visiting this URL directly will not have access to bookings without the private token. Keep the token secret.
6. **Whenever you change the Apps Script code**, use **Deploy → Manage deployments → Edit → New version → Deploy**. Saving alone does not update the live `/exec` web app.

> The web app must be deployed from the same Google account that owns or can edit the Sheet. If Google Workspace restricts public web-app deployments, try a personal Gmail account to own the sheet.

## 2. Set up Vercel

Your React app is still hosted on Vercel. Replace the previous project files in your GitHub repository with this project, then commit and push.

In **Vercel → Project → Settings → Environment Variables**, add:

| Key | Value |
| --- | --- |
| `SHEETS_WEB_APP_URL` | The Apps Script `/exec` URL |
| `SHEETS_API_TOKEN` | The exact secret from Apps Script's `API_TOKEN` property |
| `ADMIN_KEY` | A different long password for your private `/admin` page |
| `EVENT_DATE` | `2026-10-29` |

Then **redeploy** from Vercel's Deployments tab. These are server-only variables: do not prefix them `VITE_`, paste them into the React source, or commit a `.env` file.

For Vercel, the Framework Preset is **Vite**, Build Command **`npm run build`**, Output Directory **`dist`**. The `/api/*` files are Vercel functions. If a project already exists, update it through GitHub and redeploy rather than creating another site.

Check `https://YOUR-SITE.vercel.app/api/config` and confirm `"databaseConfigured":true`. Test a booking, then check your Google Sheet. The public QR is `https://YOUR-SITE.vercel.app/qr`, admin guest list is `https://YOUR-SITE.vercel.app/admin`.

## 3. Run on your Mac

Requires Node.js 20 or later:

```bash
cp .env.example .env
# Edit .env with your URL, tokens, admin password and event date
npm install
npm run dev
```

Open `http://localhost:5173`. The Google Sheet is shared by your local app and Vercel deployment, so testing locally creates real entries. `npm test` tests duration and schedule calculations. `npm run build` creates the optimized frontend.

## 4. Reservation and calendar behavior

Students enter a name and optional email, choose an hourly start and duration, and submit their booking. The Vercel backend validates the request and talks privately to Apps Script using the API token. Apps Script serializes writes and rejects bookings that would exceed 10 visitors in **any** occupied hour. Each booking is stored in one row and remains even after someone closes the browser. After confirmation, **Add to Google Calendar** opens a pre-filled event in the student's Google account; they must tap **Save**. The event is not created in your own calendar and changing or deleting that Google Calendar event will not change the reservation. Guests contact the organizer to cancel, and the organizer can cancel via `/admin`.

## 5. Important notes

- Google Sheets + Apps Script is suitable for a small one-day event with moderate traffic, not a high-volume reservation system. Apps Script quotas, execution limits and simultaneous request restrictions apply.
- Never share your `SHEETS_API_TOKEN` or `ADMIN_KEY`, and don't make the Google Sheet public. The web app must be accessible to anyone **because Vercel calls it**, but the API token is required for all operations.
- Public capacity/availability data can be viewed by visitors. Guest names and emails are only accessible through the password-protected admin endpoint.
- This project currently accepts bookings for **one configured date at a time**. Change `EVENT_DATE` in BOTH Apps Script properties and Vercel when changing the event date. Existing reservations remain in the Sheet.
- The confirmation screen displays the Google Calendar link only after booking is actually stored.
- Privacy and terms pages are included at `/privacy` and `/terms`. Review their wording before inviting the public.
- The QR code points to your Vercel URL. Do not distribute a localhost or laptop Wi-Fi QR code.

## 6. Where to find everything

- `src/main.jsx`: React mobile reservation screens, QR, admin, privacy, terms
- `src/styles.css`: design
- `api/*`: Vercel endpoints
- `server/sheets.mjs`: private bridge to Google Apps Script
- `google-apps-script/Code.gs`: Google Sheet backend, conflict and capacity enforcement
- `.env.example`: required environment variables
- `server/logic.mjs`: date and Google Calendar URL calculations
