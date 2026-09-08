import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 90;
const H_GAP = 48;
const V_GAP = 110;

function ThoughtNode({ data, selected }) {
  return (
    <div className={`thought-node ${data.nodeType} ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <div className="node-type">{data.nodeType}</div>
      {data.editing ? (
        <input
          className="node-label-input"
          defaultValue={data.label}
          autoFocus
          onBlur={(event) => data.onRename(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") data.onRename(event.currentTarget.value);
            if (event.key === "Escape") data.onRename(data.label);
          }}
        />
      ) : (
        <div className="node-label">{data.label}</div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { thought: ThoughtNode };

function layoutGraph(apiNodes, apiEdges) {
  const children = new Map();
  const incoming = new Map();

  for (const node of apiNodes) {
    children.set(node.id, []);
    incoming.set(node.id, 0);
  }

  for (const edge of apiEdges) {
    if (!children.has(edge.source) || !children.has(edge.target)) continue;
    children.get(edge.source).push(edge.target);
    incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
  }

  const roots = apiNodes.filter((node) => (incoming.get(node.id) || 0) === 0).map((node) => node.id);
  const positions = new Map();
  const subtreeWidth = new Map();
  const visited = new Set();
  const measuring = new Set();

  function measure(id) {
    if (subtreeWidth.has(id)) return subtreeWidth.get(id);
    if (measuring.has(id)) {
      subtreeWidth.set(id, NODE_WIDTH);
      return NODE_WIDTH;
    }
    measuring.add(id);
    const kids = children.get(id) || [];
    if (kids.length === 0) {
      subtreeWidth.set(id, NODE_WIDTH);
      measuring.delete(id);
      return NODE_WIDTH;
    }
    let width = 0;
    for (const child of kids) {
      width += measure(child) + H_GAP;
    }
    width -= H_GAP;
    subtreeWidth.set(id, Math.max(NODE_WIDTH, width));
    measuring.delete(id);
    return subtreeWidth.get(id);
  }

  function place(id, x, y) {
    if (visited.has(id)) return;
    visited.add(id);
    positions.set(id, { x, y });
    const kids = children.get(id) || [];
    const total = kids.reduce((sum, child) => sum + (subtreeWidth.get(child) || NODE_WIDTH) + H_GAP, 0) - H_GAP;
    let cursor = x - Math.max(total, NODE_WIDTH) / 2 + (subtreeWidth.get(kids[0]) || NODE_WIDTH) / 2;
    for (const child of kids) {
      place(child, cursor, y + V_GAP);
      cursor += (subtreeWidth.get(child) || NODE_WIDTH) + H_GAP;
    }
  }

  let forestWidth = 0;
  for (const root of roots) {
    forestWidth += measure(root) + H_GAP * 2;
  }

  let x = 80;
  for (const root of roots) {
    const width = subtreeWidth.get(root) || NODE_WIDTH;
    place(root, x + width / 2, 40);
    x += width + H_GAP * 2;
  }

  for (const node of apiNodes) {
    if (!positions.has(node.id)) {
      positions.set(node.id, { x: forestWidth + 80, y: 40 });
      forestWidth += NODE_WIDTH + H_GAP;
    }
  }

  return { positions };
}

function toFlow(graph, callbacks) {
  const { positions } = layoutGraph(graph.nodes, graph.edges);
  const nodes = graph.nodes.map((node) => ({
    id: node.id,
    type: "thought",
    position: positions.get(node.id) || { x: 0, y: 0 },
    data: {
      label: node.label,
      nodeType: node.type,
      editing: false,
      onRename: (label) => callbacks.onRename(node.id, label),
    },
  }));
  const edges = graph.edges.map((edge, index) => ({
    id: `${edge.source}-${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    label: edge.relationship === "related_to" ? "related" : "",
    animated: edge.relationship === "related_to",
  }));
  return { nodes, edges };
}

function FlowCanvas({ graph, loading }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  const renameNode = useCallback((id, label) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === id
          ? {
              ...node,
              data: { ...node.data, label: label.trim() || node.data.label, editing: false },
            }
          : node,
      ),
    );
  }, [setNodes]);

  const callbacks = useMemo(() => ({ onRename: renameNode }), [renameNode]);

  useEffect(() => {
    const next = toFlow(graph, callbacks);
    setNodes(next.nodes);
    setEdges(next.edges);
    requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300 }));
  }, [graph, callbacks, fitView, setEdges, setNodes]);

  const onNodeDoubleClick = useCallback((_event, node) => {
    setNodes((current) =>
      current.map((item) =>
        item.id === node.id ? { ...item, data: { ...item.data, editing: true } } : item,
      ),
    );
  }, [setNodes]);

  const empty = nodes.length === 0 && !loading;

  return (
    <div className="canvas-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode={["Backspace", "Delete"]}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        panOnScroll
        minZoom={0.2}
        maxZoom={1.8}
      >
        <Background />
        <Controls />
      </ReactFlow>
      {loading ? (
        <div className="overlay">
          <div className="overlay-card">Organizing your thoughts...</div>
        </div>
      ) : null}
      {empty ? (
        <div className="overlay">
          <div className="overlay-card empty-hint">
            Type or speak a thought below, then click Organize Thoughts to see a map.
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Canvas({ graph, loading }) {
  return (
    <ReactFlowProvider>
      <FlowCanvas graph={graph} loading={loading} />
    </ReactFlowProvider>
  );
}
