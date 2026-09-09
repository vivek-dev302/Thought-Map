import json
import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

from typing import Optional
from models import OrganizeResponse, Relationship, SemanticItem

load_dotenv(Path(__file__).resolve().parent / ".env")


SYSTEM_PROMPT = """\
You are a semantic thought-organizing assistant for a personal freeform whiteboard canvas.

Your job is to organize thoughts and maintain/edit the whiteboard canvas across conversational turns.
Extract only what is actually present or instructed in the user's text.

Allowed kinds:
- area: A broad domain of life or thought (e.g., Health & Fitness, Career, Skills, Communication, Finance, Mindset, Academics, College Studies).
- concern: Something the user is worried, anxious, or uncertain about.
- problem: Something the user explicitly describes as a problem, difficulty, obstacle, failure, or bottleneck.
- plan: Something the user wants, intends, or plans to do.
- opinion: A personal belief, interpretation, judgment, or comparison.
- observation: Something the user notices or reports experiencing without explicitly defining it as a problem.
- question: A question or uncertainty expressed by the user.
- note: A useful piece of information that doesn't fit another category.

Rules for Item Extraction & Organization:
1. Preserve the user's original meaning without diagnosing or inventing assumptions.
2. Prefer concise, natural keyword-driven representations.
3. A thought may belong to one or more areas. List the primary area first in the areas array.

Rules for Conversational Editing & Map Refinement:
- When "Current Canvas State" is provided:
  1. The user's input may be an edit command, correction, reorganization, area splitting/merging, addition, or deletion.
  2. For example, if the user says "split studies into college studies and career, move python to career":
     - Update the `areas` of the existing items to reflect the split areas.
     - Keep existing item IDs so unchanged thoughts are preserved.
  3. If the user asks to delete or remove something, omit those items from the output.
  4. If the user adds new thoughts, create new items with fresh unique IDs and integrate them.
  5. Always return the COMPLETE updated list of all active items and valid relationships.

Rules for Relationship Extraction (CRITICAL):
1. Extract relationships ONLY when explicitly stated in user text (e.g., "A causes B", "A makes B slow", "A prevents B", "A because B").
2. DO NOT invent or infer relationships between thoughts just because they share an area.
3. Each relationship must have:
   - from_id: ID of the source / cause / blocker item
   - to_id: ID of the target / effect / impacted item
   - label: concise phrase describing the connection (e.g. "slows down", "because", "prevents")
   - kind: "causes" | "prevents" | "leads_to" | "blocks" | "relates_to"

Return valid JSON:
{
  "items": [
    {
      "id": "item_1",
      "text": "concise thought or area name",
      "kind": "area | concern | problem | plan | opinion | observation | question | note",
      "areas": ["Area Name"]
    }
  ],
  "relationships": [
    {
      "from_id": "item_1",
      "to_id": "item_2",
      "label": "short connecting phrase",
      "kind": "causes | prevents | leads_to | blocks | relates_to"
    }
  ]
}
"""


def organize_thoughts(
    text: str,
    current_items: Optional[list[SemanticItem]] = None,
    current_relationships: Optional[list[Relationship]] = None,
) -> OrganizeResponse:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")

    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    client = genai.Client(api_key=api_key)

    if current_items and len(current_items) > 0:
        items_json = json.dumps([item.model_dump() for item in current_items], indent=2)
        rels_json = json.dumps(
            [rel.model_dump() for rel in (current_relationships or [])], indent=2
        )
        prompt_content = (
            f"Current Canvas State:\n"
            f"Items:\n{items_json}\n\n"
            f"Relationships:\n{rels_json}\n\n"
            f"User Instruction / New Input:\n{text}"
        )
    else:
        prompt_content = f"User input:\n\n{text}"

    response = client.models.generate_content(
        model=model,
        contents=prompt_content,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.2,
            response_mime_type="application/json",
            response_schema=OrganizeResponse,
        ),
    )

    raw = (response.text or "").strip()
    if not raw:
        raise ValueError("Gemini returned an empty response")

    try:
        data = json.loads(raw)
        result = OrganizeResponse.model_validate(data)
    except (json.JSONDecodeError, ValueError) as exc:
        raise ValueError(f"Gemini returned invalid JSON: {exc}") from exc

    return _validate(result)


def _validate(result: OrganizeResponse) -> OrganizeResponse:
    seen_ids: set[str] = set()
    unique_items = []
    for item in result.items:
        if item.id not in seen_ids:
            seen_ids.add(item.id)
            unique_items.append(item)

    valid_relationships = []
    for rel in result.relationships:
        if rel.from_id in seen_ids and rel.to_id in seen_ids and rel.from_id != rel.to_id:
            valid_relationships.append(rel)

    return OrganizeResponse(items=unique_items, relationships=valid_relationships)
