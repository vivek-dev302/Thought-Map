# Implementation Plan: Fix 5 Canvas Problems

## Problem Analysis Summary

| # | Problem | Root Cause | Fix Location |
|---|---------|-----------|--------------|
| 1 | **Undo doesn't work** for AI actions | `api.updateScene()` replaces ALL elements atomically; Excalidraw treats it as a single state, destroying undo history | `Canvas.jsx` — save pre-AI state, add Undo AI button |
| 2 | **AI edit/modify is destructive** | `App.jsx` always does `setVisualCommands(data.commands)` (full replace); system prompt lacks modification instructions | `App.jsx` + `gemini.py` system prompt |
| 3 | **User flow diagrams are flat/poor** | System prompt has only 1 trivial 6-step example; layout engine only does flat horizontal; no branching/multi-row support | `gemini.py` system prompt + `Canvas.jsx` layout engine |
| 4 | **Arrows start from top-left corner** | Arrow skeleton sets `x, y` to `fromShape.position.x/y` — identical to block origin; `convertToExcalidrawElements` needs `x:0, y:0` when binding by ID | `Canvas.jsx` arrow creation |
| 5 | **No shape variety** | System prompt doesn't instruct when to use ellipses (start/end), diamonds (decisions), etc. | `gemini.py` system prompt |

---

## Phase 1: Fix Arrow Positioning (Problem 4)

**File:** `Canvas.jsx` lines 321-339

**Root cause:** When using `start: { id }` and `end: { id }` bindings in `convertToExcalidrawElements`, the arrow's own `x, y` becomes an offset/origin. Setting it to the source element's position causes doubling. The correct approach is `x: 0, y: 0` and let Excalidraw compute connection points from the bound element IDs.

**Change:**
```js
// BEFORE
const arrowX = fromShape.position?.x ?? 100;
const arrowY = fromShape.position?.y ?? 100;

// AFTER
const arrowX = 0;
const arrowY = 0;
```

---

## Phase 2: Fix Undo for AI Actions (Problem 1)

**File:** `Canvas.jsx` + `App.jsx`

**Approach:** Save the entire Excalidraw elements array before each AI action. Add an "Undo AI" button that restores the previous state. This is a simple stack-based approach.

1. In `App.jsx`: Add `aiUndoStack` state (array of previous `visualCommands` snapshots)
2. Before `setVisualCommands(data.commands)`, push the current `visualCommands` onto the undo stack
3. Add `handleAiUndo()` that pops the stack and restores previous commands
4. Pass undo capability to Canvas or render an "Undo AI" button in the header
5. In `Canvas.jsx`: When receiving restored commands, apply them the same way

**Stack limit:** Keep max 10 undo states to avoid memory bloat.

---

## Phase 3: System Prompt Overhaul (Problems 2, 3, 5)

**File:** `gemini.py` SYSTEM_PROMPT

### 3a: Shape Conventions for Diagram Types (Problem 5)

Add explicit rules:
```
# Shape Conventions by Diagram Type:

## User Flows & Flowcharts:
- ellipse: Start point ("🟢 Start") and End point ("🔴 End")
- rectangle: Regular action steps
- diamond: Decision points (Yes/No branches)
- note: Annotations or details

## Architecture Diagrams:
- rectangle: System components (Frontend, Backend, DB)
- ellipse: External actors (User, Third-party API)

## Brain Dumps:
- rectangle: Category headers
- note: Thought cards
```

### 3b: Complex User Flow Examples (Problem 3)

Replace the single trivial user flow example with a detailed complex one showing:
- Ellipse for Start/End
- Diamond for decisions with branching
- Multiple paths (happy path + error/alternative)
- Proper sequential connections with labeled decision branches

Add a second example showing a multi-phase flow with vertical sections.

### 3c: Modification/Edit Instructions (Problem 2)

Add explicit rules for modification intent:
```
# MODIFICATION RULES:
When the user wants to MODIFY an existing canvas:
1. PRESERVE all existing elements that are NOT being changed
2. Keep existing element IDs unchanged
3. Only ADD new elements or UPDATE specific ones
4. Re-emit ALL elements (both unchanged and changed) in your response
5. For "add X between Y and Z": keep Y and Z, add X, update connections
6. For "add X": keep everything, add X with connections
7. For "change X to Y": keep everything, change only X's text
```

### 3d: Layout Hints for LLM

Add instructions about relative positioning semantics:
```
# POSITIONING HINTS (optional metadata):
You may include a "row" field in element metadata to suggest vertical grouping.
Row 0 elements appear in the first row, row 1 in the second row, etc.
This is useful for user flows with branching where a decision creates two parallel paths.
```

---

## Phase 4: Layout Engine Improvements (Problem 3)

**File:** `Canvas.jsx`

### 4a: Multi-row User Flow Layout

Replace the flat `left_to_right` layout with a smarter algorithm:
1. Detect if elements have `metadata.row` hints from the LLM
2. If rows exist: lay out elements in a grid (X = column position, Y = row * rowHeight)
3. If no rows: use the existing sequential layout but with improved spacing

### 4b: Improved Element Sizing

- Diamonds need more width (they display text at 45°)
- Ellipses need wider sizing for start/end labels
- Current fixed 330px width is too wide for flow steps — use ~220px for flow steps, ~160px for ellipses/diamonds

### 4c: Decision Branching Support

For flowcharts with diamonds:
- Detect diamond elements
- After a diamond, check if connections branch to 2+ targets
- If branching: place targets on separate rows
- Add "Yes"/"No" labels to branch arrows

---

## Phase 5: Visual Type-Specific Element Sizing

**File:** `Canvas.jsx`

Different diagram types need different default sizes:
- Brain dump notes: 330px wide (current, good)
- User flow steps: 200-240px wide, 70-80px tall
- Architecture components: 240px wide, 80px tall
- Start/End ellipses: 140px wide, 60px tall
- Decision diamonds: 180px wide, 100px tall

---

## Implementation Order

1. **Arrow fix** (Phase 1) — 5 min, biggest visual impact
2. **System prompt overhaul** (Phase 3) — 30 min, fixes problems 2, 3, 5 at the LLM level
3. **Layout engine** (Phase 4, 5) — 20 min, makes user flows look professional
4. **Undo system** (Phase 2) — 15 min, adds safety net

## Files Changed

1. `frontend/src/components/Canvas.jsx` — Arrow fix, layout engine, element sizing
2. `backend/gemini.py` — System prompt overhaul (examples, shape rules, edit rules)
3. `frontend/src/App.jsx` — AI undo stack
