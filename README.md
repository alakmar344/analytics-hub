# Analytics Hub – Esamz AI

A **privacy-first, self-hosted analytics platform** built for Esamz AI.

- 🔒 **Privacy-safe** – visitor IPs are HMAC-SHA256 hashed; the raw IP is never stored.
- 📡 **Event receiver** – a single `POST /track` endpoint that accepts events from any client.
- 🗄️ **MongoDB storage** – all events are persisted in MongoDB with Mongoose.
- 📊 **Live dashboard** – a clean HTML/CSS/JS UI showing KPIs, charts, and a paginated event log.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Environment Variables](#environment-variables)
5. [Configuring MongoDB](#configuring-mongodb)
6. [API Reference](#api-reference)
7. [Dashboard](#dashboard)
8. [Embedding the Tracker](#embedding-the-tracker)
9. [Running Tests](#running-tests)
10. [Security Notes](#security-notes)

---

## Project Structure

```
analytics-hub/
├── server/
│   ├── index.js              # Express app entry point
│   ├── config/
│   │   └── db.js             # MongoDB connection helper
│   ├── models/
│   │   └── Event.js          # Mongoose schema for analytics events
│   ├── middleware/
│   │   └── hashIp.js         # HMAC-SHA256 IP-hashing middleware
│   └── routes/
│       ├── receiver.js       # POST /track – event receiver
│       └── api.js            # GET /api/stats, /api/events
├── dashboard/
│   ├── index.html            # Single-page dashboard
│   ├── css/style.css         # Dashboard styles
│   └── js/dashboard.js      # Dashboard logic & Chart.js integration
├── tests/
│   ├── hashIp.test.js        # Unit tests for IP hashing middleware
│   └── routes.test.js        # Integration tests for API routes
├── .env.example              # Template for environment variables
├── .gitignore
└── package.json
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| MongoDB | ≥ 6 (local) **or** a free Atlas cluster |

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/alakmar344/analytics-hub.git
cd analytics-hub

# 2. Install dependencies
npm install

# 3. Copy the environment template
cp .env.example .env

# 4. Edit .env with your settings
nano .env

# 5. Start the server
npm start
# → Analytics Hub running → http://localhost:3000
```

Open **http://localhost:3000** in your browser to view the dashboard.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_URI` | `mongodb://localhost:27017/analytics-hub` | MongoDB connection string |
| `PORT` | `3000` | TCP port the server listens on |
| `IP_HASH_SECRET` | `change_me_to_a_random_secret` | HMAC secret for IP hashing |

Generate a strong secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Configuring MongoDB

### Option A – Local MongoDB

1. **Install MongoDB Community Edition**
   Follow the official guide for your OS: https://www.mongodb.com/docs/manual/installation/

2. **Start the MongoDB service**
   ```bash
   # macOS (Homebrew)
   brew services start mongodb-community

   # Ubuntu / Debian
   sudo systemctl start mongod

   # Windows
   net start MongoDB
   ```

3. **Set the connection string in `.env`**
   ```dotenv
   MONGO_URI=mongodb://localhost:27017/analytics-hub
   ```

4. **Connect with Node.js** – `server/config/db.js` handles this automatically:
   ```js
   const mongoose = require('mongoose');

   async function connectDB() {
     await mongoose.connect(process.env.MONGO_URI);
     console.log(`MongoDB connected: ${mongoose.connection.host}`);
   }
   ```

### Option B – MongoDB Atlas (cloud)

1. **Create a free Atlas account** at https://www.mongodb.com/atlas

2. **Create a new cluster** (the M0 free tier is sufficient for development)

3. **Create a database user**
   Atlas Dashboard → Database Access → Add New Database User. Note the username and password.

4. **Whitelist your IP**
   Atlas Dashboard → Network Access → Add IP Address.
   Use `0.0.0.0/0` for development (restrict in production).

5. **Get your connection string**
   Cluster → Connect → Connect your application → Driver: Node.js

   It will look like:
   ```
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```

6. **Set it in `.env`** (replace `<username>` and `<password>`):
   ```dotenv
   MONGO_URI=mongodb+srv://myuser:mypassword@cluster0.abcde.mongodb.net/analytics-hub?retryWrites=true&w=majority
   ```

7. **Verify the connection**
   ```bash
   npm start
   # MongoDB connected: cluster0-shard-00-00.abcde.mongodb.net
   # Analytics Hub running → http://localhost:3000
   ```

### Node.js MongoDB connection snippet

```js
require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Connection error:', err));

// Define a schema
const eventSchema = new mongoose.Schema({
  event:     String,
  page:      String,
  hashedIp:  String,
  timestamp: { type: Date, default: Date.now },
});
const Event = mongoose.model('Event', eventSchema);

// Insert a document
await Event.create({ event: 'pageview', page: '/home', hashedIp: 'abc123' });

// Query documents
const events = await Event.find({ event: 'pageview' }).sort({ timestamp: -1 }).limit(10);
```

---

## API Reference

### POST /track

Receives an analytics event. The caller's IP is HMAC-hashed server-side and never stored raw.

**URL:** `POST /track`
**Content-Type:** `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event` | string | ✅ | Event name, e.g. `"pageview"`, `"click"` |
| `page` | string | ✅ | URL or path where the event occurred |
| `referrer` | string | ❌ | Referring URL |
| `meta` | object | ❌ | Arbitrary key-value metadata |

```bash
curl -X POST http://localhost:3000/track \
  -H "Content-Type: application/json" \
  -d '{"event":"pageview","page":"/dashboard","referrer":"https://google.com"}'
# → {"ok":true,"id":"65f1a2b3..."}
```

---

### GET /api/stats

Returns aggregated statistics for a date range.

| Param | Default | Description |
|-------|---------|-------------|
| `from` | 7 days ago | ISO 8601 start date |
| `to` | now | ISO 8601 end date |

```bash
curl "http://localhost:3000/api/stats?from=2024-01-01&to=2024-12-31"
```

Response includes: `totalEvents`, `uniqueVisitors`, `eventBreakdown`, `topPages`, `eventsOverTime`.

---

### GET /api/events

Returns a paginated list of raw events.

| Param | Default | Description |
|-------|---------|-------------|
| `from` | 7 days ago | Start date |
| `to` | now | End date |
| `page` | `1` | Page number |
| `limit` | `50` | Results per page (max 200) |
| `event` | *(all)* | Filter by event type |

---

## Dashboard

The dashboard is served at `http://localhost:3000` and includes:

| Section | Description |
|---------|-------------|
| **Overview** | KPI cards + events-over-time line chart |
| **Top Pages** | Horizontal bar chart of most visited pages |
| **Events** | Doughnut chart of event type distribution |
| **Event Log** | Paginated table with filter by event type |

Use the **From / To** date pickers and **Refresh** button to update all charts.

---

## Embedding the Tracker

Add this snippet to any web page:

```html
<script>
  function track(event, meta) {
    fetch('http://YOUR_SERVER:3000/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        page: window.location.pathname,
        referrer: document.referrer,
        meta: meta || {},
      }),
    }).catch(console.error);
  }

  // Auto-track pageviews
  track('pageview');

  // Track button clicks
  document.querySelectorAll('[data-track]').forEach((el) => {
    el.addEventListener('click', () => track('click', { id: el.dataset.track }));
  });
</script>
```

---

## Running Tests

```bash
npm test
```

Covers IP hashing middleware (unit), POST /track, GET /api/stats, and GET /api/events. No live MongoDB required – Mongoose is mocked.

---

## Security Notes

- **IP Privacy** – Raw IPs are never stored. Only the HMAC-SHA256 hash (keyed with `IP_HASH_SECRET`) is persisted.
- **Change the secret** – Always use a strong random `IP_HASH_SECRET` in production.
- **CORS** – Default config is permissive (development). Restrict origins in production via `cors({ origin: 'https://yourdomain.com' })`.
- **MongoDB credentials** – Never commit `.env`; it is excluded by `.gitignore`.
