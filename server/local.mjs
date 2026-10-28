import 'dotenv/config';
import express from 'express';
import { existsSync } from 'node:fs';
import config from '../api/config.js';
import availability from '../api/availability.js';
import book from '../api/book.js';
import admin from '../api/admin.js';
import cancel from '../api/cancel.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({limit:'4kb'}));
app.all('/api/config', config);
app.all('/api/availability', availability);
app.all('/api/book', book);
app.all('/api/admin', admin);
app.all('/api/cancel', cancel);
if (existsSync('dist/index.html')) {
  app.use(express.static('dist'));
  app.get(['/', '/qr', '/admin', '/privacy', '/terms'], (_,res)=>res.sendFile('index.html',{root:'dist'}));
}
const port = Number(process.env.PORT || 3001);
app.listen(port, '0.0.0.0', () => console.log(`The Lab booking API: http://localhost:${port} (Google Sheets: ${process.env.SHEETS_WEB_APP_URL && process.env.SHEETS_API_TOKEN ? 'configured' : 'not configured'})`));
