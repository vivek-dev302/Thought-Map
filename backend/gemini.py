import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

from models import ThoughtGraph

# Load .env explicitly so this module always has the key regardless of import order
load_dotenv(Path(__file__).resolve().parent / ".env")


SYSTEM_PROMPT = """You are a thought-organization engine.

Your job is to convert messy natural-language thoughts into a small structured graph.

Extract only information that is explicitly present or strongly implied by the user's text.

Organize thoughts into a hierarchy.

Allowed node types:
- area
- problem
- planning
- thought

Definitions:

area:
A broad topic or domain such as Health, Gym, Career, Finance, Relationships.

problem:
A difficulty, issue, obstacle, or negative condition explicitly described by the user.

planning:
Something the user wants, intends, or plans to do.

thought:
An observation, belief, concern, comparison, feeling, or statement that does not fit the other categories.

Rules:

1. Do not invent information.
2. Do not diagnose medical or psychological conditions.
3. Do not create causal relationships unless the user explicitly states them.
4. Preserve the user's meaning.
5. Group related thoughts under appropriate areas.
6. Avoid duplicate nodes.
7. Prefer concise labels.
8. Create only useful nodes.
9. Do not create unnecessary hierarchy.
10. Every node must have a unique ID.
11. Every edge must reference existing node IDs.
12. Return valid JSON only.
13. Do not include markdown.
14. Do not include explanations outside the JSON.

Preferred hierarchy:
AREA
 ├── PROBLEM
 │    ├── RELATED THOUGHT
 │    └── RELATED FACT
 └── PLANNING

Use "contains" for hierarchy.

Use "related_to" only when the relationship is explicitly supported by the user's text.

Prefer fewer useful nodes over many tiny nodes.
"""


def organize_thoughts(text: str) -> ThoughtGraph:
    print("inside organise thought fucntion")
    api_key = os.getenv("GEMINI_API_KEY")
    print(api_key)
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")

    model = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model=model,
        contents=f"User thought:\n{text}",
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.2,
            response_mime_type="application/json",
            response_schema=ThoughtGraph,
        ),
    )
    print(response)

    raw = (response.text or "").strip()
    if not raw:
        raise ValueError("Gemini returned an empty response")

    import json
    try:
        data = json.loads(raw)
        graph = ThoughtGraph.model_validate(data)
    except (json.JSONDecodeError, ValueError) as exc:
        raise ValueError(f"Gemini returned invalid JSON: {exc}") from exc

    return _validate_graph(graph)


def _validate_graph(graph: ThoughtGraph) -> ThoughtGraph:
    node_ids = [node.id for node in graph.nodes]
    unique_ids = set(node_ids)
    if len(node_ids) != len(unique_ids):
        raise ValueError("Gemini returned duplicate node IDs")

    valid_edges = []
    for edge in graph.edges:
        if edge.source in unique_ids and edge.target in unique_ids:
            valid_edges.append(edge)

    return ThoughtGraph(nodes=graph.nodes, edges=valid_edges)
