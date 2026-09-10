import { useEffect, useState } from "react";
import Canvas from "./components/Canvas.jsx";
import InputBox from "./components/InputBox.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";

const THEME_KEY = "thoughtcanvas-theme";
const DATA_KEY = "thoughtcanvas-data";

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "dark");
  const [organizeResult, setOrganizeResult] = useState(() => {
    try {
      const saved = localStorage.getItem(DATA_KEY);
      return saved ? JSON.parse(saved) : { items: [], relationships: [] };
    } catch {
      return { items: [], relationships: [] };
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
      localStorage.setItem(DATA_KEY, JSON.stringify(organizeResult));
    } catch (e) {
      console.warn("Could not save canvas state to localStorage:", e);
    }
  }, [organizeResult]);

  async function organize(text) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          current_items: organizeResult.items,
          current_relationships: organizeResult.relationships,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = Array.isArray(data.detail)
          ? data.detail.map((item) => item.msg || JSON.stringify(item)).join(", ")
          : data.detail;
        throw new Error(detail || data.error || "Could not organize thoughts");
      }
      setOrganizeResult({
        items: data.items || [],
        relationships: data.relationships || [],
      });
    } catch (err) {
      setError(err.message || "Could not organize thoughts");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">ThoughtCanvas</h1>
        <ThemeToggle
          theme={theme}
          onToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
        />
      </header>
      <Canvas
        items={organizeResult.items}
        relationships={organizeResult.relationships}
        loading={loading}
        theme={theme}
      />
      <InputBox loading={loading} error={error} onOrganize={organize} />
    </div>
  );
}
