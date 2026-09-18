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
    print(f"\n[BACKEND] 📥 Received /api/organize request:")
    print(f"  - text: {request.text!r}")
    print(f"  - intent: {request.intent}")
    print(f"  - visual_type: {request.visual_type}")
    print(f"  - current_canvas commands count: {len(request.current_canvas or [])}")

    text = request.text.strip()
    if not text:
        print("[BACKEND] ❌ Error: Text is required")
        raise HTTPException(status_code=400, detail="Text is required")

    try:
        response = organize_thoughts(request)
        print(f"[BACKEND] ✅ organize_thoughts succeeded:")
        print(f"  - visual_type: {response.visual_type}")
        print(f"  - user_intent: {response.user_intent}")
        print(f"  - commands count: {len(response.commands)}")
        print(f"  - assistant_feedback: {response.assistant_feedback!r}")
        for idx, cmd in enumerate(response.commands):
            print(f"    * Command {idx+1}: type={cmd.visual_type}, layout={cmd.layout}, elements={len(cmd.elements)}, connections={len(cmd.connections)}")
        return response
    except ValueError as exc:
        print(f"[BACKEND] ❌ ValueError in organize_thoughts: {exc}")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        print(f"[BACKEND] ❌ Unexpected error in organize_thoughts: {exc}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Gemini API failure: {exc}") from exc
