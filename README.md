# bytesquad
# REIMS — Rural Education Impact & Monitoring System

## Quick Start

### Option A — With Backend (Full API mode)
```bash
cd backend
pip install -r requirements.txt
python app.py
```
Then open `frontend/index.html` in your browser.

### Option B — Frontend Only (Offline mode)
Just open `frontend/index.html` directly — all data falls back to the embedded mock dataset automatically.

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
