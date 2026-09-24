// load.js — baca CSV 2049 baris → masukin SQLite
// Cara jalanin: node load.js
// Kenapa dipisah dari server.js? Biar pola kebaca: load sekali, server tinggal baca DB (kayak Form -> store -> tampil).

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const db = require('./db');
const N = require('./normalize');
const { extractChannel } = require('./extract');

// Self-contained: prefer ./data/ (for zip submit), fallback to ../candidate_package/data/ (local dev)
const localCsv = path.join(__dirname, 'data', 'leads_seed.csv');
const fallbackCsv = path.join(__dirname, '..', 'candidate_package', 'data', 'leads_seed.csv');
const csvPath = fs.existsSync(localCsv) ? localCsv : fallbackCsv;
const raw = fs.readFileSync(csvPath, 'utf-8');
const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: false });

console.log(`CSV kebaca: ${rows.length} baris`);

db.exec('DELETE FROM leads'); // bersih dulu biar idempotent (jalan 2x tetap 2049, bukan dobel)

const insert = db.prepare(`
INSERT INTO leads (id, first_name, last_name, full_name, display_name, job_title, company, company_norm, email, email_norm, phone, phone_digits, country, lead_status, lifecycle, source_raw, owner, create_date, modified_date, notes, lead_score, channel, channel_detail)
VALUES (@id, @first_name, @last_name, @full_name, @display_name, @job_title, @company, @company_norm, @email, @email_norm, @phone, @phone_digits, @country, @lead_status, @lifecycle, @source_raw, @owner, @create_date, @modified_date, @notes, @lead_score, @channel, @channel_detail)
`);

let n = 0;
const tx = db.transaction((list) => {
  for (const r of list) {
    const notes = N.trim(r['Notes']);
    const ch = extractChannel(notes);
    insert.run({
      id: N.trim(r['Record ID']),
      first_name: N.trim(r['First Name']),
      last_name: N.trim(r['Last Name']),
      full_name: N.trim(r['Full Name']),
      display_name: N.displayName(r['First Name'], r['Last Name'], r['Full Name']),
      job_title: N.trim(r['Job Title']),
      company: N.trim(r['Company Name']),
      company_norm: N.normalizeCompany(r['Company Name']),
      email: N.trim(r['Email']),
      email_norm: N.normalizeEmail(r['Email']),
      phone: N.trim(r['Phone Number']),
      phone_digits: N.phoneDigits(r['Phone Number']),
      country: N.normalizeCountry(r['Country/Region']),
      lead_status: N.normalizeStatus(r['Lead Status']),
      lifecycle: N.trim(r['Lifecycle Stage']),
      source_raw: N.trim(r['Original Source']),
      owner: N.normalizeOwner(r['Contact Owner']),
      create_date: N.parseDate(r['Create Date']),
      modified_date: N.parseDate(r['Last Modified Date']),
      notes,
      lead_score: N.trim(r['Lead Score']),
      channel: ch.channel,
      channel_detail: ch.detail,
    });
    n++;
  }
});
tx(rows);

const count = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
console.log(`DB sekarang isi: ${count} leads`);
console.log('Contoh status unik:', db.prepare('SELECT DISTINCT lead_status FROM leads').all().map(x => x.lead_status));
