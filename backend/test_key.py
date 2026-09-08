import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

api_key = os.getenv("GEMINI_API_KEY")
print(f"Key loaded: {repr(api_key)}")

from google import genai
from google.genai import types
from models import ThoughtGraph

client = genai.Client(api_key=api_key)

try:
    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents="User thought:\nI need to go to the gym but I'm tired",
        config=types.GenerateContentConfig(
            temperature=0.2,
            response_mime_type="application/json",
            response_schema=ThoughtGraph,
        ),
    )
    print("SUCCESS:", response.text)
except Exception as e:
    print(f"FAILED: {e}")
