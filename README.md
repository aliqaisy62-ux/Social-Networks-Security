# 🛡️ Social Networks Security Interactive Lab

> **Full-Stack Edition** — Node.js · Express · Vanilla JS · Tailwind-style CSS  
> Based on the lecture series by **Dr. Ali Salim**

---

## 📋 Overview

An interactive, browser-based security lab covering:

| Module | Description |
|---|---|
| **PageRank** | Graph-based ranking simulation with step-by-step log |
| **Levenshtein Distance** | Edit distance engine with real-time DP matrix (now server-powered) |
| **TrustRank** | Trust propagation from verified seed nodes |
| **Sybil Attacks** | Fake-identity network visualization |
| **OSINT** | Techniques: EXIF, Chronolocation, Geolocation, Facial Recognition |
| **Phishing Detector** | Domain similarity scanner |
| **Quiz Engine** | Dynamic question bank served from the backend API |

---

## 🗂️ Project Structure

```
sns-security-lab/
├── server.js        ← Express backend (all API routes)
├── data.json        ← Question bank + Trusted Seed Sites database
├── index.html       ← Frontend (fetch()-integrated)
├── package.json     ← Dependencies
└── README.md        ← This file
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v16 or higher — [Download](https://nodejs.org)
- **npm** (bundled with Node.js)

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Server

```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

### 3. Open in Browser

```
http://localhost:3000
```

The server serves both the API and the `index.html` frontend from the same origin, so no CORS issues and no separate dev server needed.

---

## 🔌 API Endpoints

All endpoints return JSON with a consistent `{ ok: boolean, ... }` envelope.

### `GET /api/health`
Server status check. Used by the frontend header to show **API: ONLINE**.

```json
{
  "ok": true,
  "status": "ONLINE",
  "uptime": "42s",
  "db": { "questions": 20, "seeds": 12 }
}
```

---

### `POST /api/levenshtein`
Computes edit distance between two strings on the server.

**Request body:**
```json
{ "source": "facebook", "target": "faceb00k" }
```

**Response:**
```json
{
  "ok": true,
  "distance": 2,
  "similarity": 75.0,
  "risk": { "level": "HIGH", "color": "threat", "action": "Flag for review" },
  "matrix": [[...]],
  "stepsLog": [...]
}
```

---

### `GET /api/quiz`
Returns a shuffled, filtered set of questions from `data.json`.

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `count` | number | Max questions to return (default: 10) |
| `topic` | string | Filter by topic (e.g. `OSINT`, `TrustRank`) |
| `difficulty` | string | `easy` \| `medium` \| `hard` |

**Response:**
```json
{
  "ok": true,
  "total": 10,
  "questions": [ { "id": 1, "topic": "OSINT", "difficulty": "medium", ... } ],
  "meta": { "availableTopics": [...], "appliedFilters": {...} }
}
```

---

### `POST /api/submit-quiz`
Scores a completed quiz and returns a full performance analysis.

**Request body:**
```json
{
  "questions": [...],
  "userAnswers": [1, 2, 0, 3, ...],
  "timeTaken": 187
}
```

**Response:**
```json
{
  "ok": true,
  "score": 8,
  "total": 10,
  "pct": 80,
  "grade": "A",
  "tier": "PROFICIENT",
  "topicSummary": [
    { "topic": "OSINT", "correct": 2, "total": 2, "pct": 100, "status": "mastered" }
  ],
  "weakTopics": ["TrustRank"],
  "breakdown": [...]
}
```

---

### `GET /api/seeds`
Returns the Trusted Seed Sites list used in the TrustRank module.

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `category` | string | Filter by category (e.g. `Academic`) |

---

## 🗄️ Database — `data.json`

The data store contains two top-level arrays:

### `questions[]`
Each question object:
```json
{
  "id": 1,
  "topic": "OSINT",
  "difficulty": "medium",
  "q": "Question text...",
  "opts": ["A", "B", "C", "D"],
  "correct": 1,
  "exp": "Explanation shown after answering..."
}
```

**Topics covered:**
`OSINT` · `Sybil Attacks` · `TrustRank` · `Phishing Detection` · `Data Privacy` · `Platform Security` · `Social Engineering` · `Malware` · `Account Takeovers` · `Chronolocation` · `Image OSINT` · `Social Networks`

### `trustedSeedSites[]`
Seed sites for the TrustRank module:
```json
{
  "id": "seed-01",
  "domain": "wikipedia.org",
  "label": "Wikipedia",
  "category": "Encyclopedia",
  "trustScore": 0.95,
  "reason": "...",
  "icon": "📚"
}
```

---

## ⚙️ Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server listening port |

Set via environment variable:
```bash
PORT=8080 npm start
```

---

## 🎨 Frontend Integration

The frontend communicates with the backend using native `fetch()`. All API calls include a graceful fallback to client-side computation if the server is unreachable (offline mode).

Key integration points:

| Feature | Old (client-only) | New (API-powered) |
|---|---|---|
| Levenshtein | JS function in browser | `POST /api/levenshtein` |
| Quiz Questions | Hardcoded array in HTML | `GET /api/quiz` |
| Quiz Scoring | Browser-only | `POST /api/submit-quiz` |
| API Status | — | `GET /api/health` (header indicator) |

---

## 🔐 Security Notes

- CORS is enabled for all origins (`*`) — restrict in production
- No authentication required (educational tool)
- Input validation on all POST endpoints (string length, type checks)
- All API errors return structured JSON, never stack traces

---

## 📦 Dependencies

| Package | Version | Purpose |
|---|---|---|
| `express` | ^4.18 | HTTP server & routing |
| `cors` | ^2.8 | Cross-Origin Resource Sharing |
| `body-parser` | ^1.20 | JSON request body parsing |
| `nodemon` (dev) | ^3.0 | Auto-restart during development |

---

## 📝 License

MIT — Free to use for educational purposes.

---

*Built for the Social Networks Security course — Dr. Ali Salim*
