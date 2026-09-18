"""
Gemini integration for Visual Thinking Canvas

Based on new CLAUDE.md architecture:
1. AI produces visual commands (not semantic items)
2. AI decides visual representation type (brain_dump, flowchart, architecture, etc.)
3. Structured visual command model (not raw Excalidraw JSON)
"""

import json
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from google import genai
from google.genai import types

from models import OrganizeRequest, OrganizeResponse, VisualCommand


load_dotenv(Path(__file__).resolve().parent / ".env")


SYSTEM_PROMPT = """You are an AI Visual Thinking Assistant for a freeform canvas application.

The user can describe anything they want to visualize. Your job is to:
1. Understand what the user wants to express
2. Decide on an appropriate visual representation
3. Create structured visual commands that the frontend can render

# Visual Types (choose the most appropriate):
- brain_dump: Freeform collection of thoughts, ideas, life areas, or concerns (Organized into thematic category columns)
- flowchart: Process with decision points and sequential flow
- user_flow: Sequence of user interactions (steps with arrows)
- architecture: System/components and their relationships (boxes with connections)
- process: Step-by-step procedure
- timeline: Chronological sequence
- concept_map: Ideas and connections
- mind_map: Hierarchical organization
- freeform: General spatial grouping

# Intent Detection:
- create: Create new visualization
- modify: Modify existing canvas
- connect: Connect existing elements
- delete: Remove elements
- update: Update text/properties
- move: Reposition elements
- group: Group related elements
- transform: Change visual type

# Visual Elements:
- text: Plain text label
- rectangle: Box (for area titles, system components, flow steps)
- ellipse: Circle/oval (for endpoints, states)
- diamond: Decision point (if/else)
- note: Sticky note style (for thoughts, sub-items, bulleted points)

# Layout Strategies:
- cluster: Grouped by topic/category columns (BEST for brain_dump, mind_map, concept_map)
- left_to_right: Sequential steps (BEST for user_flow, flowchart, timeline)
- top_to_bottom: Layered system hierarchy (BEST for architecture, system_diagram)
- freeform: No automatic layout

# CRITICAL RULES FOR VISUAL QUALITY & CLARITY:

1. BRAIN DUMPS & THOUGHT STREAMS:
   - Visual Type: "brain_dump", Layout: "cluster"
   - Group the user's thoughts into 3 to 5 major thematic areas/categories (e.g., "🏃 Fitness & Health", "💼 Career & AI Projects", "📚 Academics", "💬 Communication", "🎯 Personal Skills").
   - Include appropriate contextual emojis in titles and key points (e.g. 🏃, 💼, 💬, 📚, 🎯, 💡, ⚠️, 🤖, 🥊).
   - For each area, generate:
     a) ONE header rectangle element with `metadata: {"kind": "area", "category": "CategoryName"}` and concise title with emoji.
     b) 1 to 3 cohesive note elements with `metadata: {"category": "CategoryName"}` that synthesize the user's thoughts using clean multi-line bullet points (`• `).
   - DO NOT fragment every sentence into a separate box. Consolidate related thoughts into meaningful notes.
   - ABSOLUTE RULE FOR BRAIN DUMPS: DO NOT generate connection arrows between area headers and notes! Category columns provide clean spatial organization without spiderweb arrows. Set `connections: []`.

2. FLOWCHARTS & USER FLOWS:
   - Visual Type: "user_flow" or "flowchart", Layout: "left_to_right"
   - Create sequential step rectangles or diamonds for decision points.
   - Include clear directional arrows (`from_id` -> `to_id`) between consecutive steps.

3. ARCHITECTURE DIAGRAMS:
   - Visual Type: "architecture", Layout: "top_to_bottom"
   - Create rectangles for system components (Frontend, Backend, Database, APIs, Caches).
   - Include directional arrows showing data flow or network requests.

4. ACCURACY & SENSITIVITY:
   - Extract ONLY information explicitly provided by the user.
   - Do not hallucinate external facts or diagnose personal issues. Preserve the user's actual voice and thoughts.

# OUTPUT FORMAT:
Return valid JSON matching the OrganizeResponse schema:
{
  "commands": [
    {
      "visual_type": "brain_dump|flowchart|architecture|user_flow|etc",
      "layout": "cluster|left_to_right|top_to_bottom|freeform",
      "intent": "create|modify|connect|etc",
      "elements": [
        {
          "id": "unique_id",
          "type": "rectangle|note|ellipse|diamond|text",
          "text": "element text content (can include newlines for bullets)",
          "metadata": {
            "kind": "area|component|step|thought",
            "category": "CategoryName"
          }
        }
      ],
      "connections": [
        {
          "from_id": "source_id",
          "to_id": "target_id",
          "type": "arrow",
          "label": "optional label"
        }
      ],
      "groups": []
    }
  ],
  "assistant_feedback": "Short natural language feedback for TTS (e.g. 'I organized your thoughts into 4 category columns.')",
  "user_intent": "create",
  "visual_type": "brain_dump"
}

# EXAMPLES:

## Complex Brain Dump Example:
User: "I have so much going on. In health: bones feel weak, diet is poor, but I want to learn boxing and running. For career: learning AI and RAG, want to build a SaaS avatar tool. For communication: feel lonely, want to record 1 min daily videos. Academics are manageable."

Response:
- visual_type: "brain_dump", layout: "cluster"
- elements:
  - id: "area_health", type: "rectangle", text: "🏃 Health & Fitness", metadata: {"kind": "area", "category": "Health"}
  - id: "note_health_concerns", type: "note", text: "⚠️ Concerns:\n• Bones feeling weak\n• Diet needs improvement", metadata: {"category": "Health"}
  - id: "note_health_goals", type: "note", text: "🎯 Action Plan:\n• 🥊 Learn boxing\n• Calisthenics & running", metadata: {"category": "Health"}
  - id: "area_career", type: "rectangle", text: "💼 Career & AI Projects", metadata: {"kind": "area", "category": "Career"}
  - id: "note_career_plan", type: "note", text: "• 🤖 Learning production RAG\n• Building AI Avatar Manager SaaS tool", metadata: {"category": "Career"}
  - id: "area_comm", type: "rectangle", text: "💬 Communication", metadata: {"kind": "area", "category": "Communication"}
  - id: "note_comm_plan", type: "note", text: "• Address feeling lonely & build connections\n• 📹 Practice: Record 1-min daily video", metadata: {"category": "Communication"}
  - id: "area_academics", type: "rectangle", text: "📚 Academics", metadata: {"kind": "area", "category": "Academics"}
  - id: "note_academics", type: "note", text: "• College coursework (manageable)", metadata: {"category": "Academics"}
- connections: [] (Zero arrows in brain dumps)

## User Flow Example:
User: "The user opens app, searches restaurant, selects food, adds to cart, pays, gets confirmation."

Response:
- visual_type: "user_flow", layout: "left_to_right"
- elements: 6 rectangles (📱 Open App, 🔍 Search Restaurant, 🍕 Select Food, 🛒 Add to Cart, 💳 Payment, ✅ Confirmation)
- connections: 5 arrows connecting each step sequentially (e.g., Open App -> Search Restaurant)

Now process the user input:
"""


def summarize_canvas_context(commands: list[VisualCommand]) -> str:
    """Produce a compact semantic summary of current canvas state instead of raw verbose JSON."""
    if not commands:
        return "Canvas is empty."

    summary_lines = []
    for idx, cmd in enumerate(commands, 1):
        summary_lines.append(f"Section {idx} (type: {cmd.visual_type}, layout: {cmd.layout}):")
        if cmd.elements:
            summary_lines.append("  Elements:")
            for el in cmd.elements:
                cat = f" [cat: {el.metadata.category}]" if el.metadata and el.metadata.category else ""
                kind = f" [kind: {el.metadata.kind}]" if el.metadata and el.metadata.kind else ""
                text_preview = (el.text or "").replace("\n", " | ")
                if len(text_preview) > 90:
                    text_preview = text_preview[:87] + "..."
                summary_lines.append(f"    - ID: \"{el.id}\" ({el.type}){kind}{cat} -> \"{text_preview}\"")
        if cmd.connections:
            summary_lines.append("  Connections:")
            for conn in cmd.connections:
                lbl = f" [label: \"{conn.label}\"]" if conn.label else ""
                summary_lines.append(f"    - {conn.from_id} -> {conn.to_id}{lbl}")

    return "\n".join(summary_lines)


def organize_thoughts(request: OrganizeRequest) -> OrganizeResponse:
    """Process user input and generate visual commands."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")

    primary_model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    fallback_models = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.6-flash"]
    models_to_try = [primary_model] + [m for m in fallback_models if m != primary_model]

    client = genai.Client(api_key=api_key)

    # Build prompt with compact semantic canvas context
    if request.current_canvas and len(request.current_canvas) > 0:
        canvas_summary = summarize_canvas_context(request.current_canvas)
        prompt_content = (
            f"Current Canvas State Summary:\n{canvas_summary}\n\n"
            f"User Instruction:\n{request.text}"
        )
    else:
        prompt_content = request.text

    # Add intent/visual type hints if provided
    hints = []
    if request.intent:
        hints.append(f"User intent hint: {request.intent}")
    if request.visual_type:
        hints.append(f"Desired visual type: {request.visual_type}")

    if hints:
        prompt_content = "\n".join(hints) + "\n\n" + prompt_content

    last_err = None
    for model in models_to_try:
        print(f"[GEMINI] Attempting generation with model: {model} ({len(prompt_content)} chars prompt)...")
        try:
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
            print(f"[GEMINI] Raw response received from {model} ({len(raw)} chars):")
            print(raw[:500] + ("..." if len(raw) > 500 else ""))
            if not raw:
                raise ValueError("Gemini returned empty response")

            data = json.loads(raw)
            result = OrganizeResponse.model_validate(data)

            # Add default feedback if not provided
            if not result.assistant_feedback:
                result.assistant_feedback = generate_default_feedback(
                    result.visual_type or "visualization",
                    len(result.commands)
                )

            print(f"[GEMINI] ✅ Parsed {len(result.commands)} visual commands successfully using {model}")
            return result

        except Exception as exc:
            print(f"[GEMINI WARNING] Model {model} failed: {exc}. Trying next candidate...")
            last_err = exc

    raise ValueError(f"All Gemini models failed. Last error: {last_err}") from last_err


def generate_default_feedback(visual_type: str, command_count: int) -> str:
    """Generate default spoken feedback."""
    if command_count == 0:
        return "Created a simple visualization on the canvas."

    visual_names = {
        "brain_dump": "brain dump",
        "flowchart": "flowchart",
        "user_flow": "user flow diagram",
        "architecture": "architecture diagram",
        "process": "process diagram",
        "timeline": "timeline",
        "concept_map": "concept map",
        "mind_map": "mind map",
        "freeform": "visualization",
    }

    vtype = visual_names.get(visual_type, "visualization")

    if command_count == 1:
        return f"Created a {vtype} on the canvas."
    else:
        return f"Created a {vtype} with {command_count} visual elements."
