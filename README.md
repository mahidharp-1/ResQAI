# ResQAI — AI Emergency Prioritization & SafeRoute Engine

ResQAI is an AI-assisted emergency decision-support prototype for analyzing simultaneous incidents, calculating explainable priority, matching available resources, and recommending risk-aware routes.

> **Important:** ResQAI does not replace emergency dispatchers, medical professionals, police, firefighters, or other trained responders. AI recommendations must be independently verified before operational use.

## Architecture

- Frontend: React + Vite + Tailwind CSS + Leaflet
- Backend: Python + FastAPI + SQLAlchemy
- Database: SQLite
- AI: provider abstraction with deterministic demo mode
- Routing: OSRM with transparent fallback
- Dataset: fictional incidents, resources, hazards
- Tests: pytest

## Project structure

```text
ResQAI/
├── frontend/
├── backend/
├── dataset/
├── tests/
├── .gitignore
└── README.md
```

## 1. Backend

Windows:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python seed_database.py
uvicorn main:app --reload
```

macOS/Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python seed_database.py
uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`.

API docs: `http://localhost:8000/docs`

## 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

Optional frontend environment variable:

```text
VITE_API_URL=http://localhost:8000/api
```

## 3. Demo

1. Open Command Center.
2. Review the seeded incident priority queue.
3. Open Report Emergency.
4. Submit: `Major road accident near the college. Two injured and one unconscious. Traffic blocked.`
5. Click Analyze Emergency.
6. Review the explainable priority result.
7. Click Verify & Create Incident.
8. Open Incident Management and allocate resources.
9. Open SafeRoute and request a route recommendation.
10. Use the assistant to ask questions about current application data.

## AI architecture

`ai_service.py` is the provider boundary. Demo mode is deterministic and returns the same structured schema expected from a real AI provider. A production provider can be inserted without changing the frontend API contract.

The LLM is not the final priority authority. The backend runs `priority_engine.py` after extraction.

## Priority weights

- Life threat: 30
- People affected: 20
- Severity: 20
- Escalation risk: 15
- Time sensitivity: 10
- Location sensitivity: 5

Thresholds:

- 81–100: CRITICAL / P1
- 61–80: HIGH / P2
- 31–60: MODERATE / P3
- 0–30: LOW / P4

## Dataset

All records are fictional. No real names, phone numbers, or personally identifiable information are used.

The dataset contains:
- 10 incidents
- 10 emergency resources
- 10 hazards
- 3 critical, 3 high, 2 moderate, 2 low incidents

## Tests

From the repository root:

```bash
pytest -q
```

The included tests cover priority calculation, resource allocation, AI classification, and core API behavior.

## Limitations

- Demo AI is deterministic unless a provider adapter is added.
- OSRM may provide one route depending on the routing server; fallback mode is explicit.
- The prototype uses fictional coordinates and records.
- Route risk scoring is a prototype heuristic, not a validated emergency-routing safety model.
- No autonomous dispatch is performed.
- Human verification is mandatory.

## Future scope

- Multi-provider AI adapter
- Live municipal/traffic hazard feeds
- More sophisticated graph-based route risk scoring
- Historical model evaluation
- Role-based access control
- Audit-grade decision logs
- Multilingual incident intake
- Real-time WebSocket updates
- Integration with authorized emergency-service systems
