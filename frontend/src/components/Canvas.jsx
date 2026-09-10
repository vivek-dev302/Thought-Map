import { useEffect, useRef, useState } from "react";
import { Tldraw } from "tldraw";
import { createShapeId, createBindingId, toRichText } from "@tldraw/tlschema";
import "tldraw/tldraw.css";

// Sort priority: friction/problems first, then actions, then passive items
const KIND_ORDER = {
  problem: 0,
  concern: 1,
  question: 2,
  plan: 3,
  observation: 4,
  opinion: 5,
  note: 6,
};

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

function sanitizeId(str) {
  return String(str).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getItemShapeDefinition(item) {
  const config = KIND_CONFIG[item.kind] || KIND_CONFIG.note;
  if (config.shapeType === "geo") {
    const charsPerLine = 20;
    const numLines = Math.max(1, Math.ceil(item.text.length / charsPerLine));
    const shapeW = 240;
    const shapeH = Math.max(64, numLines * 26 + 28);
    return {
      type: "geo",
      w: shapeW,
      h: shapeH,
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
    };
  } else {
    let displayText = item.text;
    if (config.prefix) displayText = `${config.prefix}${item.text}`;
    if (config.wrapQuotes) displayText = `“${item.text}”`;

    const charsPerLine = 22;
    const numLines = Math.max(1, Math.ceil(displayText.length / charsPerLine));
    const textW = 230;
    const textH = Math.max(36, numLines * 28 + 12);

    return {
      type: "text",
      w: textW,
      h: textH,
      props: {
        richText: toRichText(displayText),
        color: config.color || "black",
        size: config.size || "s",
        font: config.font || "draw",
        autoSize: false,
        w: textW,
      },
    };
  }
}

/**
 * Places or incrementally updates semantic items on the canvas.
 * Preserves user-moved shape positions across multi-turn prompts and deletes only removed items.
 */
function syncItemsWithCanvas(editor, items, relationships = [], aiShapeIdsRef) {
  if (!editor || !items || items.length === 0) return;

  // 1. Group items by primary area
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

  // 2. Identify new active AI shape IDs and delete any shapes that were removed
  const newAiShapeIds = new Set();
  const itemShapeMap = new Map(); // itemId -> { shapeId, x, y, w, h }

  for (const [areaName, group] of areaGroups.entries()) {
    const headingId = createShapeId(`area_${sanitizeId(areaName)}`);
    newAiShapeIds.add(headingId);
    if (group.heading) {
      itemShapeMap.set(group.heading.id, { shapeId: headingId });
    }

    for (const item of group.items) {
      const shapeId = createShapeId(`thought_${sanitizeId(item.id)}`);
      newAiShapeIds.add(shapeId);
      itemShapeMap.set(item.id, { shapeId });
    }
  }

  for (const rel of relationships || []) {
    const arrowId = createShapeId(
      `arrow_${sanitizeId(rel.from_id)}_${sanitizeId(rel.to_id)}`
    );
    newAiShapeIds.add(arrowId);
  }

  // Delete obsolete AI shapes (e.g. user said "delete X")
  if (aiShapeIdsRef && aiShapeIdsRef.current) {
    const idsToDelete = [];
    for (const existingId of aiShapeIdsRef.current) {
      if (!newAiShapeIds.has(existingId) && editor.getShape(existingId)) {
        idsToDelete.push(existingId);
      }
    }
    if (idsToDelete.length > 0) {
      try {
        editor.deleteShapes(idsToDelete);
      } catch (err) {
        console.warn("Could not delete removed shapes:", err);
      }
    }
    aiShapeIdsRef.current = newAiShapeIds;
  }

  // 3. Layout Constants
  const baseStartX = 120;
  const baseStartY = 120;
  const COL_WIDTH = 250;
  const COL_GAP = 40;
  const CLUSTER_GAP_X = 180;
  const CLUSTER_GAP_Y = 140;
  const CLUSTERS_PER_ROW = 2;
  const HEADING_GAP = 64;

  const shapesToCreate = [];
  const shapesToUpdate = [];
  const bindingsToCreate = [];

  // 4. Determine placement: check if any existing clusters exist on canvas
  let anyExistingCluster = false;
  for (const [areaName] of areaGroups.entries()) {
    const headingId = createShapeId(`area_${sanitizeId(areaName)}`);
    if (editor.getShape(headingId)) {
      anyExistingCluster = true;
      break;
    }
  }

  // Pre-calculate clusters for layout if initial placement is needed
  const clusters = [];
  for (const [areaName, group] of areaGroups.entries()) {
    const isMultiCol = group.items.length >= 3;
    const numCols = isMultiCol ? 2 : 1;
    const clusterWidth = numCols * COL_WIDTH + (numCols - 1) * COL_GAP;

    const colHeights = new Array(numCols).fill(0);
    for (let i = 0; i < group.items.length; i++) {
      const item = group.items[i];
      const def = getItemShapeDefinition(item);
      const gap = def.type === "geo" ? 24 : 20;
      const targetCol = isMultiCol ? (colHeights[0] <= colHeights[1] ? 0 : 1) : 0;
      colHeights[targetCol] += def.h + gap;
    }
    const clusterHeight = HEADING_GAP + Math.max(...colHeights, 80);

    clusters.push({
      areaName,
      group,
      isMultiCol,
      numCols,
      clusterWidth,
      clusterHeight,
    });
  }

  const rowMaxHeights = [];
  for (let i = 0; i < clusters.length; i += CLUSTERS_PER_ROW) {
    const rowClusters = clusters.slice(i, i + CLUSTERS_PER_ROW);
    const maxH = Math.max(...rowClusters.map((c) => c.clusterHeight));
    rowMaxHeights.push(maxH);
  }

  let clusterIndex = 0;
  let hasCreatedAnyNewShape = false;

  for (const cluster of clusters) {
    const headingId = createShapeId(`area_${sanitizeId(cluster.areaName)}`);
    const existingHeading = editor.getShape(headingId);

    let clusterX, clusterY;

    if (existingHeading) {
      // PRESERVE user's custom position for this area
      clusterX = existingHeading.x;
      clusterY = existingHeading.y;
    } else if (!anyExistingCluster) {
      // Fresh canvas layout (Turn 1)
      const rowIndex = Math.floor(clusterIndex / CLUSTERS_PER_ROW);
      const colIndex = clusterIndex % CLUSTERS_PER_ROW;

      let currentClusterY = baseStartY;
      for (let r = 0; r < rowIndex; r++) {
        currentClusterY += rowMaxHeights[r] + CLUSTER_GAP_Y;
      }

      const jitterX = (Math.random() - 0.5) * 10;
      const jitterY = (Math.random() - 0.5) * 8;
      clusterX = baseStartX + colIndex * (540 + CLUSTER_GAP_X) + jitterX;
      clusterY = currentClusterY + jitterY;
    } else {
      // New area added to an already customized canvas: place in open space
      const pageBounds = editor.getCurrentPageBounds();
      clusterX = pageBounds ? pageBounds.maxX + 120 : baseStartX;
      clusterY = pageBounds ? pageBounds.minY : baseStartY;
    }

    // A. Area Heading Text
    const headingText = cluster.group.heading
      ? cluster.group.heading.text
      : cluster.areaName.toUpperCase();

    if (!existingHeading) {
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
      hasCreatedAnyNewShape = true;
    }

    const headingInfo = itemShapeMap.get(cluster.group.heading?.id) || {};
    headingInfo.shapeId = headingId;
    headingInfo.x = clusterX;
    headingInfo.y = clusterY;
    headingInfo.w = 220;
    headingInfo.h = 40;
    if (cluster.group.heading) {
      itemShapeMap.set(cluster.group.heading.id, headingInfo);
    }

    // B. Sort items by semantic kind
    cluster.group.items.sort(
      (a, b) => (KIND_ORDER[a.kind] ?? 99) - (KIND_ORDER[b.kind] ?? 99)
    );

    // C. Position thoughts inside this cluster
    const topAfterHeading = clusterY + HEADING_GAP;
    const colTops = [topAfterHeading, topAfterHeading];

    for (let itemIdx = 0; itemIdx < cluster.group.items.length; itemIdx++) {
      const item = cluster.group.items[itemIdx];
      const def = getItemShapeDefinition(item);
      const shapeId = createShapeId(`thought_${sanitizeId(item.id)}`);
      const existingShape = editor.getShape(shapeId);

      if (existingShape) {
        // PRESERVE user's position! Update props if needed
        shapesToUpdate.push({
          id: shapeId,
          type: def.type,
          props: def.props,
        });

        itemShapeMap.set(item.id, {
          shapeId,
          x: existingShape.x,
          y: existingShape.y,
          w: def.w,
          h: def.h,
        });

        // Advance column top for subsequent new items if positioned under this cluster
        const currentGap = def.type === "geo" ? 24 : 20;
        const currentBottom = existingShape.y + def.h + currentGap;
        if (currentBottom > colTops[0]) {
          colTops[0] = currentBottom;
        }
      } else {
        // Brand new item: compute position under this cluster
        const targetCol = cluster.isMultiCol
          ? colTops[0] <= colTops[1]
            ? 0
            : 1
          : 0;

        const itemX =
          clusterX +
          targetCol * (COL_WIDTH + COL_GAP) +
          (Math.random() - 0.5) * 6;
        const itemY = colTops[targetCol];

        shapesToCreate.push({
          id: shapeId,
          type: def.type,
          x: itemX,
          y: itemY,
          props: def.props,
        });
        hasCreatedAnyNewShape = true;

        itemShapeMap.set(item.id, {
          shapeId,
          x: itemX,
          y: itemY,
          w: def.w,
          h: def.h,
        });

        const gap = def.type === "geo" ? 24 : 20;
        colTops[targetCol] = itemY + def.h + gap;
      }
    }

    clusterIndex += 1;
  }

  // 5. Create or update Curved Arrows with Dynamic Bindings
  if (Array.isArray(relationships) && relationships.length > 0) {
    for (const rel of relationships) {
      const fromItem = itemShapeMap.get(rel.from_id);
      const toItem = itemShapeMap.get(rel.to_id);

      if (fromItem && toItem) {
        const arrowId = createShapeId(
          `arrow_${sanitizeId(rel.from_id)}_${sanitizeId(rel.to_id)}`
        );
        const existingArrow = editor.getShape(arrowId);

        const startX = fromItem.x + fromItem.w / 2;
        const startY = fromItem.y + fromItem.h / 2;
        const endX = toItem.x + toItem.w / 2;
        const endY = toItem.y + toItem.h / 2;

        const deltaX = endX - startX;
        const deltaY = endY - startY;

        if (!existingArrow) {
          shapesToCreate.push({
            id: arrowId,
            type: "arrow",
            x: startX,
            y: startY,
            props: {
              kind: "arc",
              start: { x: 0, y: 0 },
              end: { x: deltaX, y: deltaY },
              bend: 10,
              color: "grey",
              dash: "draw",
              size: "s",
              arrowheadStart: "none",
              arrowheadEnd: "arrow",
              labelPosition: 0.5,
              richText: toRichText(rel.label || ""),
            },
          });
          hasCreatedAnyNewShape = true;

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
        } else {
          shapesToUpdate.push({
            id: arrowId,
            type: "arrow",
            props: {
              richText: toRichText(rel.label || ""),
              labelPosition: 0.5,
            },
          });
        }
      }
    }
  }

  // 6. Commit updates and creations to tldraw
  if (shapesToUpdate.length > 0) {
    try {
      editor.updateShapes(shapesToUpdate);
    } catch (err) {
      console.warn("Could not update existing shapes:", err);
    }
  }

  if (shapesToCreate.length > 0) {
    editor.createShapes(shapesToCreate);

    if (bindingsToCreate.length > 0) {
      try {
        editor.createBindings(bindingsToCreate);
      } catch (err) {
        console.warn("Could not create arrow bindings:", err);
      }
    }
  }

  if (!anyExistingCluster && hasCreatedAnyNewShape) {
    setTimeout(() => {
      editor.zoomToFit({ animation: { duration: 350 }, padding: 90 });
    }, 60);
  }
}

export default function Canvas({ items, relationships = [], loading, theme }) {
  const [editor, setEditor] = useState(null);
  const prevItemsRef = useRef(null);
  const aiShapeIdsRef = useRef(new Set());

  // Populate aiShapeIdsRef on mount from existing shapes (from persistence)
  const onMountHandler = (mountedEditor) => {
    setEditor(mountedEditor);
    if (theme) {
      mountedEditor.user.updateUserPreferences({
        colorScheme: theme,
      });
    }

    try {
      const existingShapes = mountedEditor.getCurrentPageShapes();
      for (const shape of existingShapes) {
        if (
          shape.id.startsWith("shape:thought_") ||
          shape.id.startsWith("shape:area_") ||
          shape.id.startsWith("shape:arrow_")
        ) {
          aiShapeIdsRef.current.add(shape.id);
        }
      }
    } catch (e) {
      console.warn("Could not read existing canvas shapes:", e);
    }
  };

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

  // Incrementally place/update items when new items arrive from AI organize
  useEffect(() => {
    if (!editor || !items || items.length === 0) return;
    if (items === prevItemsRef.current) return;
    prevItemsRef.current = items;

    syncItemsWithCanvas(editor, items, relationships, aiShapeIdsRef);
  }, [editor, items, relationships]);

  return (
    <div className="canvas-wrap">
      <div className="tldraw-container">
        <Tldraw
          persistenceKey="thoughtcanvas_canvas_v1"
          onMount={onMountHandler}
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