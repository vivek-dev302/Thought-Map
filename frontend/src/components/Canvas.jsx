import { useEffect, useRef, useState } from "react";
import { Tldraw } from "tldraw";
import { createShapeId, createBindingId, toRichText } from "@tldraw/tlschema";
import "tldraw/tldraw.css";

/**
 * Visual configuration for thought kinds:
 * Uses clean hand-drawn strokes with ZERO filled backgrounds (fill: "none").
 * Employs transparent ellipses for subareas/key concepts, transparent rectangles
 * for friction/problem points, and varied text typography for thoughts.
 */
const KIND_CONFIG = {
  area: {
    shapeType: "text",
    color: "blue",
    size: "l",
    font: "draw",
  },
  problem: {
    shapeType: "geo",
    geo: "rectangle",
    color: "red",
    fill: "none",
    dash: "draw",
    size: "s",
    font: "draw",
  },
  concern: {
    shapeType: "text",
    color: "orange",
    size: "s",
    font: "draw",
    prefix: "▲ ",
  },
  plan: {
    shapeType: "text",
    color: "green",
    size: "s",
    font: "draw",
    prefix: "➔ ",
  },
  question: {
    shapeType: "text",
    color: "violet",
    size: "s",
    font: "draw",
    prefix: "❓ ",
  },
  opinion: {
    shapeType: "text",
    color: "grey",
    size: "s",
    font: "draw",
    wrapQuotes: true,
  },
  observation: {
    shapeType: "text",
    color: "black",
    size: "s",
    font: "draw",
    prefix: "• ",
  },
  note: {
    shapeType: "text",
    color: "grey",
    size: "s",
    font: "draw",
  },
};

/**
 * Places semantic items on the canvas in an organic, transparent whiteboard map.
 * Replaces previously AI-generated shapes cleanly for multi-turn editing.
 */
function placeItemsOnCanvas(editor, items, relationships = [], aiShapeIdsRef) {
  if (!editor || !items || items.length === 0) return;

  // 1. Clean up previous AI shapes to support multi-turn conversational edits (e.g. splitting areas)
  if (aiShapeIdsRef && aiShapeIdsRef.current && aiShapeIdsRef.current.size > 0) {
    try {
      const idsToDelete = Array.from(aiShapeIdsRef.current);
      editor.deleteShapes(idsToDelete);
      aiShapeIdsRef.current.clear();
    } catch (err) {
      console.warn("Could not clean up previous AI shapes:", err);
    }
  }

  // 2. Group items by primary area
  const areaGroups = new Map();
  const ungrouped = [];

  for (const item of items) {
    if (item.kind === "area") {
      const key = item.text;
      if (!areaGroups.has(key)) {
        areaGroups.set(key, { heading: item, items: [] });
      } else {
        areaGroups.get(key).heading = item;
      }
    } else if (item.areas && item.areas.length > 0) {
      const primaryArea = item.areas[0];
      if (!areaGroups.has(primaryArea)) {
        areaGroups.set(primaryArea, { heading: null, items: [] });
      }
      areaGroups.get(primaryArea).items.push(item);
    } else {
      ungrouped.push(item);
    }
  }

  if (ungrouped.length > 0) {
    areaGroups.set("General", { heading: null, items: ungrouped });
  }

  const baseStartX = 120;
  const baseStartY = 120;
  const COL_WIDTH = 240;
  const COL_GAP = 30;
  const CLUSTER_GAP_X = 160;
  const CLUSTER_GAP_Y = 140;
  const CLUSTERS_PER_ROW = 2;

  const shapesToCreate = [];
  const bindingsToCreate = [];
  const itemShapeMap = new Map(); // itemId -> { shapeId, x, y, w, h }
  const currentAiShapeIds = new Set();

  // 3. Pre-calculate dimensions for each 2D area cluster
  const clusters = [];
  for (const [areaName, group] of areaGroups.entries()) {
    const isMultiCol = group.items.length >= 3;
    const numCols = isMultiCol ? 2 : 1;
    const clusterWidth = numCols * COL_WIDTH + (numCols - 1) * COL_GAP;

    // Estimate heights of items
    const colHeights = new Array(numCols).fill(0);
    for (let i = 0; i < group.items.length; i++) {
      const item = group.items[i];
      const config = KIND_CONFIG[item.kind] || KIND_CONFIG.note;
      const h = config.shapeType === "geo" ? 68 : 46;
      const targetCol = isMultiCol ? (colHeights[0] <= colHeights[1] ? 0 : 1) : 0;
      colHeights[targetCol] += h + 18;
    }
    const clusterHeight = 60 + Math.max(...colHeights, 80);

    clusters.push({
      areaName,
      group,
      isMultiCol,
      numCols,
      clusterWidth,
      clusterHeight,
    });
  }

  // 4. Calculate 2D positions for each cluster
  const rowMaxHeights = [];
  for (let i = 0; i < clusters.length; i += CLUSTERS_PER_ROW) {
    const rowClusters = clusters.slice(i, i + CLUSTERS_PER_ROW);
    const maxH = Math.max(...rowClusters.map((c) => c.clusterHeight));
    rowMaxHeights.push(maxH);
  }

  let clusterIndex = 0;
  for (const cluster of clusters) {
    const rowIndex = Math.floor(clusterIndex / CLUSTERS_PER_ROW);
    const colIndex = clusterIndex % CLUSTERS_PER_ROW;

    let currentClusterY = baseStartY;
    for (let r = 0; r < rowIndex; r++) {
      currentClusterY += rowMaxHeights[r] + CLUSTER_GAP_Y;
    }

    const jitterX = (Math.random() - 0.5) * 16;
    const jitterY = (Math.random() - 0.5) * 14;
    const clusterX = baseStartX + colIndex * (500 + CLUSTER_GAP_X) + jitterX;
    const clusterY = currentClusterY + jitterY;

    // A. Area Heading (Level 1: Large prominent text)
    const headingText = cluster.group.heading
      ? cluster.group.heading.text
      : cluster.areaName.toUpperCase();

    const headingId = createShapeId();
    shapesToCreate.push({
      id: headingId,
      type: "text",
      x: clusterX,
      y: clusterY,
      props: {
        richText: toRichText(headingText),
        size: "m",
        font: "draw",
        color: "blue",
        autoSize: true,
      },
    });
    currentAiShapeIds.add(headingId);

    if (cluster.group.heading) {
      itemShapeMap.set(cluster.group.heading.id, {
        shapeId: headingId,
        x: clusterX,
        y: clusterY,
        w: 220,
        h: 40,
      });
    }

    // B. Place thoughts inside this cluster
    const colTops = [clusterY + 54, clusterY + (cluster.isMultiCol ? 62 : 54)];

    for (let itemIdx = 0; itemIdx < cluster.group.items.length; itemIdx++) {
      const item = cluster.group.items[itemIdx];
      const config = KIND_CONFIG[item.kind] || KIND_CONFIG.note;

      const targetCol = cluster.isMultiCol
        ? colTops[0] <= colTops[1]
          ? 0
          : 1
        : 0;

      const itemX =
        clusterX +
        targetCol * (COL_WIDTH + COL_GAP) +
        (Math.random() - 0.5) * 10;
      const itemY = colTops[targetCol] + (Math.random() - 0.5) * 6;

      const shapeId = createShapeId();
      currentAiShapeIds.add(shapeId);

      if (config.shapeType === "geo") {
        // Transparent outline shape with zero fill (fill: "none")
        const shapeW = Math.max(180, Math.min(280, item.text.length * 8 + 36));
        const shapeH = 64;

        shapesToCreate.push({
          id: shapeId,
          type: "geo",
          x: itemX,
          y: itemY,
          props: {
            geo: config.geo || "rectangle",
            w: shapeW,
            h: shapeH,
            color: config.color || "red",
            fill: "none",
            dash: "draw",
            size: "s",
            font: "draw",
            align: "middle",
            verticalAlign: "middle",
            richText: toRichText(item.text),
          },
        });

        itemShapeMap.set(item.id, {
          shapeId,
          x: itemX,
          y: itemY,
          w: shapeW,
          h: shapeH,
        });

        colTops[targetCol] = itemY + shapeH + 18;
      } else {
        // Hand-drawn typography with semantic size/color level
        let displayText = item.text;
        if (config.prefix) displayText = `${config.prefix}${item.text}`;
        if (config.wrapQuotes) displayText = `“${item.text}”`;

        shapesToCreate.push({
          id: shapeId,
          type: "text",
          x: itemX,
          y: itemY,
          props: {
            richText: toRichText(displayText),
            color: config.color || "black",
            size: config.size || "s",
            font: config.font || "draw",
            autoSize: true,
          },
        });

        itemShapeMap.set(item.id, {
          shapeId,
          x: itemX,
          y: itemY,
          w: 200,
          h: 42,
        });

        colTops[targetCol] = itemY + 44 + 14;
      }
    }

    clusterIndex += 1;
  }

  // 5. Create Explicit Curved Arrows with Dynamic Bindings
  if (Array.isArray(relationships) && relationships.length > 0) {
    for (const rel of relationships) {
      const fromItem = itemShapeMap.get(rel.from_id);
      const toItem = itemShapeMap.get(rel.to_id);

      if (fromItem && toItem) {
        const arrowId = createShapeId();
        currentAiShapeIds.add(arrowId);

        const startX = fromItem.x + fromItem.w / 2;
        const startY = fromItem.y + fromItem.h / 2;
        const endX = toItem.x + toItem.w / 2;
        const endY = toItem.y + toItem.h / 2;

        const deltaX = endX - startX;
        const deltaY = endY - startY;

        shapesToCreate.push({
          id: arrowId,
          type: "arrow",
          x: startX,
          y: startY,
          props: {
            kind: "arc",
            start: { x: 0, y: 0 },
            end: { x: deltaX, y: deltaY },
            bend: 16,
            color: "grey",
            dash: "draw",
            size: "s",
            arrowheadStart: "none",
            arrowheadEnd: "arrow",
            richText: toRichText(rel.label || ""),
          },
        });

        bindingsToCreate.push(
          {
            id: createBindingId(),
            type: "arrow",
            fromId: arrowId,
            toId: fromItem.shapeId,
            props: {
              terminal: "start",
              normalizedAnchor: { x: 0.5, y: 0.5 },
              isExact: false,
              isPrecise: false,
            },
          },
          {
            id: createBindingId(),
            type: "arrow",
            fromId: arrowId,
            toId: toItem.shapeId,
            props: {
              terminal: "end",
              normalizedAnchor: { x: 0.5, y: 0.5 },
              isExact: false,
              isPrecise: false,
            },
          }
        );
      }
    }
  }

  // 6. Commit shapes and bindings to tldraw
  if (shapesToCreate.length > 0) {
    editor.createShapes(shapesToCreate);

    if (bindingsToCreate.length > 0) {
      try {
        editor.createBindings(bindingsToCreate);
      } catch (err) {
        console.warn("Could not create arrow bindings:", err);
      }
    }

    if (aiShapeIdsRef) {
      aiShapeIdsRef.current = currentAiShapeIds;
    }

    setTimeout(() => {
      editor.zoomToFit({ animation: { duration: 350 }, padding: 90 });
    }, 60);
  }
}

export default function Canvas({ items, relationships = [], loading, theme }) {
  const [editor, setEditor] = useState(null);
  const prevItemsRef = useRef(null);
  const aiShapeIdsRef = useRef(new Set());

  // Sync theme with tldraw
  useEffect(() => {
    if (!editor) return;
    const currentScheme =
      editor.user.getUserPreferences().colorScheme ??
      (editor.user.getIsDarkMode() ? "dark" : "light");
    if (currentScheme !== theme) {
      editor.user.updateUserPreferences({
        colorScheme: theme,
      });
    }
  }, [editor, theme]);

  // Place/update items when new items arrive from AI organize
  useEffect(() => {
    if (!editor || !items || items.length === 0) return;
    if (items === prevItemsRef.current) return;
    prevItemsRef.current = items;

    placeItemsOnCanvas(editor, items, relationships, aiShapeIdsRef);
  }, [editor, items, relationships]);

  return (
    <div className="canvas-wrap">
      <div className="tldraw-container">
        <Tldraw
          onMount={(mountedEditor) => {
            setEditor(mountedEditor);
            if (theme) {
              mountedEditor.user.updateUserPreferences({
                colorScheme: theme,
              });
            }
          }}
        />
      </div>

      {loading ? (
        <div className="overlay">
          <div className="overlay-card">Organizing your thoughts...</div>
        </div>
      ) : null}
    </div>
  );
}
