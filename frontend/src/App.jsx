import { useEffect, useState } from "react";
import Canvas from "./components/Canvas.jsx";
import InputBox from "./components/InputBox.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";

const THEME_KEY = "thoughtcanvas-theme";
const VISUAL_COMMANDS_KEY = "thoughtcanvas-visual-commands";

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "dark");
  const [visualCommands, setVisualCommands] = useState(() => {
    try {
      const saved = localStorage.getItem(VISUAL_COMMANDS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(VISUAL_COMMANDS_KEY, JSON.stringify(visualCommands));
    } catch (e) {
      console.warn("Could not save visual commands to localStorage:", e);
    }
  }, [visualCommands]);

  async function organize(text, options = {}) {
    setLoading(true);
    setError("");
    console.log("[FRONTEND] 🚀 /api/organize requested with text:", text, "options:", options);
    console.log("[FRONTEND] Current visualCommands before request:", visualCommands);

    try {
      const response = await fetch("/api/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          current_canvas: visualCommands,
          is_call_mode: options.isCallMode || false,
        }),
      });

      console.log(`[FRONTEND] 📡 Response status: ${response.status} ${response.statusText}`);
      const data = await response.json();
      console.log("[FRONTEND] 📦 Received payload from backend:", data);

      if (!response.ok) {
        const detail = Array.isArray(data.detail)
          ? data.detail.map((item) => item.msg || JSON.stringify(item)).join(", ")
          : data.detail;
        throw new Error(detail || data.error || "Could not process visual command");
      }

      // Set new visual commands, replacing previous canvas scene on new visualizations
      if (data.commands && data.commands.length > 0) {
        console.log(`[FRONTEND] ✨ Setting ${data.commands.length} visual command(s) into state`);
        // Always replace with fresh generated commands to prevent stale overlapping layers
        setVisualCommands(data.commands);
      } else {
        console.warn("[FRONTEND] ⚠️ Response contained 0 visual commands");
      }

      return data;
    } catch (err) {
      console.error("[FRONTEND] ❌ Error in organize:", err);
      setError(err.message || "Could not process visual command");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    console.log("[FRONTEND] 🧹 Clearing canvas and reset state");
    setVisualCommands([]);
    try {
      localStorage.removeItem(VISUAL_COMMANDS_KEY);
      localStorage.removeItem("thoughtcanvas-excalidraw");
    } catch (e) {
      console.warn("Error clearing localStorage:", e);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">ThoughtCanvas</h1>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {visualCommands.length > 0 && (
            <button
              onClick={handleClear}
              title="Clear Canvas"
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--panel)",
                color: "var(--muted)",
                cursor: "pointer",
                fontWeight: 500,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
            >
              Clear Canvas
            </button>
          )}
          <ThemeToggle
            theme={theme}
            onToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
          />
        </div>
      </header>
      <div className="canvas-wrap">
        <Canvas
          visualCommands={visualCommands}
          loading={loading}
          theme={theme}
        />
      </div>
      <InputBox loading={loading} error={error} onOrganize={organize} />
    </div>
  );
}
