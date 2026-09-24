# Node 22 slim (glibc) — JANGAN alpine: better-sqlite3 tidak punya prebuild musl.
# Pola sama kayak backend :7002: code di-mount dari host (edit langsung kepake),
# jadi image ini cuma sediain runtime.
FROM node:22-slim

WORKDIR /app
EXPOSE 7005

# Server data miniLeads (cukup buat lokal, BUKAN buat production publik).
CMD ["node", "server.js"]
