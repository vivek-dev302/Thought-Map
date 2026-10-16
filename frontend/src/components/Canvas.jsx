import { useState, useEffect, useRef, useCallback } from "react";
import { Excalidraw, convertToExcalidrawElements } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

/**
 * VisualCanvas: Main canvas component using Excalidraw based on CLAUDE.md architecture
 *
 * Responsibilities:
 * 1. Takes application-level visual commands (VisualCommand) from backend/App
 * 2. Deterministically converts VisualElements and VisualConnections to Excalidraw elements
 *    using Excalidraw's official convertToExcalidrawElements utility
 * 3. Applies typography hierarchy (Headers: 22px, Subtopics: 18px, Notes: 15px)
 * 4. Decorates elements with context-aware semantic emojis and harmonious category palettes
 * 5. Calculates collision-free dynamic dimensions and columnar spacing for brain dumps and flows
 */

// Helper to check if string starts with an emoji
const hasEmoji = (str) => {
  if (!str) return false;
  const regex = /^[\p{Extended_Pictographic}☀-➿]/u;
  return regex.test(str.trim());
};

// Category Icon and Styling Palette Mapping
const getCategoryStyleAndIcon = (categoryStr, textStr, kind, elementType, darkMode) => {
  const cat = (categoryStr || "").toLowerCase();
  const text = (textStr || "").toLowerCase();
  const type = (elementType || "").toLowerCase();

  let defaultIcon = "";
  let stroke = darkMode ? "#94a3b8" : "#475569";
  let bg = darkMode ? "rgba(148, 163, 184, 0.12)" : "rgba(71, 85, 105, 0.08)";

  // Decisions / Diamonds
  if (type === "diamond" || kind === "decision" || text.includes("?") || text.includes("is ") || text.includes("check")) {
    stroke = darkMode ? "#fbbf24" : "#d97706";
    bg = darkMode ? "rgba(251, 191, 36, 0.18)" : "rgba(217, 119, 6, 0.10)";
  }
  // Start / End capsules
  else if (type === "ellipse" || kind === "start" || text.includes("start") || text.includes("open app")) {
    stroke = darkMode ? "#34d399" : "#059669";
    bg = darkMode ? "rgba(52, 211, 153, 0.18)" : "rgba(5, 150, 105, 0.10)";
  } else if (kind === "end" || text.includes("exit") || text.includes("end")) {
    stroke = darkMode ? "#fb7185" : "#e11d48";
    bg = darkMode ? "rgba(251, 113, 133, 0.18)" : "rgba(225, 29, 72, 0.10)";
  }
  // Errors / Problem nodes
  else if (kind === "problem" || kind === "error" || cat.includes("concern") || text.includes("error") || text.includes("fail") || text.includes("problem") || text.includes("invalid")) {
    defaultIcon = "⚠️";
    stroke = darkMode ? "#fb7185" : "#e11d48";
    bg = darkMode ? "rgba(251, 113, 133, 0.16)" : "rgba(225, 29, 72, 0.09)";
  }
  // System components
  else if (kind === "component" || kind === "system" || cat.includes("backend") || cat.includes("frontend") || cat.includes("database") || cat.includes("api")) {
    stroke = darkMode ? "#60a5fa" : "#2563eb";
    bg = darkMode ? "rgba(96, 165, 250, 0.16)" : "rgba(37, 99, 235, 0.09)";
  }
  // Standard domain categories
  else if (cat.includes("health") || cat.includes("fit") || text.includes("fitness") || text.includes("health") || text.includes("gym") || text.includes("boxing")) {
    defaultIcon = "🏃";
    stroke = darkMode ? "#34d399" : "#059669";
    bg = darkMode ? "rgba(52, 211, 153, 0.16)" : "rgba(5, 150, 105, 0.09)";
  } else if (cat.includes("career") || cat.includes("job") || cat.includes("ai") || cat.includes("work") || text.includes("saas") || text.includes("rag") || text.includes("career")) {
    defaultIcon = "💼";
    stroke = darkMode ? "#818cf8" : "#4f46e5";
    bg = darkMode ? "rgba(129, 140, 248, 0.16)" : "rgba(79, 70, 229, 0.09)";
  } else if (cat.includes("comm") || cat.includes("social") || cat.includes("people") || text.includes("communication") || text.includes("lonely") || text.includes("video")) {
    defaultIcon = "💬";
    stroke = darkMode ? "#c084fc" : "#9333ea";
    bg = darkMode ? "rgba(192, 132, 252, 0.16)" : "rgba(147, 51, 234, 0.09)";
  } else if (cat.includes("study") || cat.includes("academic") || cat.includes("college") || cat.includes("learn") || text.includes("academic") || text.includes("coursework")) {
    defaultIcon = "📚";
    stroke = darkMode ? "#38bdf8" : "#0284c7";
    bg = darkMode ? "rgba(56, 189, 248, 0.16)" : "rgba(2, 132, 199, 0.09)";
  } else if (cat.includes("skill") || cat.includes("hobby") || cat.includes("personal") || text.includes("drawing") || text.includes("swimming") || text.includes("chess")) {
    defaultIcon = "🎯";
    stroke = darkMode ? "#fbbf24" : "#d97706";
    bg = darkMode ? "rgba(251, 191, 36, 0.18)" : "rgba(217, 119, 6, 0.10)";
  } else if (kind === "goal" || text.includes("goal") || text.includes("plan")) {
    defaultIcon = "🎯";
    stroke = darkMode ? "#2dd4bf" : "#0d9488";
    bg = darkMode ? "rgba(45, 212, 191, 0.16)" : "rgba(13, 148, 136, 0.09)";
  }

  return { defaultIcon, stroke, bg };
};

export default function VisualCanvas({ visualCommands = [], loading, theme }) {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [canvasElements, setCanvasElements] = useState([]);
  const [, setAppState] = useState({});
  const prevCommandsRef = useRef(null);
  const isDarkMode = theme === "dark";

  // Callback to capture Excalidraw API
  const handleExcalidrawAPI = useCallback((api) => {
    console.log("[CANVAS] 🎨 Excalidraw API initialized");
    setExcalidrawAPI(api);
  }, []);

  // Convert and render visual commands whenever they change
  useEffect(() => {
    if (!excalidrawAPI) {
      console.log("[CANVAS] ⏳ Excalidraw API not ready yet");
      return;
    }

    if (!visualCommands || visualCommands.length === 0) {
      console.log("[CANVAS] ℹ️ visualCommands is empty or cleared");
      if (excalidrawAPI) {
        try {
          excalidrawAPI.updateScene({ elements: [] });
          setCanvasElements([]);
        } catch (clearErr) {
          console.warn("[CANVAS] Error clearing scene:", clearErr);
        }
      }
      prevCommandsRef.current = [];
      return;
    }

    if (visualCommands === prevCommandsRef.current) {
      return;
    }

    console.log(`[CANVAS] 📥 Received ${visualCommands.length} visual command(s):`, visualCommands);
    prevCommandsRef.current = visualCommands;

    applyVisualCommands(excalidrawAPI, visualCommands, isDarkMode);
  }, [excalidrawAPI, visualCommands, isDarkMode]);

  // Handle theme changes on existing canvas
  useEffect(() => {
    if (!excalidrawAPI) return;
    try {
      excalidrawAPI.updateScene({
        appState: {
          theme: isDarkMode ? "dark" : "light",
          viewBackgroundColor: isDarkMode ? "#121212" : "#f8f9fa",
        },
      });
    } catch (e) {
      console.warn("[CANVAS] Theme update error:", e);
    }
  }, [excalidrawAPI, isDarkMode]);

  /**
   * Apply all visual commands to the Excalidraw scene
   */
  const applyVisualCommands = (api, commands, darkMode) => {
    try {
      console.log("[CANVAS] ⚙️ Starting conversion of visual commands to Excalidraw scene elements...");
      const elementsMap = new Map();
      let currentOffsetY = 100;

      commands.forEach((command, cmdIdx) => {
        console.log(`[CANVAS] 🔄 Processing Command #${cmdIdx + 1}: visual_type=${command.visual_type}, layout=${command.layout}, elements=${command.elements?.length || 0}, connections=${command.connections?.length || 0}`);
        const converted = convertVisualCommandToExcalidraw(command, cmdIdx, darkMode, currentOffsetY);
        let maxCommandY = currentOffsetY;

        converted.forEach((el) => {
          elementsMap.set(el.id, el);
          // Calculate bottom boundary of shapes to prevent section collisions
          if (el.type !== "arrow" && typeof el.y === "number" && typeof el.height === "number") {
            const bottom = el.y + el.height;
            if (bottom > maxCommandY) {
              maxCommandY = bottom;
            }
          }
        });

        // Set start offset for subsequent section with clean vertical breathing room
        currentOffsetY = maxCommandY + 140;
      });

      const finalElements = Array.from(elementsMap.values());
      console.log(`[CANVAS] 📊 Total Excalidraw elements generated: ${finalElements.length}`);

      if (finalElements.length > 0) {
        // Update Excalidraw scene
        api.updateScene({
          elements: finalElements,
          appState: {
            theme: darkMode ? "dark" : "light",
            viewBackgroundColor: darkMode ? "#121212" : "#f8f9fa",
          },
        });

        setCanvasElements(finalElements);
        console.log("[CANVAS] ✅ Excalidraw scene updated successfully");

        // Fit canvas content into viewport
        setTimeout(() => {
          try {
            api.scrollToContent(finalElements, {
              fitToContent: true,
              padding: 90,
            });
            console.log("[CANVAS] 🔍 scrollToContent executed");
          } catch (scrollErr) {
            console.warn("[CANVAS] scrollToContent warning:", scrollErr);
          }
        }, 150);
      } else {
        console.warn("[CANVAS] ⚠️ No elements were generated from visual commands");
      }
    } catch (error) {
      console.error("[CANVAS] ❌ Error in applyVisualCommands:", error);
    }
  };

  /**
   * Estimates suitable width and height based on element type, visual type, and typography metrics
   */
  const estimateElementDimensions = (element, isHeader, visualType = "freeform") => {
    const type = element.type || "rectangle";
    const text = (element.text || "").trim();
    const explicitLines = text.split("\n");
    let wrappedLineCount = 0;

    // Line wrap calculation based on expected width
    let charsPerLine = 30;
    if (type === "ellipse") charsPerLine = 18;
    else if (type === "diamond") charsPerLine = 16;
    else if (type === "note") charsPerLine = 24;
    else if (visualType === "user_flow" || visualType === "flowchart") charsPerLine = 22;

    explicitLines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        wrappedLineCount += 0.5;
      } else {
        wrappedLineCount += Math.max(1, Math.ceil(trimmed.length / charsPerLine));
      }
    });

    let targetWidth = 230;
    let computedHeight = 80;

    if (type === "ellipse") {
      targetWidth = Math.max(150, Math.min(200, 120 + text.length * 4));
      computedHeight = Math.max(65, 30 + wrappedLineCount * 18);
    } else if (type === "diamond") {
      targetWidth = Math.max(180, Math.min(240, 140 + text.length * 4));
      computedHeight = Math.max(95, 45 + wrappedLineCount * 22);
    } else if (isHeader) {
      targetWidth = 330;
      computedHeight = Math.max(62, 28 + wrappedLineCount * 28);
    } else if (visualType === "brain_dump") {
      targetWidth = 330;
      computedHeight = Math.max(88, 36 + wrappedLineCount * 24);
    } else if (visualType === "user_flow" || visualType === "flowchart" || visualType === "process") {
      targetWidth = 220;
      computedHeight = Math.max(75, 32 + wrappedLineCount * 22);
    } else if (visualType === "architecture" || visualType === "system_diagram") {
      targetWidth = 240;
      computedHeight = Math.max(80, 32 + wrappedLineCount * 22);
    } else if (type === "note") {
      targetWidth = 260;
      computedHeight = Math.max(88, 36 + wrappedLineCount * 24);
    }

    const width = Math.max(targetWidth, element.size?.width || 0);
    const height = Math.max(computedHeight, element.size?.height || 0);

    return { width, height };
  };

  /**
   * Converts a single VisualCommand into an array of Excalidraw elements using convertToExcalidrawElements
   */
  const convertVisualCommandToExcalidraw = (command, cmdIndex, darkMode, startOffsetY = 100) => {
    const rawElements = command.elements || [];
    const rawConnections = command.connections || [];
    const visualType = command.visual_type || "freeform";
    const layout = command.layout || inferLayoutFromVisualType(visualType);

    // Step 1: Calculate layout positions with intelligent category awareness & branching
    const positionedElements = calculateLayoutPositions(rawElements, layout, visualType, cmdIndex, rawConnections, startOffsetY);

    const skeletons = [];
    const shapeLookup = new Map(); // id -> positionedElement

    // Step 2: Build Skeletons for Shapes and Notes with Typography Hierarchy
    positionedElements.forEach((element, index) => {
      const elementId = String(element.id || `node_${cmdIndex}_${index}`);
      shapeLookup.set(elementId, element);

      const x = element.position?.x ?? 100;
      const y = element.position?.y ?? 100;
      const width = element.size?.width ?? 220;
      const height = element.size?.height ?? 80;
      let textContent = (element.text || "").trim();
      const type = element.type || "rectangle";
      const isBrainDump = visualType === "brain_dump" || layout === "cluster";
      const isHeader = isBrainDump && (element.metadata?.kind === "area" || elementId.toLowerCase().startsWith("area") || elementId.toLowerCase().includes("header"));

      // Semantic decoration & icons
      const category = element.metadata?.category || "";
      const kind = element.metadata?.kind || (isHeader ? "area" : "thought");
      const { defaultIcon, stroke, bg } = getCategoryStyleAndIcon(category, textContent, kind, type, darkMode);

      // Auto-prefix icon if not already present and icon is available
      if (isHeader && defaultIcon && !hasEmoji(textContent)) {
        textContent = `${defaultIcon} ${textContent}`;
      }

      // Typography scaling
      let fontSize = 15;
      if (isHeader) {
        fontSize = 21;
      } else if (type === "diamond" || type === "ellipse") {
        fontSize = 16;
      } else if (kind === "step" || kind === "component" || visualType === "user_flow" || visualType === "flowchart") {
        fontSize = 16;
      }

      // Style resolution
      const strokeColor = element.style?.stroke_color || stroke;
      const backgroundColor = element.style?.background_color || bg;

      const isCentered = isHeader || type === "diamond" || type === "ellipse" || visualType === "user_flow" || visualType === "flowchart" || visualType === "architecture" || kind === "step" || kind === "component" || kind === "decision";

      if (type === "text") {
        skeletons.push({
          id: elementId,
          type: "text",
          x,
          y,
          text: textContent,
          fontSize: element.style?.font_size || fontSize,
          strokeColor: darkMode ? "#f9fafb" : "#111827",
        });
      } else {
        const excalidrawType = type === "note" ? "rectangle" : type;
        const skeleton = {
          id: elementId,
          type: excalidrawType,
          x,
          y,
          width,
          height,
          strokeColor,
          backgroundColor,
          fillStyle: "solid",
          strokeWidth: element.style?.stroke_width || (isHeader ? 2 : 1.5),
          strokeStyle: "solid",
          roughness: 1,
          roundness: (type === "rectangle" || type === "note") ? { type: 3 } : null,
          label: textContent ? {
            text: textContent,
            fontSize: element.style?.font_size || fontSize,
            textAlign: isCentered ? "center" : "left",
            verticalAlign: isCentered ? "middle" : "top",
          } : undefined,
        };
        skeletons.push(skeleton);
      }
    });

    // Step 3: Build Skeletons for Arrow Connections with directional perimeter anchor calculation
    const isBrainDump = visualType === "brain_dump" || layout === "cluster";

    rawConnections.forEach((conn, index) => {
      const fromId = String(conn.from_id || conn.from);
      const toId = String(conn.to_id || conn.to);
      const fromShape = shapeLookup.get(fromId);
      const toShape = shapeLookup.get(toId);

      if (!fromShape || !toShape) {
        console.warn(`[CANVAS] ⚠️ Arrow skipped: cannot find shapes for ${fromId} -> ${toId}`);
        return;
      }

      // Arrow reduction rule: Skip header-to-note arrows in brain dump mode
      if (isBrainDump) {
        const fromKind = fromShape.metadata?.kind;
        const toKind = toShape.metadata?.kind;
        if (fromKind === "area" || toKind === "area" || fromId.includes("area") || toId.includes("area")) {
          console.log(`[CANVAS] 🛡️ Pruning redundant brain dump arrow between ${fromId} and ${toId}`);
          return;
        }
      }

      // Calculate directional perimeter anchors so arrow vectors span correctly across canvas
      const fromPos = fromShape.position || { x: 0, y: 0 };
      const fromSize = fromShape.size || { width: 220, height: 80 };
      const toPos = toShape.position || { x: 0, y: 0 };
      const toSize = toShape.size || { width: 220, height: 80 };

      const fromCenter = {
        x: fromPos.x + fromSize.width / 2,
        y: fromPos.y + fromSize.height / 2,
      };
      const toCenter = {
        x: toPos.x + toSize.width / 2,
        y: toPos.y + toSize.height / 2,
      };

      const dxCenter = toCenter.x - fromCenter.x;
      const dyCenter = toCenter.y - fromCenter.y;
      const isHorizontal = Math.abs(dxCenter) >= Math.abs(dyCenter);

      let startX = 0;
      let startY = 0;
      let endX = 0;
      let endY = 0;

      if (isHorizontal) {
        if (dxCenter >= 0) {
          startX = fromPos.x + fromSize.width;
          startY = fromPos.y + fromSize.height / 2;
          endX = toPos.x;
          endY = toPos.y + toSize.height / 2;
        } else {
          startX = fromPos.x;
          startY = fromPos.y + fromSize.height / 2;
          endX = toPos.x + toSize.width;
          endY = toPos.y + toSize.height / 2;
        }
      } else {
        if (dyCenter >= 0) {
          startX = fromPos.x + fromSize.width / 2;
          startY = fromPos.y + fromSize.height;
          endX = toPos.x + toSize.width / 2;
          endY = toPos.y;
        } else {
          startX = fromPos.x + fromSize.width / 2;
          startY = fromPos.y;
          endX = toPos.x + toSize.width / 2;
          endY = toPos.y + toSize.height;
        }
      }

      const dx = endX - startX;
      const dy = endY - startY;
      const arrowColor = darkMode ? "#94a3b8" : "#64748b";

      skeletons.push({
        id: `arrow_${fromId}_${toId}_${index}`,
        type: "arrow",
        x: startX,
        y: startY,
        points: [[0, 0], [dx, dy]],
        start: { id: fromId },
        end: { id: toId },
        strokeColor: arrowColor,
        strokeWidth: 2,
        roundness: { type: 2 },
        label: conn.label ? {
          text: conn.label,
          fontSize: 13,
        } : undefined,
      });
    });

    console.log(`[CANVAS] ⚙️ Passing ${skeletons.length} skeletons to convertToExcalidrawElements...`);

    // Step 4: Convert skeletons with official Excalidraw utility
    try {
      const excalidrawElements = convertToExcalidrawElements(skeletons, {
        regenerateIds: false,
      });
      console.log(`[CANVAS] ✅ convertToExcalidrawElements produced ${excalidrawElements.length} elements`);
      return excalidrawElements;
    } catch (convErr) {
      console.error("[CANVAS] ❌ convertToExcalidrawElements failed:", convErr);
      return [];
    }
  };

  /**
   * Infer layout strategy from visual_type
   */
  const inferLayoutFromVisualType = (visualType) => {
    switch (visualType) {
      case "user_flow":
      case "flowchart":
      case "process":
      case "timeline":
      case "sequence":
        return "left_to_right";
      case "architecture":
      case "system_diagram":
        return "top_to_bottom";
      case "brain_dump":
      case "concept_map":
      case "mind_map":
        return "cluster";
      default:
        return "cluster";
    }
  };

  /**
   * Calculates deterministic coordinates when elements lack explicit positions
   */
  const calculateLayoutPositions = (elements, layout, visualType, cmdIndex, connections = [], startOffsetY = 100) => {
    const startX = 100;
    const startY = startOffsetY;

    // Brain dump & cluster layout: organize by category columns
    if (layout === "cluster" || visualType === "brain_dump" || visualType === "concept_map" || visualType === "mind_map") {
      return layoutClusterColumns(elements, startX, startY);
    }

    // Left-to-right layout (flowcharts, user flows, timelines, process)
    if (layout === "left_to_right" || visualType === "user_flow" || visualType === "flowchart" || visualType === "process" || visualType === "timeline" || visualType === "sequence") {
      return layoutLeftToRight(elements, startX, startY, connections, visualType);
    }

    // Top-to-bottom layout (architecture diagrams, system diagrams, hierarchies)
    if (layout === "top_to_bottom" || layout === "hierarchical" || visualType === "architecture" || visualType === "system_diagram") {
      return layoutTopToBottom(elements, startX, startY, connections, visualType);
    }

    // Fallback: Default clean category column grid
    return layoutClusterColumns(elements, startX, startY);
  };

  /**
   * Layout engine for Left-to-Right flows (user flows, flowcharts, timelines)
   * Supports:
   * 1. Explicit metadata.row (e.g. row 0 = happy path, row 1 = error/alt path)
   * 2. Decision node automatic branching (diamonds branching to parallel rows)
   * 3. Clean horizontal flow with dynamic width spacing
   */
  const layoutLeftToRight = (elements, startX, startY, connections = [], visualType = "user_flow") => {
    // Check if any element has explicit metadata.row
    const hasRowMetadata = elements.some(
      (el) => el.metadata && typeof el.metadata.row === "number"
    );

    const gapX = visualType === "flowchart" || visualType === "user_flow" ? 90 : 100;
    const rowGapY = 130; // vertical spacing between branch rows

    if (hasRowMetadata) {
      // Group elements by row
      const rowsMap = new Map();
      elements.forEach((el) => {
        const r = el.metadata?.row ?? 0;
        if (!rowsMap.has(r)) rowsMap.set(r, []);
        rowsMap.get(r).push(el);
      });

      const positioned = [];
      const sortedRowKeys = Array.from(rowsMap.keys()).sort((a, b) => a - b);

      // Check if column metadata is used
      const hasColMetadata = elements.some(
        (el) => el.metadata && typeof el.metadata.column === "number"
      );

      if (hasColMetadata) {
        // Compute column X coordinates based on maximum element width per column
        const colWidths = new Map();
        elements.forEach((el) => {
          const c = el.metadata?.column ?? 0;
          const { width } = estimateElementDimensions(el, false, visualType);
          const currentMax = colWidths.get(c) || 0;
          colWidths.set(c, Math.max(currentMax, width));
        });

        const maxCol = Math.max(...Array.from(colWidths.keys()), 0);
        const colXPositions = [];
        let curX = startX;
        for (let c = 0; c <= maxCol; c++) {
          colXPositions[c] = curX;
          curX += (colWidths.get(c) || 220) + gapX;
        }

        elements.forEach((el) => {
          const hasExplicitPos = el.position && typeof el.position.x === "number" && typeof el.position.y === "number" && (el.position.x !== 0 || el.position.y !== 0);
          const { width, height } = estimateElementDimensions(el, false, visualType);
          if (hasExplicitPos) {
            positioned.push({ ...el, size: { width, height } });
            return;
          }

          const r = el.metadata?.row ?? 0;
          const c = el.metadata?.column ?? 0;
          const x = colXPositions[c] ?? (startX + c * (220 + gapX));
          const y = startY + r * rowGapY;

          positioned.push({
            ...el,
            position: { x, y },
            size: { width, height },
          });
        });

        return positioned;
      }

      // If rows are specified but not columns, layout each row sequentially
      sortedRowKeys.forEach((rowKey) => {
        const rowEls = rowsMap.get(rowKey);
        let curX = startX;
        const rowY = startY + rowKey * rowGapY;

        rowEls.forEach((el) => {
          const hasExplicitPos = el.position && typeof el.position.x === "number" && typeof el.position.y === "number" && (el.position.x !== 0 || el.position.y !== 0);
          const { width, height } = estimateElementDimensions(el, false, visualType);

          if (hasExplicitPos) {
            positioned.push({ ...el, size: { width, height } });
            return;
          }

          const x = curX;
          const y = rowY;
          curX += width + gapX;

          positioned.push({
            ...el,
            position: { x, y },
            size: { width, height },
          });
        });
      });

      return positioned;
    }

    // Auto-detect decision branches from connections
    const outgoingMap = new Map();
    connections.forEach((conn) => {
      if (conn.from_id && conn.to_id) {
        if (!outgoingMap.has(conn.from_id)) outgoingMap.set(conn.from_id, []);
        outgoingMap.get(conn.from_id).push(conn.to_id);
      }
    });

    const branchElements = new Set();
    outgoingMap.forEach((targets) => {
      if (targets.length >= 2) {
        // Keep first target on main line, place remaining on branch row
        for (let i = 1; i < targets.length; i++) {
          branchElements.add(targets[i]);
        }
      }
    });

    const positioned = [];
    let currentMainX = startX;
    const parentPositions = new Map();

    elements.forEach((el) => {
      const elId = String(el.id);
      const hasExplicitPos = el.position && typeof el.position.x === "number" && typeof el.position.y === "number" && (el.position.x !== 0 || el.position.y !== 0);
      const { width, height } = estimateElementDimensions(el, false, visualType);

      if (hasExplicitPos) {
        positioned.push({ ...el, size: { width, height } });
        parentPositions.set(elId, { x: el.position.x, width });
        return;
      }

      if (branchElements.has(elId)) {
        // Find source decision node to align near it
        let sourcePos = null;
        for (const [fromId, targets] of outgoingMap.entries()) {
          if (targets.includes(elId) && parentPositions.has(fromId)) {
            sourcePos = parentPositions.get(fromId);
            break;
          }
        }

        const x = sourcePos ? sourcePos.x : currentMainX;
        const y = startY + rowGapY;

        positioned.push({
          ...el,
          position: { x, y },
          size: { width, height },
        });
        parentPositions.set(elId, { x, width });
      } else {
        const x = currentMainX;
        const y = startY;
        currentMainX += width + gapX;

        positioned.push({
          ...el,
          position: { x, y },
          size: { width, height },
        });
        parentPositions.set(elId, { x, width });
      }
    });

    return positioned;
  };

  /**
   * Layout engine for Top-to-Bottom structures (architecture diagrams, system designs, hierarchies)
   */
  const layoutTopToBottom = (elements, startX, startY, connections = [], visualType = "architecture") => {
    const hasRowMetadata = elements.some(
      (el) => el.metadata && typeof el.metadata.row === "number"
    );

    const layerGapY = 110;
    const siblingGapX = 60;

    if (hasRowMetadata) {
      const rowsMap = new Map();
      elements.forEach((el) => {
        const r = el.metadata?.row ?? 0;
        if (!rowsMap.has(r)) rowsMap.set(r, []);
        rowsMap.get(r).push(el);
      });

      const positioned = [];
      const sortedRowKeys = Array.from(rowsMap.keys()).sort((a, b) => a - b);

      sortedRowKeys.forEach((rowKey) => {
        const rowEls = rowsMap.get(rowKey);
        const rowY = startY + rowKey * layerGapY;
        const totalRowWidth = rowEls.reduce((sum, el) => {
          const { width } = estimateElementDimensions(el, false, visualType);
          return sum + width;
        }, 0) + (rowEls.length - 1) * siblingGapX;

        let curX = startX - (totalRowWidth / 2) + 120;

        rowEls.forEach((el) => {
          const hasExplicitPos = el.position && typeof el.position.x === "number" && typeof el.position.y === "number" && (el.position.x !== 0 || el.position.y !== 0);
          const { width, height } = estimateElementDimensions(el, false, visualType);

          if (hasExplicitPos) {
            positioned.push({ ...el, size: { width, height } });
            return;
          }

          const x = curX;
          const y = rowY;
          curX += width + siblingGapX;

          positioned.push({
            ...el,
            position: { x, y },
            size: { width, height },
          });
        });
      });

      return positioned;
    }

    let currentY = startY;
    const positioned = [];

    elements.forEach((el) => {
      const hasExplicitPos = el.position && typeof el.position.x === "number" && typeof el.position.y === "number" && (el.position.x !== 0 || el.position.y !== 0);
      const { width, height } = estimateElementDimensions(el, false, visualType);

      if (hasExplicitPos) {
        positioned.push({ ...el, size: { width, height } });
        return;
      }

      const x = startX;
      const y = currentY;
      currentY += height + layerGapY;

      positioned.push({
        ...el,
        position: { x, y },
        size: { width, height },
      });
    });

    return positioned;
  };

  /**
   * Organizes elements into distinct vertical category columns side-by-side
   */
  const layoutClusterColumns = (elements, startX, startY) => {
    const categories = new Map(); // normalizedKey -> { key, title, header: null, items: [] }
    const uncategorized = [];

    // Helper to get normalized alphanumeric key
    const getCatKey = (str) => (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    // Pass 1: Identify and create area headers
    elements.forEach((el) => {
      const isArea = el.metadata?.kind === "area" ||
                     el.id?.toLowerCase().startsWith("area") ||
                     el.id?.toLowerCase().includes("header");

      if (isArea) {
        const catName = el.metadata?.category || el.text || el.id;
        const key = getCatKey(catName) || getCatKey(el.id);
        if (!categories.has(key)) {
          categories.set(key, { key, title: el.text || catName, header: el, items: [] });
        } else {
          const group = categories.get(key);
          if (!group.header) group.header = el;
        }
      }
    });

    // Pass 2: Group note cards under matching area headers
    elements.forEach((el) => {
      const isArea = el.metadata?.kind === "area" ||
                     el.id?.toLowerCase().startsWith("area") ||
                     el.id?.toLowerCase().includes("header");
      if (isArea) return;

      const elCat = el.metadata?.category;
      let matchedGroup = null;

      if (elCat) {
        const key = getCatKey(elCat);
        if (categories.has(key)) {
          matchedGroup = categories.get(key);
        } else {
          for (const [gKey, group] of categories.entries()) {
            if (gKey.includes(key) || key.includes(gKey)) {
              matchedGroup = group;
              break;
            }
          }
        }
      }

      // Try matching by ID prefix (e.g. note_health_1 -> health)
      if (!matchedGroup && el.id) {
        const idKey = getCatKey(el.id.replace(/^note_/, "").replace(/_\d+$/, ""));
        for (const [gKey, group] of categories.entries()) {
          if (gKey.includes(idKey) || idKey.includes(gKey)) {
            matchedGroup = group;
            break;
          }
        }
      }

      if (matchedGroup) {
        matchedGroup.items.push(el);
      } else if (elCat) {
        const key = getCatKey(elCat);
        const newGroup = { key, title: elCat, header: null, items: [el] };
        categories.set(key, newGroup);
      } else {
        uncategorized.push(el);
      }
    });

    // If no categories were extracted, arrange in a responsive column grid
    if (categories.size === 0) {
      const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(elements.length))));
      const colWidth = 330;
      const colGap = 60;
      const rowGap = 20;
      const colYPositions = new Array(cols).fill(startY);

      return elements.map((el, idx) => {
        const isHeader = el.metadata?.kind === "area" || idx < cols;
        const { width, height } = estimateElementDimensions(el, isHeader);
        const colIdx = idx % cols;
        const x = startX + colIdx * (colWidth + colGap);
        const y = colYPositions[colIdx];
        colYPositions[colIdx] += height + rowGap;

        return {
          ...el,
          position: { x, y },
          size: { width, height },
        };
      });
    }

    const groups = Array.from(categories.values()).filter(g => g.header || g.items.length > 0);
    const colWidth = 330;
    const colGap = 60;
    const rowGap = 20;
    const headerRowGap = 26;
    const positioned = [];

    groups.forEach((group, colIdx) => {
      const colX = startX + colIdx * (colWidth + colGap);
      let currentY = startY;

      // Header card at top of column
      if (group.header) {
        const { width, height } = estimateElementDimensions(group.header, true);
        positioned.push({
          ...group.header,
          position: { x: colX, y: currentY },
          size: { width, height },
        });
        currentY += height + headerRowGap;
      }

      // Notes / Sub-cards stacked underneath with guaranteed vertical margins
      group.items.forEach((item) => {
        const { width, height } = estimateElementDimensions(item, false);
        positioned.push({
          ...item,
          position: { x: colX, y: currentY },
          size: { width, height },
        });
        currentY += height + rowGap;
      });
    });

    // Place any uncategorized items into an extra column
    if (uncategorized.length > 0) {
      const colX = startX + groups.length * (colWidth + colGap);
      let currentY = startY;

      uncategorized.forEach((item) => {
        const { width, height } = estimateElementDimensions(item, false);
        positioned.push({
          ...item,
          position: { x: colX, y: currentY },
          size: { width, height },
        });
        currentY += height + rowGap;
      });
    }

    return positioned;
  };

  /**
   * Handle user changes to canvas (save to localStorage)
   */
  const handleCanvasChange = (elements, state) => {
    setCanvasElements(elements);
    setAppState(state);
  };

  // Load saved canvas on initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("thoughtcanvas-excalidraw");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.elements && parsed.elements.length > 0) {
          console.log(`[CANVAS] 💾 Loaded ${parsed.elements.length} saved canvas element(s) from localStorage`);
          setCanvasElements(parsed.elements);
        }
      }
    } catch (e) {
      console.warn("[CANVAS] Could not load saved canvas from localStorage:", e);
    }
  }, []);

  // Save canvas changes to localStorage
  useEffect(() => {
    if (canvasElements && canvasElements.length > 0) {
      try {
        localStorage.setItem(
          "thoughtcanvas-excalidraw",
          JSON.stringify({
            elements: canvasElements,
            appState: {
              viewBackgroundColor: isDarkMode ? "#121212" : "#f8f9fa",
            },
          })
        );
      } catch (e) {
        console.warn("[CANVAS] Could not save canvas to localStorage:", e);
      }
    }
  }, [canvasElements, isDarkMode]);

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      <Excalidraw
        excalidrawAPI={handleExcalidrawAPI}
        onChange={handleCanvasChange}
        initialData={{
          elements: canvasElements,
          appState: {
            theme: isDarkMode ? "dark" : "light",
            viewBackgroundColor: isDarkMode ? "#121212" : "#f8f9fa",
          },
        }}
      />

      {loading && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            background: isDarkMode ? "rgba(18, 18, 18, 0.9)" : "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(8px)",
            border: isDarkMode ? "1px solid rgba(255, 255, 255, 0.15)" : "1px solid rgba(0, 0, 0, 0.1)",
            padding: "10px 20px",
            borderRadius: 10,
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
            zIndex: 1000,
            color: isDarkMode ? "#f3f4f6" : "#111827",
            fontSize: 14,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#3b82f6",
              animation: "pulse 1.5s infinite",
            }}
          />
          Creating visual representation...
        </div>
      )}
    </div>
  );
}
