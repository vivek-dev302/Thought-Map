# Build an AI Visual Thinking Canvas from Scratch

You are Claude Code working as the primary architect and developer for this project.

Do **not** immediately start writing code.

First understand the product, reason about the architecture, identify the difficult parts, make an implementation plan, and then implement the project in logical phases.

The goal is to build a general-purpose **AI Visual Thinking Canvas**.

This is NOT primarily a mind-map application.

This is NOT primarily a flowchart generator.

This is NOT primarily a diagram generator.

It is a **freeform visual canvas controlled by natural language and voice**, where the AI understands what the user is trying to express and decides what should be drawn.

---

# 1. PRODUCT VISION

The user should be able to open a blank infinite canvas and say or type essentially anything.

For example:

> "I want to build an app where a student speaks their thoughts and AI organizes them visually."

The AI should understand that this is an idea and may create a conceptual visual representation.

Or:

> "I need a user flow for a food delivery app. The user opens the app, searches for a restaurant, selects food, adds it to cart, pays, and gets an order confirmation."

The AI should infer that the user wants a **user-flow diagram** and create:

```text
Open App
    ↓
Search Restaurant
    ↓
Select Food
    ↓
Add to Cart
    ↓
Payment
    ↓
Order Confirmation
```

with appropriate shapes and arrows.

Or:

> "Show me the architecture for my app. The frontend is React, the backend is FastAPI, the backend talks to Gemini, and data is stored in PostgreSQL."

The AI should infer that an **architecture diagram** is appropriate:

```text
User
  ↓
React Frontend
  ↓
FastAPI Backend
  ├──→ Gemini
  └──→ PostgreSQL
```

with appropriate boxes, labels, arrows, and grouping.

Or:

> "These are the things going on in my mind. Health and fitness, academics, communication, career, and entertainment. Under health I am worried about my joints, getting sick often, and gym progress. Under academics I am worried about my grades and projects."

The AI should NOT force this into a rigid flowchart.

Instead it should create a visually organized freeform canvas with areas, text, groups, circles, relationships where appropriate, etc.

Or:

> "I have an idea for a startup. Users upload a resume, AI analyzes it, finds missing skills, recommends projects, and generates a learning plan."

The AI should determine that this can reasonably be represented as a process/product-flow diagram and draw one.

The important principle is:

**The user describes what they want. The AI decides how to visually represent it.**

---

# 2. CORE PRODUCT PRINCIPLE

The system should follow this conceptual pipeline:

```text
USER
  │
  │ voice or text
  ▼
INPUT / TRANSCRIPT
  │
  ▼
AI INTERPRETATION
  │
  ├── What does the user mean?
  ├── What are they asking for?
  ├── What visual representation fits?
  ├── Which information comes directly from the user?
  ├── What structure can reasonably be inferred?
  ├── What existing canvas objects are relevant?
  └── What changes should be made?
  │
  ▼
STRUCTURED VISUAL COMMAND
  │
  ▼
FRONTEND CANVAS ENGINE
  │
  ▼
EXCALIDRAW
```

The LLM should NEVER directly manipulate pixels.

The LLM should produce a structured representation/command.

The frontend translates that structured representation into actual Excalidraw elements.

---

# 3. VERY IMPORTANT: THINK BEFORE ACTING

Before implementing anything, reason about the following questions:

1. How can one system support:

   * brain dumps
   * flowcharts
   * user flows
   * architecture diagrams
   * timelines
   * concept diagrams
   * business ideas
   * system designs
   * study diagrams
   * workflows
   * brainstorming
   * freeform notes
   * relationship diagrams
   * simple tables
   * sequences
   * plans

2. How can the AI decide which visual representation is appropriate?

3. How can the AI distinguish between:

   * information explicitly provided by the user
   * reasonable structural inference
   * information that would require invention?

4. How can the system avoid hallucinating facts?

5. How can the AI modify an existing canvas instead of recreating everything?

6. How should the frontend expose the current canvas to the AI?

7. How should the AI refer to existing objects?

8. How should undo/redo work for AI actions?

9. How can we keep the system simple enough for an MVP while making the architecture extensible?

10. How can new diagram types be added later without rewriting the whole application?

Think about these questions before implementation.

Do NOT build a giant agent framework.

Do NOT introduce LangChain/LangGraph unless there is a concrete reason.

For the MVP, one strong structured Gemini call with good context is preferable to a complicated multi-agent architecture.

---

# 4. RECOMMENDED HIGH-LEVEL ARCHITECTURE

Use:

## Frontend

* React
* TypeScript
* Excalidraw
* Browser Speech Recognition / Web Speech API where available
* Minimal state management
* Local browser persistence
* Fetch API for backend communication

## Backend

* Python
* FastAPI
* Gemini API
* Pydantic
* Environment variables for configuration

## Storage for MVP

NO database.

Persist the canvas locally in the browser.

Later the architecture should allow:

```text
Browser
    ↓
API
    ↓
Database
```

but do not implement authentication, accounts, PostgreSQL, Redis, etc. now.

---

# 5. WHY EXCALIDRAW

Use Excalidraw as the canvas engine.

The application should treat Excalidraw as the rendering/editor layer.

The application should NOT attempt to build its own drawing engine.

Excalidraw already provides the important user-facing behaviors:

* infinite canvas
* selection
* movement
* resizing
* text
* rectangles
* circles/ellipses
* diamonds
* arrows
* lines
* freehand drawing
* deletion
* zoom
* pan
* undo/redo
* export
* canvas interaction

The AI layer sits above this.

The AI creates structured operations.

The frontend converts them into Excalidraw elements.

---

# 6. MOST IMPORTANT ARCHITECTURAL SEPARATION

Do NOT make Gemini generate raw Excalidraw JSON as its primary interface.

Instead create an application-level intermediate representation.

Call it:

```text
Visual Command Model
```

or:

```text
Canvas Command Model
```

The architecture should look like:

```text
Gemini
   ↓
Application Visual Command Model
   ↓
Command Interpreter
   ↓
Excalidraw Elements
```

This separation is extremely important.

Why?

Because later we may replace Excalidraw.

The AI should not need to know the implementation details of the canvas library.

---

# 7. VISUAL MODEL

Create application-level concepts such as:

```text
VisualElement
VisualConnection
VisualGroup
CanvasCommand
```

A simplified model can look like:

```typescript
type VisualElementType =
  | "text"
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "note"
  | "group";

type VisualConnectionType =
  | "arrow"
  | "line";
```

Each element should have an application-level ID.

Example:

```json
{
  "id": "node_1",
  "type": "rectangle",
  "text": "React Frontend",
  "position": {
    "x": 300,
    "y": 200
  },
  "size": {
    "width": 220,
    "height": 80
  }
}
```

A connection:

```json
{
  "id": "connection_1",
  "type": "arrow",
  "from": "node_1",
  "to": "node_2",
  "label": "HTTP"
}
```

The frontend converts this model into Excalidraw elements.

---

# 8. DO NOT MAKE POSITIONING THE LLM'S MAIN RESPONSIBILITY

The LLM is good at semantics.

It is not the ideal place to calculate every pixel.

The architecture should therefore separate:

```text
SEMANTIC STRUCTURE
```

from:

```text
VISUAL LAYOUT
```

For example, Gemini might return:

```json
{
  "visual_type": "architecture",
  "layout": "hierarchical",
  "elements": [
    {
      "id": "frontend",
      "type": "rectangle",
      "text": "React Frontend"
    },
    {
      "id": "backend",
      "type": "rectangle",
      "text": "FastAPI Backend"
    },
    {
      "id": "gemini",
      "type": "rectangle",
      "text": "Gemini API"
    }
  ],
  "connections": [
    {
      "from": "frontend",
      "to": "backend"
    },
    {
      "from": "backend",
      "to": "gemini"
    }
  ]
}
```

Then the frontend layout engine can decide:

```text
React Frontend
       ↓
FastAPI Backend
       ↓
Gemini API
```

This makes the system much more reliable.

---

# 9. VISUAL TYPES

The system should support a flexible visual type:

```text
freeform
flowchart
user_flow
architecture
process
timeline
sequence
concept_map
brain_dump
mind_map
comparison
table
wireframe
system_diagram
custom_diagram
```

Do NOT make these completely rigid.

They are hints for the renderer/layout engine.

For example:

```json
{
  "visual_type": "user_flow",
  "layout": "left_to_right"
}
```

or:

```json
{
  "visual_type": "architecture",
  "layout": "top_to_bottom"
}
```

or:

```json
{
  "visual_type": "brain_dump",
  "layout": "freeform"
}
```

---

# 10. INTENT CLASSIFICATION

The AI should determine the user's intent.

At minimum support:

```text
create
modify
delete
update
move
connect
disconnect
group
ungroup
rearrange
annotate
explain
question
clear
transform
convert
```

Examples:

### Create

> "Draw the architecture of this application."

Intent:

```json
{
  "intent": "create"
}
```

### Modify

> "Connect the backend to the database."

Intent:

```json
{
  "intent": "connect"
}
```

### Delete

> "Remove the payment step."

Intent:

```json
{
  "intent": "delete"
}
```

### Update

> "Change the backend from Node to FastAPI."

Intent:

```json
{
  "intent": "update"
}
```

### Move

> "Put the database below the backend."

Intent:

```json
{
  "intent": "move"
}
```

### Transform

> "Turn this into a proper architecture diagram."

Intent:

```json
{
  "intent": "transform"
}
```

---

# 11. CURRENT CANVAS CONTEXT

This is one of the most important parts of the system.

The LLM must understand the current canvas when modifying it.

For example, if the canvas currently contains:

```text
React
   ↓
FastAPI
   ↓
PostgreSQL
```

and the user says:

> "Add Redis between the backend and database."

the AI needs to understand what:

```text
backend
database
```

refer to.

Therefore the frontend should create a **semantic canvas snapshot**.

Do NOT blindly send the entire raw Excalidraw JSON if it is unnecessarily huge.

Create a compact representation.

Example:

```json
{
  "canvas": {
    "elements": [
      {
        "id": "node_1",
        "type": "rectangle",
        "text": "React Frontend",
        "position": {
          "x": 100,
          "y": 100
        }
      },
      {
        "id": "node_2",
        "type": "rectangle",
        "text": "FastAPI Backend",
        "position": {
          "x": 100,
          "y": 300
        }
      },
      {
        "id": "node_3",
        "type": "rectangle",
        "text": "PostgreSQL",
        "position": {
          "x": 100,
          "y": 500
        }
      }
    ],
    "connections": [
      {
        "id": "edge_1",
        "from": "node_1",
        "to": "node_2"
      },
      {
        "id": "edge_2",
        "from": "node_2",
        "to": "node_3"
      }
    ]
  }
}
```

The AI can then reference:

```text
node_2
```

instead of guessing.

---

# 12. CANVAS OBJECT IDENTITY

Every application-level object MUST have a stable ID.

Never rely on:

* array indexes
* screen position
* text alone

Use stable IDs such as:

```text
node_001
node_002
edge_001
group_001
```

The AI must use these IDs when modifying the canvas.

This allows commands such as:

```json
{
  "operation": "update_element",
  "target_id": "node_002",
  "changes": {
    "text": "FastAPI Backend"
  }
}
```

---

# 13. VISUAL COMMAND SCHEMA

Create a schema along these lines.

```json
{
  "request_id": "req_123",
  "intent": "create",
  "visual_type": "architecture",
  "layout": {
    "type": "hierarchical",
    "direction": "top_to_bottom"
  },
  "reasoning_summary": "The user is describing a software architecture.",
  "elements": [
    {
      "id": "frontend",
      "type": "rectangle",
      "text": "React Frontend"
    },
    {
      "id": "backend",
      "type": "rectangle",
      "text": "FastAPI Backend"
    }
  ],
  "connections": [
    {
      "id": "connection_1",
      "from": "frontend",
      "to": "backend",
      "type": "arrow",
      "label": ""
    }
  ],
  "groups": [],
  "operations": []
}
```

However, distinguish between:

## Create commands

and:

## Patch commands

For modification, prefer:

```json
{
  "intent": "modify",
  "operations": [
    {
      "operation": "add_element",
      "element": {}
    },
    {
      "operation": "update_element",
      "target_id": "node_2",
      "changes": {}
    },
    {
      "operation": "delete_element",
      "target_id": "node_3"
    },
    {
      "operation": "add_connection",
      "connection": {}
    },
    {
      "operation": "delete_connection",
      "target_id": "edge_2"
    },
    {
      "operation": "move_element",
      "target_id": "node_2",
      "position": {
        "x": 300,
        "y": 400
      }
    }
  ]
}
```

---

# 14. OPERATIONS THE AI SHOULD SUPPORT

At minimum:

```text
add_element
update_element
delete_element

add_connection
update_connection
delete_connection

move_element

resize_element

group_elements
ungroup_elements

add_annotation

clear_canvas

rearrange_canvas
```

Eventually:

```text
duplicate_element
change_style
change_layout
rename_group
merge_elements
split_element
```

But do not implement unnecessary operations for the first MVP.

---

# 15. THE AI SHOULD NOT INVENT USER THOUGHTS

This is extremely important.

Suppose the user says:

> "I am worried about my health, gym progress, and academics."

The AI can organize those statements.

It should NOT invent:

```text
Vitamin deficiency
Poor sleep
Low testosterone
Academic anxiety
Depression
```

unless the user actually mentioned them or explicitly asked the AI to brainstorm possible causes.

The default behavior should be:

**preserve the user's meaning.**

---

# 16. BUT THE AI MAY INFER VISUAL STRUCTURE

There is an important difference between:

```text
inventing information
```

and:

```text
inferring representation
```

For example:

User:

> "User opens app, logs in, creates a project and then invites teammates."

The AI can infer:

```text
rectangle → rectangle → rectangle → rectangle
```

and arrows.

The user did not explicitly say:

> "Use rectangles and arrows."

The AI should infer that because this is a user flow.

That is desired behavior.

---

# 17. USER INFORMATION VS AI KNOWLEDGE

The AI should classify information into three categories internally:

### Explicit

Directly stated by the user.

### Structurally inferred

Necessary or strongly implied for visual representation.

### Knowledge-derived

Information added from general knowledge.

Default behavior:

```text
Explicit → ALWAYS allowed
Structurally inferred → allowed when useful
Knowledge-derived → use cautiously
```

For example:

User:

> "Draw a basic web application architecture."

The AI may know that a typical architecture could contain:

```text
Client
Frontend
Backend
Database
```

But it should not silently invent:

```text
Redis
Kafka
Kubernetes
Load Balancer
Microservices
```

unless relevant or requested.

---

# 18. KNOWLEDGE USAGE RULE

When the user asks:

> "Draw a basic React application architecture."

Use reasonable domain knowledge.

When the user says:

> "These are my personal thoughts..."

Do not enrich them with external assumptions.

When the user says:

> "Design a production-ready architecture for this."

The AI can use domain knowledge more aggressively.

The prompt should therefore tell Gemini:

```text
Infer the level of domain knowledge usage from the user's request.

If the user asks for representation of their own information,
preserve their information.

If the user asks for design, architecture, planning,
explanation, or recommendation, domain knowledge may be used
to fill reasonable structural gaps.

Never present invented assumptions as user-provided facts.
```

---

# 19. EXAMPLE: USER FLOW

User says:

> "Draw a user flow for an e-commerce application. The user opens the app, searches for shoes, selects a product, adds it to cart, checks out and pays."

Expected interpretation:

```json
{
  "intent": "create",
  "visual_type": "user_flow",
  "layout": {
    "type": "linear",
    "direction": "left_to_right"
  }
}
```

Elements:

```text
Open App
Search Shoes
Select Product
Add To Cart
Checkout
Payment
```

Connections:

```text
Open App → Search Shoes
Search Shoes → Select Product
Select Product → Add To Cart
Add To Cart → Checkout
Checkout → Payment
```

Use rectangles with arrows.

---

# 20. EXAMPLE: ARCHITECTURE

User:

> "I want to build a notes application. React frontend, FastAPI backend and PostgreSQL database."

Expected:

```text
┌───────────────────┐
│   React Frontend  │
└─────────┬─────────┘
          ↓
┌───────────────────┐
│   FastAPI Backend │
└─────────┬─────────┘
          ↓
┌───────────────────┐
│    PostgreSQL     │
└───────────────────┘
```

Do NOT turn this into a mind map.

---

# 21. EXAMPLE: FREEFORM BRAIN DUMP

User:

> "I have been thinking about my career. I want to improve coding, communication and system design. I also want to build projects but I keep getting distracted. I am worried that I am learning too many things at once."

The AI should recognize:

```text
brain_dump
```

Possible visual structure:

```text
             Career
                |
      ┌─────────┼─────────┐
      ↓         ↓         ↓
   Coding   Communication  System Design

                |
             Projects
                |
           Distraction

                |
      "Learning too many
          things at once"
```

But it does NOT have to create this exact hierarchy.

A freeform spatial organization is acceptable.

The key is to preserve the user's thoughts rather than forcing a formal diagram.

---

# 22. EXAMPLE: BUSINESS IDEA

User:

> "I have an idea for an app where students upload their resume. AI analyzes it, identifies missing skills, recommends projects, and generates a learning plan."

The AI can infer:

```text
Student
   ↓
Upload Resume
   ↓
AI Analysis
   ↓
Skill Gap Analysis
   ↓
Project Recommendations
   ↓
Learning Plan
```

This is a reasonable inferred process.

---

# 23. EXAMPLE: AMBIGUOUS REQUEST

User:

> "I have this idea for a fitness app."

Do NOT immediately invent a huge architecture.

Instead, determine that the user has provided an idea but not enough information.

Possible behavior:

```json
{
  "intent": "create",
  "visual_type": "freeform",
  "elements": [
    {
      "type": "text",
      "text": "Fitness App Idea"
    }
  ],
  "needs_clarification": true,
  "clarification_question": "What does the fitness app do?"
}
```

However, for MVP, if the AI can make a useful small visual without clarification, it may do so.

---

# 24. EXAMPLE: MODIFY EXISTING CANVAS

Current canvas:

```text
React
  ↓
FastAPI
  ↓
PostgreSQL
```

User:

> "Add Redis between FastAPI and PostgreSQL."

AI should produce:

```text
React
  ↓
FastAPI
  ↓
Redis
  ↓
PostgreSQL
```

The AI should reference existing IDs rather than recreating React and FastAPI.

---

# 25. EXAMPLE: DELETE

User:

> "Remove PostgreSQL."

AI:

```json
{
  "intent": "delete",
  "operations": [
    {
      "operation": "delete_element",
      "target_id": "postgresql"
    }
  ]
}
```

The frontend should also handle connections attached to that element safely.

---

# 26. EXAMPLE: UPDATE

User:

> "Change FastAPI to Node.js."

AI:

```json
{
  "intent": "modify",
  "operations": [
    {
      "operation": "update_element",
      "target_id": "backend",
      "changes": {
        "text": "Node.js Backend"
      }
    }
  ]
}
```

---

# 27. EXAMPLE: REARRANGE

User:

> "Put the database below the backend and move the frontend above it."

The AI should preserve the objects and change their positions/layout.

Do not recreate them unnecessarily.

---

# 28. EXAMPLE: TRANSFORM

User:

> "Turn this brain dump into a proper project plan."

The AI should understand that this is a transformation.

Existing canvas:

```text
Project idea
Problems
Features
Tasks
Questions
```

The AI should reorganize existing information into a project-plan representation.

This should be done through operations against existing objects whenever possible.

---

# 29. EXAMPLE: "MAKE THIS MORE ORGANIZED"

This should NOT mean:

```text
delete everything
generate new diagram
```

Instead:

1. Understand current canvas.
2. Identify existing groups.
3. Detect spatial clutter.
4. Choose an appropriate layout.
5. Rearrange existing elements.
6. Preserve content.
7. Preserve user-created relationships unless clearly wrong.
8. Return movement/grouping/layout operations.

---

# 30. EXAMPLE: "CONNECT THESE"

If the user says:

> "Connect the frontend to the backend."

The AI should search the current semantic canvas for:

```text
frontend
backend
```

Then create an arrow.

If multiple possible objects match, ask for clarification rather than randomly selecting.

---

# 31. EXAMPLE: "CIRCLE THE PROBLEMS"

Suppose objects contain semantic metadata:

```json
{
  "id": "node_4",
  "text": "Gym progress is slow",
  "metadata": {
    "kind": "problem"
  }
}
```

The AI can identify problem objects and create a visual group/ellipse around them.

This demonstrates why semantic metadata is valuable.

---

# 32. SEMANTIC METADATA

Application-level objects should optionally contain metadata:

```json
{
  "kind": "problem",
  "category": "health",
  "tags": [
    "fitness"
  ],
  "source": "user",
  "confidence": 0.95
}
```

Possible `kind` values:

```text
idea
problem
concern
goal
plan
task
question
observation
fact
opinion
person
system
component
step
decision
note
area
unknown
```

Do not force every element to have metadata.

---

# 33. VOICE INPUT

The frontend should have:

```text
🎙 microphone button
```

Flow:

```text
User speaks
    ↓
Browser Speech Recognition
    ↓
Transcript
    ↓
Editable input
    ↓
Send to AI
```

Do NOT make speech recognition part of the backend.

The browser already has access to microphone capabilities.

The transcript should be visible before submission.

The user should be able to edit it.

Example:

```text
┌───────────────────────────────────────────────┐
│ Draw a user flow for a food delivery app...  │
└───────────────────────────────────────────────┘

              🎙   [Visualize]
```

---

# 34. AI REQUEST API

Create something like:

```http
POST /api/visualize
```

Request:

```json
{
  "message": "Draw a user flow for a food delivery app.",
  "canvas": {
    "elements": [],
    "connections": []
  },
  "selection": [],
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  }
}
```

Response:

```json
{
  "success": true,
  "command": {
    "...": "..."
  }
}
```

---

# 35. OPTIONAL FUTURE API SEPARATION

Keep the backend architecture easy to extend:

```text
/api/visualize
/api/explain
/api/summarize
```

But only implement `/api/visualize` initially.

Do not over-engineer the API.

---

# 36. BACKEND ARCHITECTURE

Use a structure similar to:

```text
backend/
│
├── app/
│   ├── main.py
│   │
│   ├── api/
│   │   └── visualize.py
│   │
│   ├── models/
│   │   ├── requests.py
│   │   └── visual_commands.py
│   │
│   ├── services/
│   │   ├── gemini_service.py
│   │   ├── prompt_service.py
│   │   └── canvas_context.py
│   │
│   └── core/
│       └── config.py
│
├── tests/
│
├── requirements.txt
└── .env.example
```

Keep it simple.

---

# 37. GEMINI SERVICE

Create a dedicated Gemini service.

Conceptually:

```python
class GeminiService:

    async def interpret_visual_request(
        self,
        user_message,
        canvas_context
    ):
        ...
```

Do not put Gemini API calls directly inside FastAPI route handlers.

---

# 38. PROMPT ARCHITECTURE

The Gemini prompt should have clear sections.

For example:

```text
SYSTEM ROLE

You are a visual thinking assistant.

Your job is to interpret natural language and convert it
into structured visual canvas operations.

CORE PRINCIPLES

1. Preserve user meaning.
2. Infer visual structure.
3. Do not invent facts.
4. Use domain knowledge when appropriate.
5. Understand the current canvas.
6. Modify existing objects when appropriate.
7. Prefer minimal changes for modification requests.
8. Never return explanations instead of the required schema.
9. Return valid structured output.
10. Ask for clarification when ambiguity materially affects the result.

USER REQUEST

...

CURRENT CANVAS

...

CURRENT SELECTION

...

OUTPUT SCHEMA

...
```

---

# 39. SYSTEM PROMPT FOR GEMINI

Create a strong system prompt along these lines:

```text
You are an AI visual thinking assistant.

The user communicates with you using natural language or speech.

Your job is to understand what the user is trying to accomplish
and translate their request into structured visual operations.

You control the meaning and structure of the requested visualization,
but you do not directly control pixels.

The frontend will convert your output into visual canvas elements.

Your responsibilities:

1. Understand the user's intent.
2. Determine whether the user wants:
   - a freeform thought dump
   - a diagram
   - a flow
   - architecture
   - planning
   - transformation
   - editing
   - deletion
   - rearrangement
   - connection
   - annotation
   - explanation
   - or another visual representation.
3. Select an appropriate visual representation.
4. Extract explicit information from the user's request.
5. Infer reasonable visual structure when appropriate.
6. Use domain knowledge when the user is asking for design,
   architecture, planning, explanation, or similar tasks.
7. Do not invent personal/user-provided facts.
8. Distinguish explicit information from inferred structure.
9. Understand the current canvas.
10. Reuse existing elements when modifying the canvas.
11. Use stable IDs for existing objects.
12. Make the smallest reasonable modification when the user
    asks to modify something.
13. Never destroy existing information unless the user asks
    for deletion or transformation that clearly requires it.
14. Return only the structured command object.
15. Follow the provided schema exactly.

The canvas is the user's workspace.

The user's explicit information has priority over assumptions.

When the user describes their own thoughts, preserve them.

When the user asks you to design something, you may use
reasonable domain knowledge to complete the visual structure.

Do not silently turn assumptions into facts.

For ambiguous requests, either create a conservative useful
visualization or indicate that clarification is required.

Do not produce a traditional mind map unless the user asks
for one or the request naturally calls for one.

Do not force every request into the same diagram type.

Choose the visual representation that best matches the user's intent.
```

---

# 40. LLM SHOULD UNDERSTAND VISUAL LANGUAGE

The prompt should explicitly teach Gemini that users may describe visuals indirectly.

Examples:

> "Put this above that."

means:

```text
move_element
```

> "Connect A to B."

means:

```text
add_connection
```

> "Put these together."

may mean:

```text
group_elements
```

> "Make this a flow."

means:

```text
transform → flow
```

> "Make this cleaner."

means:

```text
rearrange_canvas
```

> "Circle these."

means:

```text
add visual grouping / annotation
```

> "Remove this."

means:

```text
delete_element
```

> "Change this to X."

means:

```text
update_element
```

---

# 41. LAYOUT STRATEGY

Create a frontend layout service.

Example:

```text
frontend/src/
├── canvas/
│   ├── Canvas.tsx
│   ├── commandExecutor.ts
│   ├── layoutEngine.ts
│   ├── semanticSnapshot.ts
│   └── excalidrawAdapter.ts
```

The layout engine should understand:

```text
linear
left_to_right
top_to_bottom
hierarchical
radial
grid
freeform
```

Initially implement only:

```text
freeform
left_to_right
top_to_bottom
```

Do not build a sophisticated graph layout algorithm unless required.

Simple deterministic positioning is enough for the MVP.

---

# 42. EXCALIDRAW ADAPTER

Create a clear boundary:

```text
Application Visual Model
        ↓
Excalidraw Adapter
        ↓
Excalidraw Elements
```

For example:

```typescript
visualElementToExcalidrawElement()
visualConnectionToExcalidrawArrow()
```

The rest of the application should not depend heavily on Excalidraw's internal representation.

---

# 43. COMMAND EXECUTOR

Create:

```text
commandExecutor.ts
```

Responsibilities:

```text
execute(command)
```

It should:

1. validate command
2. resolve IDs
3. create new elements
4. update existing elements
5. delete elements
6. create connections
7. delete connections
8. move elements
9. apply layout
10. update Excalidraw

---

# 44. ATOMIC AI ACTIONS

Every AI request should ideally produce one logical action batch.

Example:

```text
User:
"Add Redis between backend and PostgreSQL."
```

AI:

```text
Operation 1: add Redis
Operation 2: delete Backend → PostgreSQL
Operation 3: add Backend → Redis
Operation 4: add Redis → PostgreSQL
```

The frontend applies the entire command as one logical action.

This makes AI undo much easier.

---

# 45. AI UNDO

This is important.

If the user says:

> "Undo that."

the application should ideally support:

```text
AI action history
```

For MVP, you can rely on Excalidraw's undo/redo if the modifications are applied as a coherent action.

But design the command executor so AI actions can later be tracked:

```typescript
{
  actionId: "ai_action_123",
  beforeState: ...,
  afterState: ...
}
```

Do not necessarily persist this to a database yet.

---

# 46. FRONTEND STATE

Maintain:

```text
canvas state
selected elements
current transcript
AI loading state
AI error state
AI action history
```

Do not duplicate the entire canvas state unnecessarily.

Excalidraw should remain the authoritative visual editor.

The semantic snapshot is derived from the current canvas.

---

# 47. LOCAL PERSISTENCE

For MVP:

```text
localStorage
```

or IndexedDB if necessary.

Save:

```text
Excalidraw scene
```

and optionally:

```text
semantic metadata
```

The user should be able to refresh the page without losing the canvas.

Do NOT add user accounts yet.

---

# 48. UI

Keep the UI extremely simple.

Main layout:

```text
┌───────────────────────────────────────────────┐
│ AI Visual Canvas                              │
│                                               │
│                                               │
│                 CANVAS                        │
│                                               │
│                                               │
│                                               │
│                                               │
│                                               │
│                                               │
├───────────────────────────────────────────────┤
│ 🎙  Tell me what to draw...        [Visualize]│
└───────────────────────────────────────────────┘
```

The canvas should dominate the screen.

Do not build:

* dashboard
* authentication
* settings page
* profile
* complex sidebar
* database UI
* project management system

unless required for functionality.

---

# 49. OPTIONAL AI STATUS

Show a small status such as:

```text
Understanding...
Designing visualization...
Applying changes...
```

Do not expose chain-of-thought.

Never display internal reasoning.

Only display concise user-facing status.

---

# 50. ERROR HANDLING

If Gemini returns invalid structured output:

1. validate it
2. reject it
3. optionally perform one repair/retry
4. show a useful error

Do NOT blindly execute malformed commands.

Use Pydantic validation on the backend.

Use TypeScript validation on the frontend where appropriate.

---

# 51. SECURITY

MVP security should remain simple but:

* Gemini API key MUST remain on backend.
* Never expose Gemini API key to browser.
* Use environment variables.
* Validate request sizes.
* Validate structured LLM responses.
* Do not execute arbitrary code returned by the LLM.
* Treat all LLM output as data.

The LLM must only return structured commands.

Never allow the LLM to send JavaScript that the frontend executes.

---

# 52. NO CODE EXECUTION BY LLM

This is a hard requirement.

Bad architecture:

```text
Gemini → JavaScript → execute JavaScript
```

Good architecture:

```text
Gemini
 ↓
JSON command
 ↓
validated command
 ↓
known command executor
 ↓
canvas
```

---

# 53. STRUCTURED OUTPUT

Use Gemini's structured output / JSON schema capabilities where available.

Do not depend on:

```text
"Please return JSON."
```

alone.

Define a real schema.

The backend should validate the result.

---

# 54. PYDANTIC SCHEMA

Create Pydantic models corresponding to:

```text
VisualCommand
VisualElement
VisualConnection
VisualOperation
LayoutSpec
```

For example:

```python
class VisualElement(BaseModel):
    id: str
    type: Literal[
        "text",
        "rectangle",
        "ellipse",
        "diamond",
        "note",
        "group"
    ]
    text: str | None = None
```

Do not overcomplicate the models.

---

# 55. TYPESCRIPT TYPES

Create matching frontend types.

The backend and frontend should agree on the same conceptual contract.

Do not duplicate schemas manually if a practical way exists to generate or share them later, but for the MVP keeping synchronized TypeScript/Pydantic models is acceptable.

---

# 56. CURRENT CANVAS CONTEXT FORMAT

Create a function:

```typescript
buildCanvasContext()
```

It should extract:

```text
element IDs
element type
text
position
size
relationships
semantic metadata
selection
```

Example:

```json
{
  "elements": [
    {
      "id": "frontend",
      "type": "rectangle",
      "text": "React Frontend",
      "x": 100,
      "y": 100,
      "width": 200,
      "height": 80
    }
  ],
  "connections": []
}
```

---

# 57. SELECTION CONTEXT

If the user selects an element and says:

> "Change this to Node.js."

the frontend should send the selected IDs.

Example:

```json
{
  "selection": [
    "backend_node"
  ]
}
```

The AI should prioritize the selected object.

This is extremely useful for natural interaction.

---

# 58. VIEWPORT CONTEXT

Send viewport information when useful:

```json
{
  "viewport": {
    "x": 100,
    "y": 200,
    "zoom": 1.2
  }
}
```

The frontend can use this to place newly created content near the user's current working area.

---

# 59. WHERE NEW OBJECTS SHOULD APPEAR

For a new request:

```text
"Add a database."
```

the system should preferably place the new object:

1. near related objects
2. within the current visible area
3. without overlapping existing objects

The layout engine, not the LLM, should primarily solve this.

---

# 60. AVOID OVERLAPPING OBJECTS

Implement basic collision avoidance.

If creating:

```text
A
B
C
D
```

do not put all four at:

```text
x=0
y=0
```

Use simple spacing.

Example:

```text
horizontal gap = 100
vertical gap = 80
```

Exact values can be tuned.

---

# 61. VISUAL STYLE

Use Excalidraw's natural hand-drawn visual style.

Do not attempt to make the AI invent arbitrary CSS styles.

Instead define a small application style system:

```text
default
emphasis
success
warning
problem
system
```

Optional semantic metadata can influence styling.

Example:

```text
problem → subtle highlighted box
goal → emphasized shape
system component → normal rectangle
```

But do not over-style the MVP.

---

# 62. DO NOT OVER-SPECIFY DIAGRAMS

The AI should not be told:

> "Every diagram must contain rectangles and arrows."

Instead:

```text
Choose appropriate visual primitives based on the user's request.
```

Examples:

### User flow

Usually:

```text
rectangles + arrows
```

### Decision flow

Usually:

```text
diamonds + arrows
```

### Architecture

Usually:

```text
containers + components + connections
```

### Brain dump

Usually:

```text
text + groups + freeform spatial placement
```

### Timeline

Usually:

```text
line + labels + points
```

### Comparison

Usually:

```text
columns/cards/table-like structure
```

---

# 63. DIAGRAM-SPECIFIC KNOWLEDGE

The prompt should tell the AI:

```text
If the user explicitly requests a diagram type,
respect its conventions.

If the user does not specify a diagram type,
infer one from the semantic intent.

If multiple representations are reasonable,
choose the simplest representation that communicates the user's intent.
```

---

# 64. GENERAL PURPOSE BEHAVIOR

The system should be able to handle requests such as:

```text
"Draw my weekly study plan."

"Show the architecture of this backend."

"Create a user flow for signup."

"Visualize how a request moves through my system."

"Dump these thoughts onto the canvas."

"Organize these problems."

"Group these three things."

"Connect the frontend to the backend."

"Remove the payment step."

"Move this below that."

"Make this easier to understand."

"Turn this into a flowchart."

"Turn this flowchart into a simple architecture."

"Show the relationships between these concepts."

"Make a timeline."

"Draw a decision tree."

"Create a project plan."

"Visualize my startup idea."

"Show how these components interact."

"Circle all the problems."

"Highlight the goals."

"Put all technical components together."

"Clean this diagram up."

"Add a database."

"Replace MongoDB with PostgreSQL."

"Explain this diagram."
```

The system should not need a separate hard-coded route for every sentence.

---

# 65. IMPORTANT: DO NOT BUILD A GIANT INTENT ROUTER

Do NOT write:

```python
if "architecture" in text:
    ...
elif "flowchart" in text:
    ...
elif "brain dump" in text:
    ...
```

This would defeat the purpose of using an LLM.

Instead:

```text
User request
      ↓
Gemini
      ↓
Structured semantic command
      ↓
deterministic frontend executor
```

The LLM handles language understanding.

The frontend handles deterministic rendering.

---

# 66. AI SHOULD HAVE ACCESS TO CANVAS SEMANTICS

Do not only send:

```text
"there are 20 shapes."
```

Send meaningful information:

```text
node_1 = React Frontend
node_2 = FastAPI Backend
node_3 = PostgreSQL
edge_1 = node_1 → node_2
edge_2 = node_2 → node_3
```

This lets the AI reason over the canvas.

---

# 67. FUTURE EXTENSION: CANVAS QUERY

Design the architecture so eventually the user can ask:

> "What are the main problems on this canvas?"

or:

> "Explain this architecture."

or:

> "What is missing?"

The same semantic canvas representation can support this.

Do not necessarily implement this in the first MVP.

But keep the architecture compatible with it.

---

# 68. FUTURE EXTENSION: MULTI-TURN CONVERSATION

Eventually:

```text
User:
Draw an architecture for my app.

AI:
creates architecture

User:
Make the backend serverless.

AI:
modifies architecture

User:
Actually use FastAPI.

AI:
modifies it again

User:
Now show the request flow.

AI:
transforms the current architecture into a request-flow visualization.
```

The canvas itself should remain the primary persistent context.

Do not rely only on chat history.

---

# 69. FUTURE EXTENSION: CHAT PANEL

The application may eventually contain:

```text
┌──────────────┬─────────────────────────────┐
│ AI CHAT      │                             │
│              │                             │
│ User         │          CANVAS             │
│ AI           │                             │
│              │                             │
└──────────────┴─────────────────────────────┘
```

But the MVP can use only the bottom command bar.

Do not build a large chat interface unless useful.

---

# 70. FUTURE EXTENSION: STREAMING

Later Gemini responses may stream.

The architecture should not prevent this.

But for MVP:

```text
request → response → execute
```

is sufficient.

---

# 71. FUTURE EXTENSION: MULTIMODAL

Later the user might say:

> "Look at this screenshot and recreate the architecture."

or:

> "Convert this image into a diagram."

The architecture should allow multimodal input later.

Do not implement it now.

---

# 72. FUTURE EXTENSION: IMAGES

Eventually support:

```text
"Add this screenshot to the canvas."

"Put this logo beside the component."

"Draw an annotation around this image."
```

Do not implement unless easy.

---

# 73. FUTURE EXTENSION: DOMAIN-SPECIFIC DIAGRAMS

The architecture should eventually support:

```text
UML
ER diagrams
sequence diagrams
network diagrams
AWS architectures
cloud architectures
database schemas
API diagrams
wireframes
organizational charts
study maps
```

Do not implement all these now.

The visual command model should be extensible enough to support them.

---

# 74. MVP SCOPE

The first working version must support:

### Canvas

* Excalidraw
* freeform editing
* text
* rectangles
* circles
* arrows
* selection
* move
* resize
* delete
* zoom
* pan
* undo/redo

### Input

* text
* microphone
* speech-to-text

### AI

* Gemini
* structured output
* current canvas context
* intent inference
* diagram type inference
* semantic extraction
* visual command generation

### AI actions

* create
* add
* update
* delete
* connect
* move
* rearrange
* transform

### Visual modes

At minimum:

```text
freeform / brain dump
user flow
flowchart
architecture
process
timeline
concept diagram
```

---

# 75. WHAT NOT TO BUILD

Do NOT build:

* authentication
* user accounts
* billing
* teams
* collaboration
* WebSockets
* database
* Redis
* queues
* microservices
* Kubernetes
* LangChain
* LangGraph
* vector database
* RAG
* MCP
* complicated agent framework
* complex state management
* analytics
* admin dashboard

unless the implementation discovers a genuine technical requirement.

This is an MVP.

---

# 76. PROJECT STRUCTURE

Prefer something approximately like:

```text
project/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas.tsx
│   │   │   ├── CommandBar.tsx
│   │   │   ├── VoiceButton.tsx
│   │   │   └── AIStatus.tsx
│   │   │
│   │   ├── canvas/
│   │   │   ├── commandExecutor.ts
│   │   │   ├── layoutEngine.ts
│   │   │   ├── semanticSnapshot.ts
│   │   │   └── excalidrawAdapter.ts
│   │   │
│   │   ├── services/
│   │   │   └── api.ts
│   │   │
│   │   ├── types/
│   │   │   └── visual.ts
│   │   │
│   │   └── App.tsx
│   │
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   └── visualize.py
│   │   ├── models/
│   │   │   ├── requests.py
│   │   │   └── visual_commands.py
│   │   ├── services/
│   │   │   ├── gemini_service.py
│   │   │   └── prompt_service.py
│   │   └── core/
│   │       └── config.py
│   │
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
│
└── README.md
```

Adjust this if your implementation experience indicates a better structure, but keep the same separation of responsibilities.

---

# 77. ENVIRONMENT VARIABLES

Backend:

```text
GEMINI_API_KEY=
```

Frontend:

```text
VITE_API_URL=http://localhost:8000
```

Do not expose:

```text
GEMINI_API_KEY
```

to the frontend.

---

# 78. TESTING STRATEGY

Before considering the MVP complete, manually test at least these cases.

### Test 1

Input:

> "Draw a user flow for signup: open app, enter email, verify email, create password, finish signup."

Expected:

Flow with steps and arrows.

### Test 2

Input:

> "Draw an architecture for React frontend, FastAPI backend and PostgreSQL."

Expected:

Architecture diagram.

### Test 3

Input:

> "These are my thoughts: career, coding, communication, gym, academics, distraction."

Expected:

Freeform thought visualization.

### Test 4

First:

> "Draw React → FastAPI → PostgreSQL."

Then:

> "Add Redis between FastAPI and PostgreSQL."

Expected existing objects modified rather than duplicated.

### Test 5

Then:

> "Remove Redis."

Expected Redis removed and connections repaired.

### Test 6

Then:

> "Move PostgreSQL below the backend."

Expected PostgreSQL repositioned.

### Test 7

Then:

> "Change FastAPI to Node.js."

Expected only the relevant object updated.

### Test 8

Then:

> "Connect Node.js to PostgreSQL."

Expected an arrow.

### Test 9

Input:

> "Make this more organized."

Expected rearrangement, not destruction.

### Test 10

Input:

> "Circle all the problems."

Expected visual grouping/annotation around problem elements where semantic metadata allows identification.

---

# 79. QUALITY BAR

The most important quality requirement is not visual beauty.

It is:

```text
USER INTENT → CORRECT VISUAL REPRESENTATION
```

The application should feel like:

> "I tell it what I want to see, and it draws it."

not:

> "I have to explain exactly which boxes and arrows I want."

---

# 80. DO NOT CONFUSE "GENERAL PURPOSE" WITH "UNSTRUCTURED"

The application should be general-purpose at the semantic level.

The internal architecture should still be structured.

Use:

```text
natural language
      ↓
semantic interpretation
      ↓
visual command model
      ↓
deterministic rendering
```

This gives us both:

```text
flexibility
```

and:

```text
reliability
```

---

# 81. IMPORTANT DESIGN PRINCIPLE

The AI should decide:

```text
WHAT should exist
WHY it should exist
HOW elements relate
WHAT visual representation fits
```

The frontend should decide:

```text
HOW those things are rendered
WHERE they are positioned
HOW IDs are maintained
HOW edits are applied
HOW undo/redo works
```

This separation must be preserved.

---

# 82. IMPLEMENTATION PHASES

Do not attempt to implement everything simultaneously.

Use these phases.

## Phase 1 — Canvas

Get Excalidraw working.

Verify:

* rendering
* text
* shapes
* arrows
* selection
* movement
* deletion
* persistence

## Phase 2 — Application visual model

Create:

```text
VisualElement
VisualConnection
VisualCommand
```

and adapters.

## Phase 3 — Basic AI

Implement:

```text
POST /api/visualize
```

with Gemini.

Start with:

```text
create
```

only.

## Phase 4 — Diagram inference

Support:

```text
freeform
user_flow
flowchart
architecture
timeline
```

## Phase 5 — Canvas context

Send semantic representation of current canvas to Gemini.

## Phase 6 — Modification

Implement:

```text
add
update
delete
connect
move
rearrange
```

## Phase 7 — Voice

Add speech recognition.

## Phase 8 — Polish

Improve:

* layout
* error handling
* loading states
* persistence
* prompt quality
* command validation

---

# 83. BEFORE CODING

Before writing implementation code, produce a concise internal project plan containing:

1. Architecture
2. Data flow
3. Frontend components
4. Backend components
5. Gemini interaction
6. Visual command schema
7. Canvas context strategy
8. Layout strategy
9. AI prompt strategy
10. Implementation phases
11. Risks
12. Simplifications for MVP

Then begin implementation.

Do not spend excessive time planning theoretical future systems.

The plan must lead directly to a working MVP.

---

# 84. WHEN MAKING ARCHITECTURAL DECISIONS

Prefer:

```text
simple
deterministic
extensible
debuggable
```

over:

```text
abstract
distributed
over-engineered
```

If a problem can be solved with 100 lines of straightforward code, do not introduce a framework requiring 1,000 lines.

---

# 85. DEBUGGING REQUIREMENT

When debugging AI behavior, make it possible to inspect:

```text
USER INPUT
CURRENT CANVAS CONTEXT
LLM OUTPUT
VALIDATION RESULT
EXECUTED OPERATIONS
```

During development, these can be logged.

Do not log API keys.

---

# 86. AI RESPONSE VALIDATION

Never assume Gemini returned valid output.

Pipeline:

```text
Gemini response
      ↓
parse
      ↓
Pydantic validation
      ↓
semantic validation
      ↓
command executor
      ↓
canvas
```

Semantic validation should check things such as:

```text
Does referenced element exist?
Does connection source exist?
Does connection target exist?
Is operation type supported?
Are IDs valid?
```

---

# 87. PARTIAL FAILURE

If an AI command contains:

```text
10 operations
```

and operation 7 is invalid, do not leave the canvas in an inconsistent state.

Prefer:

```text
validate entire command
      ↓
if valid
      ↓
execute
```

For MVP, reject the entire command if validation fails.

---

# 88. NO DIRECT EXCALIDRAW JSON FROM GEMINI

This rule is important enough to repeat.

Gemini should NOT return:

```text
raw Excalidraw scene JSON
```

as the main contract.

Gemini returns:

```text
application-level visual commands
```

The adapter handles Excalidraw.

---

# 89. FINAL PRODUCT MENTAL MODEL

Think of the system as:

```text
                 ┌─────────────────────┐
                 │       USER          │
                 │ voice / text        │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │  INTENT + CONTEXT   │
                 │                     │
                 │ user request        │
                 │ current canvas      │
                 │ selected objects    │
                 │ viewport            │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │       GEMINI        │
                 │                     │
                 │ understand          │
                 │ infer               │
                 │ choose visual type  │
                 │ create commands     │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │ VISUAL COMMAND      │
                 │ MODEL               │
                 │                     │
                 │ add                 │
                 │ update              │
                 │ delete              │
                 │ connect             │
                 │ move                │
                 │ rearrange           │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │ COMMAND EXECUTOR    │
                 │                     │
                 │ validate            │
                 │ resolve IDs         │
                 │ layout              │
                 │ apply operations    │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │     EXCALIDRAW      │
                 │                     │
                 │ freeform canvas     │
                 │ shapes              │
                 │ arrows              │
                 │ text                │
                 │ groups              │
                 │ drawings            │
                 └─────────────────────┘
```

---

# 90. THE ONE-SENTENCE PRODUCT DEFINITION

Keep this in mind throughout implementation:

> **An AI-powered visual thinking canvas where the user can say what they want to see, and the AI interprets the request, chooses an appropriate visual representation, and safely creates or modifies the canvas.**

The product should feel like:

> "Draw whatever I'm trying to explain."

not:

> "Fill out this diagram template."

---

# 91. FINAL INSTRUCTION TO CLAUDE CODE

Do not blindly follow this specification if you discover a concrete technical problem.

Before changing a major architectural decision:

1. identify the problem,
2. explain the issue,
3. propose the simpler alternative,
4. preserve the core product principles.

The most important principles are:

```text
1. Freeform canvas first.
2. Natural language/voice first.
3. AI understands intent.
4. AI chooses appropriate visual representation.
5. AI can use reasonable domain knowledge.
6. AI must not invent user facts.
7. AI receives current canvas context.
8. AI modifies existing objects instead of unnecessarily recreating them.
9. LLM returns structured commands, not executable code.
10. Frontend deterministically executes commands.
11. Excalidraw is the rendering/editor layer.
12. No unnecessary backend complexity.
13. No unnecessary agent frameworks.
14. Keep the architecture extensible.
15. Build a working MVP before adding advanced features.
```

Start by inspecting the environment and dependencies.

Then produce your implementation plan.

Then implement Phase 1 and progressively move through the phases.

After each major phase, verify that the application still runs before continuing.
