# REIMS — Rural Education Impact & Monitoring System

## Quick Start

### 1. Start the Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
```

### 2. Open the Login Page
Open `frontend/login.html` in your browser.

### 3. Login Credentials

**Admin Portal** (Full monitoring dashboard):
- Username: `admin`
- Password: `admin123`

**School Portal** (Data entry system):
- Username: `sch001` to `sch008`
- Password: `school123`

---

## Two Portals

### Admin Portal (`index.html`)
- Full monitoring dashboard with AI insights
- Partnership tracking & risk alerts
- Regional analytics
- **Unchanged from original design**

### School Portal (`school-portal.html`) — NEW
- Student data entry & management
- Attendance marking (bulk & individual)
- Dropout tracking with reasons
- Image upload verification
- Analytics dashboard

---

## Project Structure
```
hackathon.lvzzaaa/
├── frontend/
│   ├── index.html      ← Main UI
│   ├── style.css       ← Dark theme styles
│   └── app.js          ← Charts, AI logic, API calls
├── backend/
│   ├── app.py          ← Flask REST API
│   └── requirements.txt
├── data/
│   ├── schools_data.json
│   └── partnership_timeline.json
└── start.bat           ← Windows quick-start
```

## Features
- **Dashboard** — KPI cards, attendance trends, risk donut, resource bars, teacher ratios, partnership radar
- **Schools** — Filterable cards with risk badges, engagement bars, click-to-expand modal with monthly charts
- **AI Insights** — Rule-based dropout risk scoring, weak engagement zone detection, NGO/teacher alerts
- **Partnerships** — Timeline chart, collaboration network table, weak area detection
- **Risk Alerts** — Horizontal bar chart + sortable table with risk scores
- **Regions** — Regional aggregation cards + comparison chart

## API Endpoints
| Endpoint | Description |
|---|---|
| `GET /api/dashboard/summary` | KPI summary |
| `GET /api/schools` | All schools (filter by `?region=`) |
| `GET /api/schools/:id` | Single school with risk scores |
| `GET /api/ai/insights` | AI-generated insights |
| `GET /api/ai/dropout-risk` | Risk scores for all schools |
| `GET /api/partnerships` | Partnership timeline + network |
| `GET /api/regions` | Regional aggregates |
