import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import edge_tts

from gemini import organize_thoughts
from models import ErrorResponse, OrganizeRequest, OrganizeResponse

DEFAULT_VOICE = os.getenv("EDGE_TTS_VOICE", "en-US-JennyNeural")

app = FastAPI(title="ThoughtCanvas")

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


@app.get("/api/tts")
async def text_to_speech(
    text: str = Query(..., description="Text to synthesize to speech"),
    voice: str = Query(DEFAULT_VOICE, description="Edge TTS neural voice name"),
):
    clean_text = text.strip() if isinstance(text, str) else ""
    if not clean_text:
        raise HTTPException(status_code=400, detail="Text is required")

    voice_name = voice if isinstance(voice, str) and voice.strip() else DEFAULT_VOICE

    try:
        communicate = edge_tts.Communicate(clean_text, voice_name)
        chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])

        audio_bytes = b"".join(chunks)
        if not audio_bytes:
            raise HTTPException(status_code=500, detail="Generated empty audio")

        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline",
                "Cache-Control": "public, max-age=3600",
            },
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {exc}") from exc


@app.post(
    "/api/organize",
    response_model=OrganizeResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
def organize(request: OrganizeRequest):
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    try:
        return organize_thoughts(
            text=text,
            current_items=request.current_items,
            current_relationships=request.current_relationships,
        )
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gemini API failure: {exc}") from exc
