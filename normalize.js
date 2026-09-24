// normalize.js — kumpulan pembersih data, simple aja biar gampang ditracking
// Prinsip deterministic-first ala exp004: bersihin murah pake JS dulu, baru mikir AI nanti.

function trim(s) {
  return (s || '').trim();
}

function normalizeEmail(email) {
  return trim(email).toLowerCase();
}

function phoneDigits(phone) {
  return (phone || '').replace(/\D/g, ''); // buang semua non-digit: "+62 898-..." -> "62898..."
}

function normalizeCompany(name) {
  let s = (name || '').toLowerCase();
  // buang suffix legal umum: inc, co, ltd, pte, dll + titiknya
  s = s.replace(/\b(inc|co|ltd|pte|llc|gmbh|srl|sAS|sas|bv|ag|gbr|studio|group|holdings)\b\.?/g, '');
  s = s.replace(/[^a-z0-9]/g, ''); // buang spasi/simbol, sisa huruf+angka doang
  return s;
}

function normalizeStatus(raw) {
  const s = trim(raw).toLowerCase().replace(/\s+/g, ' '); // " New" -> "new", "CLOSED WON" -> "closed won"
  const map = {
    'new': 'New',
    'contacted': 'Contacted',
    'connected': 'Connected',
    'qualified': 'Qualified',
    'opportunity': 'Opportunity',
    'closed won': 'Closed Won',
    'closed lost': 'Closed Lost',
  };
  return map[s] || trim(raw); // kalau ada status aneh, balikin apa adanya (biar ketauan, bukan diem-diem)
}

function normalizeCountry(raw) {
  const s = trim(raw);
  if (!s) return '';
  // Title Case simple: "malaysia" -> "Malaysia", "united kingdom" -> "United Kingdom"
  return s.toLowerCase().split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ');
}

function normalizeOwner(raw) {
  return trim(raw); // "Marcus Wong " -> "Marcus Wong"
}

// Tanggal ada 3 format: "12/21/2025" (M/D/YYYY), "2025-09-29", "2025-10-27T00:00:00Z"
// Output selalu "YYYY-MM-DD" biar gampang di-sort/filter
function parseDate(raw) {
  const s = trim(raw);
  if (!s) return null;
  if (s.includes('T')) return s.slice(0, 10); // ISO -> ambil tanggalnya doang
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // udah ISO date
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // M/D/YYYY
  if (m) {
    const mm = m[1].padStart(2, '0');
    const dd = m[2].padStart(2, '0');
    return `${m[3]}-${mm}-${dd}`;
  }
  return s; // fallback: balikin apa adanya biar ketauan
}

function displayName(first, last, full) {
  if (trim(full)) return trim(full);
  return trim(`${trim(first)} ${trim(last)}`.trim());
}

module.exports = {
  trim,
  normalizeEmail,
  phoneDigits,
  normalizeCompany,
  normalizeStatus,
  normalizeCountry,
  normalizeOwner,
  parseDate,
  displayName,
};
