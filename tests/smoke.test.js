// tests — meaningful ambiguous cases, not happy-path only
// Run: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const N = require('../normalize');
const { scorePair, findCandidates } = require('../dedupe');
const { extractChannel } = require('../extract');

test('status variants collapse to 7 canonical', () => {
  assert.equal(N.normalizeStatus('NEW'), 'New');
  assert.equal(N.normalizeStatus(' New'), 'New');
  assert.equal(N.normalizeStatus('qualified'), 'Qualified');
  assert.equal(N.normalizeStatus('CLOSED WON'), 'Closed Won');
});

test('3 date formats -> same ISO', () => {
  assert.equal(N.parseDate('12/21/2025'), '2025-12-21');
  assert.equal(N.parseDate('2025-09-29'), '2025-09-29');
  assert.equal(N.parseDate('2025-10-27T00:00:00Z'), '2025-10-27');
});

test('country case-insensitive (malaysia -> Malaysia)', () => {
  assert.equal(N.normalizeCountry('malaysia'), 'Malaysia');
  assert.equal(N.normalizeCountry('Malaysia'), 'Malaysia');
});

test('exact duplicate scores ~1.0', () => {
  const A = { display_name: 'Ravi Williams', email_norm: 'r.williams@reyes.biz', phone_digits: '123', company_norm: 'reyes' };
  const s = scorePair(A, { ...A });
  assert.ok(s.score >= 0.99, `got ${s.score}`);
});

test('same company, different person scores low (no false merge)', () => {
  const A = { display_name: 'Ayu Putri', email_norm: 'ayu@acme.co', phone_digits: '111', company_norm: 'acme' };
  const B = { display_name: 'Budi Santoso', email_norm: 'budi@acme.co', phone_digits: '222', company_norm: 'acme' };
  const s = scorePair(A, B);
  assert.ok(s.score < 0.5, `got ${s.score} — should stay low`);
});

test('extract maps 6 channels correctly', () => {
  assert.equal(extractChannel('He scanned our QR code at the SaaStr Annual booth').channel, 'Event');
  assert.equal(extractChannel('Found us through organic google search').channel, 'Organic Search');
  assert.equal(extractChannel('Linkedin dm inbound').channel, 'LinkedIn');
  assert.equal(extractChannel('Referred by Michael Zhang, warm intro').channel, 'Referral');
  assert.equal(extractChannel('Filled out the form on the homepage').channel, 'Website');
  assert.equal(extractChannel('Manual - added after inbound phone call').channel, 'Manual/Sales');
});
