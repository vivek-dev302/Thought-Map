from typing import Literal

from pydantic import BaseModel, Field


NodeType = Literal["area", "problem", "planning", "thought"]
RelationshipType = Literal["contains", "related_to"]


class GraphNode(BaseModel):
    id: str
    label: str
    type: NodeType


class GraphEdge(BaseModel):
    source: str
    target: str
    relationship: RelationshipType


class ThoughtGraph(BaseModel):
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)


class OrganizeRequest(BaseModel):
    text: str


class ErrorResponse(BaseModel):
    error: str
