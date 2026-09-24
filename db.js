// db.js — koneksi SQLite super simple buat pemula
// Kenapa file ini ada? Biar semua file lain tinggal require('./db') tanpa buka-tutup koneksi berkali-kali.

const Database = require('better-sqlite3');
const path = require('path');

// File DB bakal muncul di lab/leads.db (auto dibuat pas pertama jalan)
const dbPath = path.join(__dirname, 'leads.db');
const db = new Database(dbPath);

// Tabel leads — cuma kolom yang kepake, kolom 0% isi (City, Revenue, dll) kita skip biar hemat.
// user_email = pemilik baris (multi-user). Admin lihat semua, user biasa cuma miliknya.
db.exec(`
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  display_name TEXT,
  job_title TEXT,
  company TEXT,
  company_norm TEXT,
  email TEXT,
  email_norm TEXT,
  phone TEXT,
  phone_digits TEXT,
  country TEXT,
  lead_status TEXT,
  lifecycle TEXT,
  source_raw TEXT,
  owner TEXT,
  create_date TEXT,
  modified_date TEXT,
  notes TEXT,
  lead_score TEXT,
  channel TEXT,
  channel_detail TEXT,
  user_email TEXT
);
`);

// Auto-migrasi pola rumah (kayak backend auth): DB lama tanpa user_email ditambah otomatis.
const cols = db.prepare('PRAGMA table_info(leads)').all().map((c) => c.name);
if (!cols.includes('user_email')) {
  db.exec('ALTER TABLE leads ADD COLUMN user_email TEXT');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_leads_user ON leads(user_email)');

module.exports = db;
