// extract.js — Notes/message -> { channel, detail } using rules only (no local AI required)
// Order matters: Event first (most specific), Other last (fallback).
// Channels allowed: Website, Event, LinkedIn, Organic Search, Referral, Manual/Sales, Other

function extractChannel(rawText) {
  const text = (rawText || '').trim();
  const t = text.toLowerCase();
  const short = (s, n = 100) => (s || '').trim().slice(0, n);

  // 1. Event — booth, QR, summit, festival, expo, named events
  if (/(qr code|booth|summit|festival|expo|saastr|web summit|techcrunch|mobile world|fintech|retail asia|london tech|dubai.*fintech)/i.test(text)) {
    // try to grab event name: "Singapore FinTech Festival 2026", "SaaStr Annual", etc.
    const m = text.match(/([A-Z][a-zA-Z&]*\s){0,3}(FinTech Festival \d{4}|SaaStr Annual|Web Summit \d{4}|Retail Asia Expo|TechCrunch Disrupt|Mobile World Congress|London Tech Week|Dubai FinTech Week|Singapore FinTech Festival[^.,]*)/);
    const event = m ? m[0].trim() : 'Event';
    const how = /qr/i.test(text) ? 'Booth QR Code' : 'Booth';
    return { channel: 'Event', detail: `${event} — ${how}`.slice(0, 120) };
  }

  // 2. LinkedIn
  if (/linkedin/i.test(text)) {
    return { channel: 'LinkedIn', detail: short(text, 100) };
  }

  // 3. Organic Search — google, organic, blog, comparison page
  if (/(organic|google|googled|blog post|comparison-vs-hubspot)/i.test(text)) {
    return { channel: 'Organic Search', detail: short(text, 100) };
  }

  // 4. Referral — referred by X, warm intro
  if (/(referr|warm intro)/i.test(text)) {
    const m = text.match(/referred by ([A-Z][a-z]+ [A-Z][a-z]+)/i);
    const who = m ? `Referred by ${m[1]}` : 'Referral — Warm intro';
    return { channel: 'Referral', detail: who.slice(0, 120) };
  }

  // 5. Website — form fills, demo booking, pricing/homepage
  if (/(filled out the form|book(-| )a(-| )demo|pricing page|homepage|contact page|product tour|comparison.*page)/i.test(text)) {
    return { channel: 'Website', detail: short(text, 100) };
  }

  // 6. Manual/Sales — phone, walk-in, office, manual add
  if (/(manual|phone call|inbound phone|walked into|office|voicemail|left voicemail)/i.test(text)) {
    return { channel: 'Manual/Sales', detail: short(text, 100) };
  }

  // 7. Fallback
  return { channel: 'Other', detail: short(text, 100) || 'Other' };
}

module.exports = { extractChannel };
