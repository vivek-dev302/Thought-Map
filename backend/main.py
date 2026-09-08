import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env before anything else so all modules see the env vars
load_dotenv(Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from gemini import organize_thoughts
from models import ErrorResponse, OrganizeRequest, ThoughtGraph

app = FastAPI(title="Thought Organizer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}

print("inside main")

@app.post(
    "/api/organize",
    response_model=ThoughtGraph,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
def organize(request: OrganizeRequest):
    print(f"[ROUTE HIT] text={request.text[:30]!r}", flush=True)
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    try:
        return organize_thoughts(text)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gemini API failure: {exc}") from exc
