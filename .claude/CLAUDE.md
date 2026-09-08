# MODIFY THE EXISTING MVP — FREEFORM AI BRAIN-DUMP CANVAS

We already have an MVP for an AI thought organizer.

The current implementation is too focused on automatically generating a node/edge flowchart.

**Change the product direction.**

The application should NOT behave primarily like a flowchart, mind map, or knowledge graph.

It should behave like a **freeform digital whiteboard for brain dumping**, with AI helping the user understand and organize what they put on the canvas.

Think:

> **Excalidraw / tldraw-style infinite canvas + AI thought organization**

The user should be able to freely place text, boxes, circles, arrows, and other simple visual elements wherever they want.

The AI should understand the semantic meaning of those things, but it should NOT force them into a graph.

---

# 1. CORE PRODUCT PRINCIPLE

The most important principle is:

> **The canvas belongs to the user.**

The user decides:

* where things go
* what belongs together
* what is important
* which things are connected
* which things are circled
* which things have arrows
* how the canvas visually represents their thinking

AI should assist, not take control.

Do NOT automatically turn every thought into a flowchart.

Do NOT automatically create relationship arrows between thoughts.

Do NOT automatically reorganize the entire canvas every time the user adds something.

---

# 2. CHANGE THE CANVAS TECHNOLOGY

Remove the conceptual dependency on React Flow for the main visualization.

React Flow is designed primarily around nodes and edges.

That is not the desired interaction model.

Use a **freeform infinite canvas library**.

Preferred choice:

### tldraw

Use tldraw on the React frontend.

The canvas should support the basic primitives needed for a brain dump:

* text
* rectangles
* circles / ellipses
* arrows
* freehand drawing if easy
* selection
* dragging
* resizing where supported
* deletion
* copy/paste if provided naturally
* zoom
* pan
* infinite canvas behavior

Do not implement a canvas engine from scratch.

Do not use Python to render the canvas.

Python/FastAPI remains the backend.

The browser/React application owns the canvas.

---

# 3. FINAL ARCHITECTURE

Use this simple architecture:

```text
                    BROWSER
              React + tldraw
                    │
          ┌─────────┴─────────┐
          │                   │
       Canvas             Input Box
          │                   │
          │              Text / Voice
          │                   │
          └─────────┬─────────┘
                    │
                HTTP API
                    ↓
              FastAPI/Python
                    │
                    ↓
               Gemini API
                    │
                    ↓
          Structured semantic data
                    │
                    ↓
                 React
                    │
                    ↓
             Canvas suggestions
```

The backend should NOT manage canvas rendering.

The backend only handles AI-related operations.

---

# 4. CANVAS IS THE SOURCE OF VISUAL TRUTH

The canvas contains actual visual objects.

For example:

```text
Health & Fitness

       ┌─────────────────────┐
       │ Getting sick often  │
       └─────────────────────┘

       ○ Weak joints

       ○ Allergies

       Gym progress is slow
```

The user may then manually draw:

```text
Getting sick often ─────→ Gym progress
```

The backend does not need to understand that arrow initially.

It is simply a canvas object.

Later, AI can analyze the canvas and infer that the user connected those concepts.

---

# 5. SEMANTIC MODEL

Although the canvas is freeform, each important text element can optionally have semantic metadata.

This is important.

A piece of text should not only be:

```json
{
  "text": "Gym progress is slow"
}
```

It can optionally be:

```json
{
  "text": "Gym progress is slow",
  "kind": "problem",
  "area": "Health & Fitness"
}
```

The semantic metadata is for AI understanding.

It does NOT dictate how the object must visually appear.

---

# 6. NODE / TEXT TYPES

Do not use a complicated ontology.

Start with these simple semantic kinds:

### area

A broad domain of life or thought.

Examples:

* Health & Fitness
* Academics
* Career
* Communication
* Relationships
* Finance
* Entertainment
* Skills

### concern

Something the user is worried about, concerned about, or uncertain about.

Examples:

* Weak joints
* Getting sick frequently
* Not improving fast enough
* Fear of falling behind

### problem

Something the user explicitly identifies as a problem.

Examples:

* Poor gym progress
* Inconsistent studying
* Difficulty communicating

### plan

Something the user wants/intends/plans to do.

Examples:

* Start studying every morning
* Learn Python
* Improve communication

### opinion

A belief, judgment, interpretation, or personal view.

Examples:

* "Everyone is progressing faster than me."
* "I think I'm not disciplined enough."

### observation

Something the user notices or reports without necessarily calling it a problem.

Examples:

* "I've been going to the gym for three years."
* "I get sick when the temperature changes."

### question

A question or uncertainty the user wants to explore.

Examples:

* "Why am I not progressing?"
* "What should I change?"

### note

Fallback category when something doesn't fit the above.

Do not create additional types unless absolutely necessary.

---

# 7. AREA ASSOCIATION

This is important.

A thought can have an association with an area without being physically placed underneath it.

For example:

```text
AREA:
Health & Fitness
```

and:

```text
"Gym progress is slow"
kind = problem
area = Health & Fitness
```

Another:

```text
"People seem to communicate better than me"
kind = concern
area = Communication
```

Another:

```text
"Learn Python"
kind = plan
area = Skills
```

The area relationship is **semantic metadata**, not a mandatory visual hierarchy.

This allows the user to freely arrange the canvas.

---

# 8. MULTIPLE AREA ASSOCIATIONS

A thought may belong to more than one area.

For example:

```text
"Being sick makes it difficult to study consistently."
```

could be:

```json
{
  "kind": "observation",
  "areas": [
    "Health & Fitness",
    "Academics"
  ]
}
```

Do not force the thought into one category.

Use an array:

```json
"areas": []
```

rather than:

```json
"area": ""
```

---

# 9. DO NOT INVENT RELATIONSHIPS

This is critical.

Suppose the user says:

> "I get sick frequently and my gym progress is poor."

Do NOT automatically create:

```text
Getting sick → causes → poor gym progress
```

That is an inference.

Instead, represent them independently:

```text
Getting sick frequently
kind: concern
area: Health & Fitness

Poor gym progress
kind: problem
area: Health & Fitness
```

If the user explicitly says:

> "Getting sick frequently is preventing me from going to the gym."

Then semantic relationship extraction may represent:

```text
Getting sick frequently
        ↓
affects
        ↓
Gym progress
```

But even then, **do not automatically draw the arrow on the canvas unless the user explicitly requests AI-generated connections.**

---

# 10. USER-DRAWN RELATIONSHIPS

If the user manually creates an arrow between two text objects, preserve it.

The frontend should be able to associate the arrow with the objects when practical.

Conceptually:

```json
{
  "source": "text-object-1",
  "target": "text-object-2"
}
```

But this should not be the foundation of the application.

The user should be free to draw arrows anywhere.

An arrow could even point to an empty part of the canvas.

That is valid.

---

# 11. BRAIN-DUMP INPUT

Keep the existing large text input.

The user can type or dictate something like:

> "There are so many things going on. Health is getting worse, I get sick whenever the temperature changes, my joints feel weak, gym progress is slow, I need to improve communication, and I also want to learn Python and system design."

The input goes to:

```text
POST /api/organize
```

Gemini analyzes it.

Instead of returning a graph, return semantic items.

Example:

```json
{
  "items": [
    {
      "id": "item_1",
      "text": "Health",
      "kind": "area",
      "areas": ["Health & Fitness"]
    },
    {
      "id": "item_2",
      "text": "Getting sick when temperature changes",
      "kind": "concern",
      "areas": ["Health & Fitness"]
    },
    {
      "id": "item_3",
      "text": "Weak joints",
      "kind": "concern",
      "areas": ["Health & Fitness"]
    },
    {
      "id": "item_4",
      "text": "Gym progress is slow",
      "kind": "problem",
      "areas": ["Health & Fitness"]
    },
    {
      "id": "item_5",
      "text": "Improve communication",
      "kind": "plan",
      "areas": ["Communication"]
    },
    {
      "id": "item_6",
      "text": "Learn Python",
      "kind": "plan",
      "areas": ["Skills"]
    }
  ]
}
```

---

# 12. AI PLACEMENT

For the MVP, when the user submits a brain dump, the application can place the extracted items on the canvas in a simple initial arrangement.

However:

### DO NOT make it a graph layout.

Instead, use a loose whiteboard arrangement.

For example:

```text
┌─────────────────────────────────────────────────────┐


      HEALTH & FITNESS

      Getting sick often

      Weak joints

      Gym progress is slow



                            COMMUNICATION

                            Improve communication



      SKILLS

      Learn Python

      Learn system design


└─────────────────────────────────────────────────────┘
```

Think of it as AI creating a **first draft of a whiteboard**, not generating a flowchart.

The user can immediately move everything around.

---

# 13. VISUAL ASSOCIATION

Semantic `kind` can optionally influence the visual appearance.

But keep this subtle.

For example:

```text
area       → larger bordered text / heading
problem    → simple sticky note
concern    → another subtle style
plan       → another subtle style
opinion    → plain text
observation → plain text
question   → highlighted text
```

Do NOT create an elaborate design system.

The user should still feel like they are writing on one canvas.

---

# 14. CIRCLES AND GROUPING

The user must be able to select several things and visually group them.

For example:

```text
       ╭─────────────────────────────╮
       │ Health                      │
       │                             │
       │ Getting sick                │
       │ Weak joints                 │
       │ Gym progress                │
       ╰─────────────────────────────╯
```

The user can create the circle/rectangle manually using the canvas.

Do not require the AI to understand every visual grouping in V1.

---

# 15. AI SHOULD BE OPTIONAL

The user should be able to use the application completely manually.

For example:

1. Open blank canvas.
2. Add text.
3. Draw circles.
4. Draw arrows.
5. Move things around.
6. Think.

AI is an assistant.

Not a requirement for using the whiteboard.

---

# 16. VOICE INPUT

Keep the existing browser speech-to-text approach.

Flow:

```text
🎤
 ↓
Browser speech recognition
 ↓
Textarea
 ↓
User edits transcript
 ↓
Organize
```

Do not send audio to Gemini.

Do not build audio infrastructure.

Do not build a speech-processing backend.

---

# 17. GEMINI INTEGRATION

Continue using Gemini API.

Keep:

```env
GEMINI_API_KEY=
```

in `.env.example`.

Use the current official Gemini Python SDK.

The Gemini integration should be isolated in a very small Python module.

Do not build an AI agent framework.

Do not add LangChain.

Do not add LangGraph.

Do not add vector databases.

Do not add embeddings.

Do not add RAG.

None of those are necessary for this MVP.

---

# 18. GEMINI EXTRACTION PROMPT

Use a system instruction along these lines:

```text
You are a semantic thought-organizing assistant.

The user is dumping thoughts onto a personal freeform canvas.

Your job is NOT to create a mind map or flowchart.

Your job is to identify useful pieces of thought and classify them.

Extract only what is actually present in the user's text.

Allowed kinds:

area
concern
problem
plan
opinion
observation
question
note

Definitions:

area:
A broad domain such as Health & Fitness, Academics, Career, Communication, Skills, Finance, Relationships, or Entertainment.

concern:
Something the user is worried about, uncertain about, or concerned about.

problem:
Something the user explicitly describes as a problem, difficulty, obstacle, or failure.

plan:
Something the user wants, intends, or plans to do.

opinion:
A personal belief, interpretation, judgment, or comparison.

observation:
Something the user reports noticing or experiencing without explicitly defining it as a problem.

question:
A question or uncertainty expressed by the user.

note:
A useful piece of information that doesn't fit another category.

Rules:

1. Preserve the user's meaning.
2. Do not diagnose medical or psychological conditions.
3. Do not invent facts.
4. Do not invent causal relationships.
5. Do not turn assumptions into facts.
6. Prefer concise labels.
7. Avoid duplicate items.
8. Do not split one simple thought into unnecessary pieces.
9. A thought may belong to multiple areas.
10. Areas are semantic associations, not visual hierarchy.
11. Do not create relationships unless explicitly stated.
12. Do not provide advice.
13. Return valid JSON only.
14. Do not return markdown.
15. Do not include explanations outside the JSON.

Return:

{
  "items": [
    {
      "id": "unique_id",
      "text": "concise representation of the thought",
      "kind": "area | concern | problem | plan | opinion | observation | question | note",
      "areas": ["area name"]
    }
  ]
}

User input:

{{USER_INPUT}}
```

---

# 19. CANVAS DATA

For the MVP, keep canvas persistence extremely simple.

The canvas library should maintain its own shape/object representation.

Do not immediately build a complicated database model.

If persistence is desired, save the canvas JSON.

Conceptually:

```json
{
  "canvas": {
    "shapes": []
  }
}
```

Semantic metadata can be attached to relevant shapes where supported.

For example:

```json
{
  "text": "Gym progress is slow",
  "kind": "problem",
  "areas": ["Health & Fitness"]
}
```

Do not duplicate the entire canvas model in FastAPI.

---

# 20. DO NOT AUTOMATICALLY SAVE TO A DATABASE

For this MVP:

* no PostgreSQL
* no MongoDB
* no Redis
* no cloud database

If persistence is needed, use browser/local storage or save the canvas JSON locally.

Keep it simple.

---

# 21. THE UI

The interface should be extremely minimal.

Something approximately like:

```text
┌─────────────────────────────────────────────────────────────┐
│  ThoughtCanvas                                  ☀ / ☾       │
│                                                             │
│                                                             │
│                                                             │
│                     FREE CANVAS                             │
│                                                             │
│                                                             │
│                                                             │
│                                                             │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ 🎤  Dump your thoughts here...                    [Organize]│
└─────────────────────────────────────────────────────────────┘
```

The canvas should dominate the screen.

The input should not dominate the screen.

---

# 22. THEME

Support:

* light theme
* dark theme

The canvas should match the selected theme.

Light:

```text
white / very light canvas
dark text
subtle borders
```

Dark:

```text
black / very dark canvas
light text
subtle borders
```

Do not overdesign.

---

# 23. DO NOT BUILD A DASHBOARD

There should NOT be:

* analytics
* charts
* profile pages
* statistics
* productivity scores
* wellness scores
* dashboards
* streaks
* gamification

This is a thinking canvas.

---

# 24. API

Keep FastAPI minimal.

Primary endpoint:

```http
POST /api/organize
```

Request:

```json
{
  "text": "user brain dump"
}
```

Response:

```json
{
  "items": [
    {
      "id": "item_1",
      "text": "Gym progress is slow",
      "kind": "problem",
      "areas": ["Health & Fitness"]
    }
  ]
}
```

Optional:

```http
GET /api/health
```

Nothing else is required for V1.

---

# 25. SIMPLE PROJECT STRUCTURE

Keep the existing structure where possible, but simplify it if necessary.

Preferred:

```text
thought-organizer/
│
├── backend/
│   ├── main.py
│   ├── gemini.py
│   ├── models.py
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Canvas.jsx
│   │   │   ├── ThoughtInput.jsx
│   │   │   └── ThemeToggle.jsx
│   │   └── main.jsx
│   └── package.json
│
└── README.md
```

If the existing project already has a reasonable structure, modify it rather than unnecessarily rewriting everything.

---

# 26. CODE PHILOSOPHY

This remains a personal MVP.

Use:

> **simple + readable + extensible**

Do NOT introduce:

* authentication
* users
* permissions
* databases
* Docker
* microservices
* Redis
* Celery
* WebSockets
* LangChain
* LangGraph
* vector databases
* embeddings
* RAG
* complex state management
* repository/service/controller layers
* complicated design systems
* enterprise architecture

Do not solve problems that don't exist yet.

---

# 27. FUTURE AI FEATURES — DO NOT IMPLEMENT YET

Design the code so these could be added later, but don't build them now.

Possible future features:

### Ask the canvas

> "What are the major areas I'm thinking about?"

### Analyze selected items

> "What do these three things have in common?"

### Find duplicates

> "These two thoughts seem similar. Merge them?"

### Suggest relationships

> "There might be a relationship between these two thoughts. Add it?"

### Organize selection

Select a messy region and say:

> "Organize this."

### AI-generated connections

The user could explicitly ask:

> "Show me possible relationships between these thoughts."

The AI could then suggest arrows that the user accepts/rejects.

### Search

> "Show everything related to academics."

### Timeline

Eventually track how thoughts change over time.

None of this belongs in the current MVP.

---

# 28. SUCCESS CRITERIA

The MVP is successful if I can:

1. Open the application.
2. See a large blank infinite canvas.
3. Type directly onto the canvas.
4. Create text.
5. Create circles/rectangles.
6. Draw arrows.
7. Move things freely.
8. Zoom and pan.
9. Switch between light and dark themes.
10. Speak a brain dump using the microphone.
11. See the transcript before submitting it.
12. Send the brain dump to Gemini.
13. Receive semantic items.
14. Have those items placed loosely on the canvas.
15. See each item optionally classified as:

    * area
    * concern
    * problem
    * plan
    * opinion
    * observation
    * question
    * note
16. Associate items with one or more areas.
17. Continue manually editing the canvas after AI generation.

Most importantly:

> **The resulting canvas must feel like a personal whiteboard/brain dump, NOT like a generated flowchart.**

If a design decision conflicts between "clean graph structure" and "freeform thinking", choose **freeform thinking**.

Build only this MVP.
