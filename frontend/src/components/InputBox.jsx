import { useEffect, useRef, useState } from "react";

function getSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function InputBox({ loading, error, onOrganize }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [micHint, setMicHint] = useState("");
  const recognitionRef = useRef(null);
  const keepListening = useRef(false);
  const SpeechRecognition = getSpeechRecognition();

  useEffect(() => {
    return () => {
      keepListening.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  function startRecognition() {
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    recognition.onstart = () => {
      setListening(true);
      setMicHint("");
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      keepListening.current = false;
      setListening(false);
      setMicHint("Could not capture audio. You can still type your thoughts.");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      if (!keepListening.current) {
        setListening(false);
        return;
      }
      setTimeout(() => {
        if (keepListening.current) startRecognition();
      }, 250);
    };
    recognition.onresult = (event) => {
      let finals = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) finals += event.results[i][0].transcript;
      }
      finals = finals.trim();
      if (finals) {
        setText((current) => (current ? `${current.trim()} ${finals}` : finals));
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setTimeout(() => {
        if (keepListening.current) startRecognition();
      }, 250);
    }
  }

  function toggleMic() {
    if (!SpeechRecognition) {
      setMicHint("Voice input is not available in this browser.");
      return;
    }

    if (keepListening.current) {
      keepListening.current = false;
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    keepListening.current = true;
    startRecognition();
  }

  function submit() {
    const value = text.trim();
    if (!value || loading) return;
    onOrganize(value);
  }

  return (
    <form
      className="input-bar"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <button
        type="button"
        className={`mic-button ${listening ? "listening" : ""}`}
        onClick={toggleMic}
        disabled={!SpeechRecognition}
        title={SpeechRecognition ? (listening ? "Stop listening" : "Speak your thoughts") : "Voice input unavailable"}
        aria-label={listening ? "Stop listening" : "Microphone"}
      >
        🎤
      </button>

      <div className="input-main">
        {listening ? (
          <div className="mic-wave" aria-live="polite">
            <i />
            <i />
            <i />
            <i />
            <span>Listening — click mic to stop</span>
          </div>
        ) : (
          <label htmlFor="thought-input">What's on your mind?</label>
        )}
        <textarea
          id="thought-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type a messy thought, or use the microphone first..."
        />
      </div>

      <button type="submit" className="organize-button" disabled={loading || !text.trim()}>
        {loading ? "Organizing..." : "Organize Thoughts"}
      </button>

      {error ? <p className="error-text">{error}</p> : null}
      {micHint ? <p className="hint-text">{micHint}</p> : null}
    </form>
  );
}
