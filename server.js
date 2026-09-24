// server.js — rumah API kita, port 7003
// Fase 0: hello world dulu. Fase 1 nanti baru colok DB + endpoint leads.

const express = require('express');
const cors = require('cors');
const db = require('./db');
const N = require('./normalize');
const { PORT, AUTH_URL } = require('./env'); // nomor port + URL auth dari ../.env (1 file untuk semua)

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // frontend mini (Fase 1d)

// Satpam: tanya :7002 kartu ini milik siapa. Token jelek → 401.
// Auth mati → 503 TOLAK SEMUA (fail closed, jangan fail open).
async function requireUser(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ') || auth.trim() === 'Bearer') {
    return res.status(401).json({ error: 'Login required' });
  }
  let r;
  try {
    r = await fetch(AUTH_URL + '/api/me', {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    return res.status(503).json({ error: 'Auth server unreachable' });
  }
  if (!r.ok) return res.status(401).json({ error: 'Invalid or expired token' });
  req.user = await r.json(); // { email, nama, username, role }
  next();
}

// Scope data: admin lihat semua, user biasa cuma baris miliknya (user_email).
function userScope(user) {
  if (user.role === 'admin') return { clause: '', params: [] };
  return { clause: 'user_email = ?', params: [user.email] };
}

// Health check — buat verifikasi rumahnya berdiri atau belum
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// GET /leads — list + filter status/owner/country + search q + pagination beneran (production).
// Query: status, owner, country, q, page (default 1), limit (default 20, max 100).
// Legacy: tanpa page/limit → limit 200 (perilaku lama, biar UI lama tidak rusak).
// Balikin: { total (full count), page, limit, totalPages, count, data }
// Contoh: /leads?status=New&q=singh&page=2&limit=20
app.get('/leads', requireUser, (req, res) => {
  const { status, owner, country, q } = req.query;
  const where = [];
  const params = [];

  if (status) { where.push('lead_status = ?'); params.push(N.normalizeStatus(status)); }
  if (owner) { where.push('LOWER(owner) = LOWER(?)'); params.push(N.normalizeOwner(owner)); }
  if (country) { where.push('LOWER(country) = LOWER(?)'); params.push(N.normalizeCountry(country)); }
  if (q) {
    where.push('(LOWER(display_name) LIKE ? OR LOWER(company) LIKE ? OR LOWER(email) LIKE ?)');
    const like = `%${String(q).toLowerCase()}%`;
    params.push(like, like, like);
  }
  const scope = userScope(req.user); // kunci multi-user: tempel paling akhir
  if (scope.clause) { where.push(scope.clause); params.push(...scope.params); }

  // Pagination: jepit limit 1-100 biar server aman (HP tidak fetch 2000 baris sekaligus).
  const hasPaging = req.query.page !== undefined || req.query.limit !== undefined;
  let page = Math.max(1, parseInt(req.query.page, 10) || 1);
  let limit;
  if (!hasPaging) {
    limit = 200; // UI lama tanpa params: perilaku lama
  } else {
    limit = parseInt(req.query.limit, 10) || 20;
    limit = Math.min(100, Math.max(1, limit));
  }

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM leads ${whereSql}`).get(...params).c;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (page > totalPages) page = totalPages; // jangan kasih halaman kosong
  const offset = (page - 1) * limit;

  const rows = db.prepare(`SELECT * FROM leads ${whereSql} ORDER BY create_date DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  res.json({ total, page, limit, totalPages, count: rows.length, data: rows });
});

// GET /leads/export — WAJIB di atas /:id, biar "export" gak dikira id!
// Sama filter kayak /leads, tapi output CSV + tanpa LIMIT (full filtered view)
app.get('/leads/export', requireUser, (req, res) => {
  const { status, owner, country, q } = req.query;
  const where = [];
  const params = [];
  if (status) { where.push('lead_status = ?'); params.push(N.normalizeStatus(status)); }
  if (owner) { where.push('LOWER(owner) = LOWER(?)'); params.push(N.normalizeOwner(owner)); }
  if (country) { where.push('LOWER(country) = LOWER(?)'); params.push(N.normalizeCountry(country)); }
  if (q) {
    where.push('(LOWER(display_name) LIKE ? OR LOWER(company) LIKE ? OR LOWER(email) LIKE ?)');
    const like = `%${String(q).toLowerCase()}%`;
    params.push(like, like, like);
  }
  const scope = userScope(req.user);
  if (scope.clause) { where.push(scope.clause); params.push(...scope.params); }
  const sql = `SELECT id, display_name, company, email, phone, country, lead_status, owner, create_date, notes FROM leads ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY create_date DESC`;
  const rows = db.prepare(sql).all(...params);
  const header = 'id,display_name,company,email,phone,country,status,owner,create_date,notes';
  const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = [header, ...rows.map(r => [r.id, r.display_name, r.company, r.email, r.phone, r.country, r.lead_status, r.owner, r.create_date, r.notes].map(esc).join(','))];
  res.setHeader('Content-Type', 'text/csv');
  res.send(lines.join('\n'));
});

// GET /leads/:id — detail 1 lead (milik sendiri / admin, else 404 biar tidak bocor)
app.get('/leads/:id', requireUser, (req, res) => {
  const scope = userScope(req.user);
  const sql = scope.clause
    ? 'SELECT * FROM leads WHERE id = ? AND ' + scope.clause
    : 'SELECT * FROM leads WHERE id = ?';
  const row = db.prepare(sql).get(req.params.id, ...scope.params);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

// PATCH /leads/:id — update status/owner/notes doang (milik sendiri / admin)
app.patch('/leads/:id', requireUser, (req, res) => {
  const allowedStatus = ['New', 'Contacted', 'Connected', 'Qualified', 'Opportunity', 'Closed Won', 'Closed Lost'];
  const { status, owner, notes } = req.body;
  const scope = userScope(req.user);
  const findSql = scope.clause
    ? 'SELECT * FROM leads WHERE id = ? AND ' + scope.clause
    : 'SELECT * FROM leads WHERE id = ?';
  const row = db.prepare(findSql).get(req.params.id, ...scope.params);
  if (!row) return res.status(404).json({ error: 'not found' });

  const updates = [];
  const params = [];
  if (status !== undefined) {
    const norm = N.normalizeStatus(status);
    if (!allowedStatus.includes(norm)) return res.status(400).json({ error: `status harus salah satu: ${allowedStatus.join(', ')}` });
    updates.push('lead_status = ?'); params.push(norm);
  }
  if (owner !== undefined) { updates.push('owner = ?'); params.push(N.normalizeOwner(owner)); }
  if (notes !== undefined) { updates.push('notes = ?'); params.push(N.trim(notes)); }
  if (!updates.length) return res.status(400).json({ error: 'kasih minimal status/owner/notes' });

  params.push(req.params.id);
  db.prepare(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json(db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id));
});

// POST /leads/ingest — terima 1 JSON kayak website_form_submissions.json
// Dedup + simpan DALAM data milik sendiri (admin: milik admin). Tidak bisa intip/timpa orang.
app.post('/leads/ingest', requireUser, (req, res) => {
  const { name, email, phone, company, country, message } = req.body;
  if (!email && !phone) return res.status(400).json({ error: 'email atau phone wajib ada' });

  const me = req.user.email;
  const email_norm = N.normalizeEmail(email);
  const phone_digits = N.phoneDigits(phone);
  let existing = null;
  if (phone_digits.length >= 7) {
    existing = db.prepare('SELECT * FROM leads WHERE phone_digits = ? AND user_email = ?').get(phone_digits, me);
  }
  if (!existing && email_norm) {
    existing = db.prepare('SELECT * FROM leads WHERE email_norm = ? AND user_email = ?').get(email_norm, me);
  }

  if (existing) {
    // orang sama → update notes + company kalau ada yang baru (jangan bikin dobel)
    db.prepare("UPDATE leads SET notes = ?, company = COALESCE(NULLIF(?, ''), company) WHERE id = ?")
      .run(N.trim(message) || existing.notes, N.trim(company), existing.id);
    return res.json({ action: 'updated', lead: db.prepare('SELECT * FROM leads WHERE id = ?').get(existing.id) });
  }

  // orang baru → split name simple: kata pertama = first, sisanya = last
  const parts = N.trim(name).split(/\s+/);
  const first = parts[0] || '';
  const last = parts.slice(1).join(' ') || '';
  const maxId = db.prepare('SELECT MAX(CAST(id AS INTEGER)) as m FROM leads').get().m || 100236900;
  const newId = String(Number(maxId) + 1);
  const today = new Date().toISOString().slice(0, 10);

  db.prepare(`INSERT INTO leads (id, first_name, last_name, full_name, display_name, company, company_norm, email, email_norm, phone, phone_digits, country, lead_status, owner, create_date, notes, user_email)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    newId, first, last, N.trim(name), N.trim(name),
    N.trim(company), N.normalizeCompany(company),
    N.trim(email), email_norm, N.trim(phone), phone_digits,
    N.normalizeCountry(country), 'New', '', today, N.trim(message), me
  );
  res.json({ action: 'created', lead: db.prepare('SELECT * FROM leads WHERE id = ?').get(newId) });
});

// POST /leads/dedupe-candidates — cari kembaran DALAM data sendiri (admin: milik admin)
app.post('/leads/dedupe-candidates', requireUser, (req, res) => {
  const { dedupe } = require('./dedupe');
  const top = Math.min(Number(req.body?.top) || 50, 200);
  const scope = userScope(req.user);
  const leads = scope.clause
    ? db.prepare(`SELECT * FROM leads WHERE ${scope.clause}`).all(...scope.params)
    : db.prepare('SELECT * FROM leads').all();
  res.json(dedupe(leads, top));
});

// POST /leads/extract — Notes/message -> { channel, detail } (stateless, tanpa data user → open, tanpa satpam)
app.post('/leads/extract', (req, res) => {
  const { extractChannel } = require('./extract');
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text is required' });
  const r = extractChannel(text);
  res.json({ ...r, llm: 'mocked (rules-only, no local AI required)' });
});

// GET /dashboard — counts milik sendiri (admin: semua)
app.get('/dashboard', requireUser, (req, res) => {
  const scope = userScope(req.user);
  const w = scope.clause ? 'WHERE ' + scope.clause : '';
  const p = scope.params;
  const total = db.prepare(`SELECT COUNT(*) AS c FROM leads ${w}`).get(...p).c;
  const by_status = Object.fromEntries(
    db.prepare(`SELECT lead_status AS k, COUNT(*) AS c FROM leads ${w} GROUP BY lead_status`).all(...p).map(r => [r.k, r.c])
  );
  const by_channel = Object.fromEntries(
    db.prepare(`SELECT channel AS k, COUNT(*) AS c FROM leads ${w} GROUP BY channel`).all(...p).map(r => [r.k || 'Unknown', r.c])
  );
  res.json({ total, by_status, by_channel });
});

app.listen(PORT, () => {
  console.log(`CRM API jalan di http://localhost:${PORT} (dari .env)`);
});
