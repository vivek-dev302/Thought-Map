# ThoughtMap — AI Thought Organizer & Visualizer (MVP)

A small local app that turns messy thoughts into a simple flowchart.

```text
User types or speaks
        ↓
Text appears in the input (editable)
        ↓
Organize Thoughts
        ↓
FastAPI → Gemini → JSON graph
        ↓
React Flow canvas
```

## Project layout

```text
backend/     FastAPI + Gemini
frontend/    React + Vite + React Flow
```

## 1. Backend setup

You need Python 3.10+ and a [Gemini API key](https://aistudio.google.com/apikey).

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

On macOS/Linux:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env`:

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Start the API:

```powershell
uvicorn main:app --reload --port 8000
```

Check it:

```text
GET http://127.0.0.1:8000/api/health
```

Expected: `{"status":"ok"}`

## 2. Frontend setup

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

The Vite dev server proxies `/api` to the FastAPI app on port 8000.

## How to use

1. Type a thought, or click the microphone (Chrome/Edge) and then edit the transcript.
2. Click **Organize Thoughts**.
3. Wait for **Organizing your thoughts...**
4. Drag, pan, zoom the map. Double-click a node to rename it. Press Delete to remove a selected node.

Theme: use ☀ / ☾ in the header.

## API

`POST /api/organize`

Request:

```json
{
  "text": "My body is getting worse. I get sick whenever the temperature changes..."
}
```

Response:

```json
{
  "nodes": [
    { "id": "health", "label": "Health", "type": "area" },
    { "id": "sickness", "label": "Getting sick frequently", "type": "problem" }
  ],
  "edges": [
    { "source": "health", "target": "sickness", "relationship": "contains" }
  ]
}
```

Empty text returns HTTP 400. Gemini or JSON failures return HTTP 500.

## Example Gemini input / output

**Input**

> My body is getting worse. I get sick whenever the temperature changes, I get fever sometimes, my joints feel weak, and I've been going to the gym for three years but I'm not making much progress. Other people seem to be growing faster than me.

**Example output**

```json
{
  "nodes": [
    { "id": "health", "label": "Health", "type": "area" },
    { "id": "sickness", "label": "Getting sick frequently", "type": "problem" },
    { "id": "temperature", "label": "Temperature changes", "type": "thought" },
    { "id": "fever", "label": "Fever sometimes", "type": "problem" },
    { "id": "joints", "label": "Weak joints", "type": "problem" },
    { "id": "gym", "label": "Gym", "type": "area" },
    { "id": "little_progress", "label": "Little progress after three years", "type": "problem" },
    { "id": "others_faster", "label": "Others seem to grow faster", "type": "thought" }
  ],
  "edges": [
    { "source": "health", "target": "sickness", "relationship": "contains" },
    { "source": "sickness", "target": "temperature", "relationship": "contains" },
    { "source": "health", "target": "fever", "relationship": "contains" },
    { "source": "health", "target": "joints", "relationship": "contains" },
    { "source": "gym", "target": "little_progress", "relationship": "contains" },
    { "source": "gym", "target": "others_faster", "relationship": "contains" }
  ]
}
```

The model only extracts what you said. It does not diagnose, invent causes, or add extra topics.

## Voice input

Uses the browser Speech Recognition API. There is no speech backend.

If the browser does not support it, the microphone button is disabled.

## Not included (on purpose)

Saving maps, accounts, a database, Docker, and extra AI chat. The code is small enough to add those later.
