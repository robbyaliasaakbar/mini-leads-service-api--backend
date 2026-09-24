// dedupe.js — cari kembaran pake JS murni, no AI wajib
// Pola: BLOCKING murah dulu (biar 4,2jt pair -> <5rb kandidat), baru SCORING agak mahal.
// Kenapa? Kalau langsung bandingin semua, laptop meledak + kalau pake LLM semua, dompet meledak.

function lev(a, b) {
  // Levenshtein simple buat pemula: hitung edit distance (tambah/hapus/ganti)
  a = (a || '').toLowerCase(); b = (b || '').toLowerCase();
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const m = Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = m[0];
    m[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = m[j];
      m[j] = Math.min(m[j] + 1, m[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return m[b.length];
}

function sim(a, b) {
  // similarity 0..1: 1 = sama persis, 0 = beda total
  a = (a || '').toLowerCase().trim(); b = (b || '').toLowerCase().trim();
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  const d = lev(a, b);
  return 1 - d / Math.max(a.length, b.length);
}

function emailSim(a, b) {
  // email penting: pisah local@domain, domain sama bobot gede
  a = (a || '').toLowerCase().trim(); b = (b || '').toLowerCase().trim();
  if (a === b && a) return 1;
  const [la, da] = a.split('@');
  const [lb, db] = b.split('@');
  if (da && da === db) {
    // domain sama (misal sama-sama @huanganalytics.co) → tinggal adu localpart
    return 0.5 + 0.5 * sim(la, lb);
  }
  return sim(a, b) * 0.8;
}

function scorePair(A, B) {
  // Weighted sum simple, gampang dijelasin di README
  const reasons = [];
  let sEmail = emailSim(A.email_norm, B.email_norm);
  let sName = sim(A.display_name, B.display_name);
  let sPhone = (A.phone_digits && A.phone_digits === B.phone_digits) ? 1 : 0;
  let sComp = (A.company_norm && A.company_norm === B.company_norm) ? 1 : 0;

  if (sEmail > 0.9) reasons.push(`email mirip ${sEmail.toFixed(2)}`);
  if (sName > 0.85) reasons.push(`nama mirip ${sName.toFixed(2)}`);
  if (sPhone) reasons.push('phone sama persis');
  if (sComp) reasons.push('company_norm sama');

  const score = 0.4 * sEmail + 0.3 * sName + 0.2 * sPhone + 0.1 * sComp;
  return { score: Number(score.toFixed(3)), reasons, sEmail, sName, sPhone, sComp };
}

function findCandidates(leads) {
  // BLOCKING: bikin 3 map, yang share key minimal 1 → kandidat. Sisanya buang (hemat 99%).
  const byPhone = new Map();
  const byDomainComp = new Map();
  const byCompInit = new Map();

  for (const L of leads) {
    if (L.phone_digits && L.phone_digits.length >= 7) {
      if (!byPhone.has(L.phone_digits)) byPhone.set(L.phone_digits, []);
      byPhone.get(L.phone_digits).push(L);
    }
    const dom = (L.email_norm || '').split('@')[1] || '';
    if (dom && L.company_norm) {
      const k = dom + '|' + L.company_norm;
      if (!byDomainComp.has(k)) byDomainComp.set(k, []);
      byDomainComp.get(k).push(L);
    }
    if (L.company_norm) {
      const init = (L.display_name || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 2);
      const k = L.company_norm + '|' + init;
      if (!byCompInit.has(k)) byCompInit.set(k, []);
      byCompInit.get(k).push(L);
    }
  }

  const pairSet = new Set();
  const pairs = [];
  const addGroup = (group) => {
    if (group.length < 2 || group.length > 20) return; // grup >20 pasti company gede doang, skip biar gak bengkak
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i].id, b = group[j].id;
        const key = a < b ? a + '|' + b : b + '|' + a;
        if (!pairSet.has(key)) {
          pairSet.add(key);
          pairs.push([group[i], group[j]]);
        }
      }
    }
  };
  for (const g of byPhone.values()) addGroup(g);
  for (const g of byDomainComp.values()) addGroup(g);
  for (const g of byCompInit.values()) addGroup(g);

  return pairs;
}

function dedupe(leads, topN = 100) {
  const t0 = Date.now();
  const pairs = findCandidates(leads);
  const scored = pairs.map(([A, B]) => {
    const s = scorePair(A, B);
    return {
      id_a: A.id, name_a: A.display_name, email_a: A.email,
      id_b: B.id, name_b: B.display_name, email_b: B.email,
      score: s.score, reasons: s.reasons,
      llm: 'mocked (rules-only, no local AI required)',
    };
  }).filter(x => x.score >= 0.5) // buang yang jelas bukan kembar
    .sort((x, y) => y.score - x.score)
    .slice(0, topN);

  return { candidates_checked: pairs.length, groups: scored, ms: Date.now() - t0 };
}

module.exports = { lev, sim, emailSim, scorePair, findCandidates, dedupe };
