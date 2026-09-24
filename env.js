// env.js — baca ../.env TANPA library (pola sama kayak backend auth PHP).
// Format: KEY=nilai, baris # = komentar. Isi: VITE_BACKEND_PORT, FRONTEND_PORT, AUTH_PORT.

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const out = {};
  const p = path.join(__dirname, '.env'); // .env di folder ini sendiri
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i === -1) continue;
    out[s.slice(0, i).trim()] = s.slice(i + 1).trim();
  }
  return out;
}

const env = loadEnv();
const PORT = Number(env.VITE_BACKEND_PORT) || 7003; // fallback biar tetap jalan tanpa .env
const AUTH_URL = env.AUTH_API_URL || 'http://localhost:7002'; // backend auth (verifikasi token)

module.exports = { PORT, AUTH_URL };
