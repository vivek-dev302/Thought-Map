"""
Visual Command Model based on new CLAUDE.md architecture

The AI produces structured visual commands that the frontend
converts to Excalidraw elements. This is an application-level
intermediate representation, not raw Excalidraw JSON.
"""

from typing import Literal, Optional, List
from pydantic import BaseModel, Field


# --- Visual Types ---
VisualType = Literal[
    "brain_dump",
    "flowchart",
    "user_flow",
    "architecture",
    "process",
    "timeline",
    "sequence",
    "concept_map",
    "mind_map",
    "comparison",
    "table",
    "wireframe",
    "system_diagram",
    "custom_diagram",
    "freeform",
]

LayoutType = Literal[
    "freeform",
    "left_to_right",
    "top_to_bottom",
    "hierarchical",
    "radial",
    "grid",
    "timeline",
    "cluster",
]

# --- Intent Classification ---
IntentType = Literal[
    "create",
    "modify",
    "delete",
    "update",
    "move",
    "connect",
    "disconnect",
    "group",
    "ungroup",
    "rearrange",
    "annotate",
    "explain",
    "question",
    "clear",
    "transform",
    "convert",
]

# --- Element Types ---
ElementType = Literal[
    "text",
    "rectangle",
    "ellipse",
    "diamond",
    "note",
    "group",
]

ConnectionType = Literal["arrow", "line"]


# --- Core Models ---
class Position(BaseModel):
    """2D position on canvas"""
    x: float = Field(default=0.0, description="X coordinate")
    y: float = Field(default=0.0, description="Y coordinate")


class Size(BaseModel):
    """Element size"""
    width: float = Field(default=200.0, description="Width in pixels")
    height: float = Field(default=80.0, description="Height in pixels")


class Style(BaseModel):
    """Visual style properties"""
    stroke_color: Optional[str] = Field(default=None, description="Stroke color hex")
    background_color: Optional[str] = Field(default=None, description="Fill color hex")
    font_size: Optional[int] = Field(default=20, description="Font size")
    font_family: Optional[str] = Field(default="Virgil", description="Font family")
    stroke_width: Optional[float] = Field(default=2.0, description="Stroke width")
    opacity: Optional[float] = Field(default=100.0, description="Opacity percentage")


class ElementMetadata(BaseModel):
    """Semantic metadata for elements"""
    kind: Optional[str] = Field(default=None, description="Semantic kind (idea, problem, goal, step, component, etc.)")
    category: Optional[str] = Field(default=None, description="Category name")


class VisualElement(BaseModel):
    """A visual element on the canvas"""
    id: str = Field(description="Unique identifier for this element")
    type: ElementType = Field(description="Type of visual element")
    text: Optional[str] = Field(default="", description="Text content (for text/note elements)")
    position: Optional[Position] = Field(default_factory=lambda: Position(), description="Position on canvas")
    size: Optional[Size] = Field(default_factory=lambda: Size(), description="Element size")
    style: Optional[Style] = Field(default_factory=lambda: Style(), description="Visual style")
    metadata: Optional[ElementMetadata] = Field(default=None, description="Additional semantic metadata")


class VisualConnection(BaseModel):
    """A connection/relationship between elements"""
    from_id: str = Field(description="Source element ID")
    to_id: str = Field(description="Target element ID")
    type: ConnectionType = Field(default="arrow", description="Connection type")
    label: Optional[str] = Field(default="", description="Connection label/text")
    style: Optional[Style] = Field(default_factory=lambda: Style(), description="Visual style")


class VisualCommand(BaseModel):
    """A complete visual command representing what to draw"""
    visual_type: VisualType = Field(default="freeform", description="Type of visual representation")
    layout: LayoutType = Field(default="freeform", description="Layout strategy")
    intent: IntentType = Field(default="create", description="User intent")
    elements: List[VisualElement] = Field(default_factory=list, description="Elements to create/modify")
    connections: List[VisualConnection] = Field(default_factory=list, description="Connections between elements")
    groups: List[List[str]] = Field(default_factory=list, description="Element IDs grouped together")


# --- Request/Response Models ---
class OrganizeRequest(BaseModel):
    """Request to organize/visualize user input"""
    text: str = Field(description="User input text")
    intent: Optional[str] = Field(default=None, description="User intent (optional)")
    visual_type: Optional[VisualType] = Field(default=None, description="Desired visual type (optional)")
    current_canvas: Optional[List[VisualCommand]] = Field(
        default_factory=list, description="Current canvas state (for modifications)"
    )


class OrganizeResponse(BaseModel):
    """Response containing visual commands"""
    commands: List[VisualCommand] = Field(default_factory=list, description="Visual commands to execute")
    assistant_feedback: str = Field(default="", description="Spoken feedback for TTS")
    user_intent: Optional[IntentType] = Field(default=None, description="Detected user intent")
    visual_type: Optional[VisualType] = Field(default=None, description="Determined visual type")
    reasoning: Optional[str] = Field(default=None, description="AI reasoning (for debugging)")


class ErrorResponse(BaseModel):
    """Error response"""
    error: str = Field(description="Error message")
    details: Optional[str] = Field(default=None, description="Additional error details")


# --- Canvas State Model ---
class CanvasState(BaseModel):
    """Complete canvas state"""
    commands: List[VisualCommand] = Field(default_factory=list, description="All visual commands")
    version: int = Field(default=1, description="Canvas version")
    theme: Literal["light", "dark"] = Field(default="light", description="Current theme")