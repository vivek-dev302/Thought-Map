from typing import Literal

from pydantic import BaseModel, Field


ItemKind = Literal[
    "area", "concern", "problem", "plan",
    "opinion", "observation", "question", "note",
]


class Relationship(BaseModel):
    from_id: str = Field(
        description="Source item ID (e.g. the cause, antecedent, condition, or blocker)"
    )
    to_id: str = Field(
        description="Target item ID (e.g. the effect, consequence, or impacted thought)"
    )
    label: str = Field(
        default="",
        description="Short explicit connecting phrase (e.g. 'because', 'makes slow', 'prevents')"
    )
    kind: str = Field(
        default="relates_to",
        description="Relationship type: causes | prevents | leads_to | blocks | relates_to"
    )


class SemanticItem(BaseModel):
    id: str
    text: str
    kind: ItemKind
    areas: list[str] = Field(default_factory=list)


class OrganizeResponse(BaseModel):
    items: list[SemanticItem] = Field(default_factory=list)
    relationships: list[Relationship] = Field(default_factory=list)
    assistant_feedback: str = Field(
        default="",
        description="A short, concise 1-sentence spoken confirmation of what was created, moved, or organized on the canvas."
    )


class OrganizeRequest(BaseModel):
    text: str
    current_items: list[SemanticItem] = Field(default_factory=list)
    current_relationships: list[Relationship] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    error: str
