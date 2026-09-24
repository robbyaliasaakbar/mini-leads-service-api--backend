# MiniLeads Backend (Data Engine :7005)

Hey there! Welcome to the engine room of MiniLeads.

Think of this server as the handy neighborhood clerk behind the counter. It quietly takes customer leads from website forms, cleans up messy names and wonky phone numbers, catches duplicate contacts, and neatly files everything away so the frontend app looks sharp.

Best of all: it keeps things simple and lightweight—no bulky enterprise database required!

---

## What Does This Helper Do?

- Lead Organizer: Stores and serves sales leads (/leads), filters them by status or country, and sorts out who owns what.
- Smart Cleaner: Normalizes messy dates, status tags, and country names so your data stays tidy.
- Duplicate Spotter: Checks if someone signed up twice with slight spelling differences, so you don't pitch the same person twice.
- Form Intake (/leads/ingest): Catches incoming signups from web forms in real-time.
- Friendly Bouncer: Asks our Central Auth server (:7002) to verify tickets (Bearer tokens) before letting anyone touch private data.

---

## Getting Started (Super Easy!)

You don't need a computer science degree to get this running. Just follow these steps:

### 1. Grab your config sheet
Duplicate the template file into .env:
```bash
cp .env.example .env
```
(Leave the defaults as-is unless you know you changed your port numbers!)

### 2. Set up the tools
If you're running directly on your machine:
```bash
npm install
```

### 3. Load some starter data
Want some sample contacts to play around with? Seed the local database:
```bash
npm run load
```
This reads the sample files in data/ and fills up your local leads.db.

### 4. Turn on the lights!

Option A — Directly with Node:
```bash
npm start
```

Option B — Cozy inside Docker (Set & Forget):
```bash
docker compose up -d
```

That is it! Your backend is now serving requests at http://localhost:7005.

---

## How to Tell If It's Working

Pop open a terminal or your browser and check the health buzzer:
```bash
curl http://localhost:7005/health
```
If you get `{"ok":true}`, you are good to go!

To run a quick self-check test suite:
```bash
npm test
```
(All 6 checks should pass cleanly.)

---

## What's Inside the Box?

```text
.
├── data/               # Starter sample files (leads_seed.csv) - safe to keep
├── tests/              # Quick sanity checks (smoke tests)
├── dedupe.js           # The clever logic that spots duplicate contacts
├── normalize.js        # The broom that cleans up dates, phone numbers & countries
├── extract.js          # Guesses where a lead came from (LinkedIn, Referral, etc.)
├── load.js             # Script to pump seed data into the database
├── server.js           # The main shop counter answering all API requests
├── db.js               # Connects to your local SQLite storage
├── env.js              # Reads your .env settings without extra fluff
├── Dockerfile          # Recipe to run this inside Docker
├── docker-compose.yml  # 1-click startup button for Docker
├── .env.example        # Clean template for configuration
└── .gitignore          # Keeps secrets and personal databases out of Git
```

---

## Golden House Rules

1. Keep Secrets Secret: Never commit .env or leads.db to GitHub. That is your personal data and stays right on your computer.
2. One Driver at a Time: Don't run npm start and docker compose up at the same time—they will argue over port 7005!
3. Keep the Auth Server Running: This shop checks customer badges with Central Auth (:7002). If that server is taking a nap, this one will politely refuse requests (503).

Enjoy building!
