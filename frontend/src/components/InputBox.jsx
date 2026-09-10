import { useEffect, useRef, useState } from "react";

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function InputBox({ loading, error, onOrganize }) {
  const [text, setText] = useState("");
  const [dictating, setDictating] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState("Listening...");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [assistantFeedback, setAssistantFeedback] = useState("");
  const [micHint, setMicHint] = useState("");

  const SpeechRecognition = getSpeechRecognition();
  const recognitionRef = useRef(null);
  const currentAudioRef = useRef(null);
  const callActiveRef = useRef(false);
  const dictatingRef = useRef(false);
  const isAssistantSpeakingRef = useRef(false);
  const isLoadingRef = useRef(false);

  // Buffer for Live Call continuous transcription
  const turnBufferRef = useRef("");
  const silenceTimerRef = useRef(null);
  const extensionTimerRef = useRef(null);

  // Sync refs with state
  useEffect(() => {
    callActiveRef.current = callActive;
  }, [callActive]);

  useEffect(() => {
    dictatingRef.current = dictating;
  }, [dictating]);

  useEffect(() => {
    isLoadingRef.current = loading;
  }, [loading]);

  // Cleanup timers & recognition on unmount
  useEffect(() => {
    return () => {
      callActiveRef.current = false;
      dictatingRef.current = false;
      clearTimers();
      stopCurrentAudio();
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore abort error
      }
    };
  }, []);

  function clearTimers() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (extensionTimerRef.current) {
      clearTimeout(extensionTimerRef.current);
      extensionTimerRef.current = null;
    }
  }

  function stopCurrentAudio() {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = "";
      } catch {
        // ignore
      }
      currentAudioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  // --- Voice Feedback (TTS) ---
  function fallbackSpeechSynthesis(feedbackText) {
    if (!feedbackText || typeof window === "undefined" || !window.speechSynthesis) {
      isAssistantSpeakingRef.current = false;
      if (callActiveRef.current) setCallStatus("Listening...");
      return;
    }

    try {
      window.speechSynthesis.cancel();
      isAssistantSpeakingRef.current = true;
      setCallStatus("Assistant speaking...");

      const utterance = new SpeechSynthesisUtterance(feedbackText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices() || [];
      const naturalVoice =
        voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.includes("Natural") ||
              v.name.includes("Neural") ||
              v.name.includes("Google") ||
              v.name.includes("Jenny") ||
              v.name.includes("Guy") ||
              v.name.includes("Samantha"))
        ) || voices.find((v) => v.lang.startsWith("en"));

      if (naturalVoice) {
        utterance.voice = naturalVoice;
      }

      utterance.onend = () => {
        isAssistantSpeakingRef.current = false;
        if (callActiveRef.current) {
          setCallStatus("Listening...");
        }
      };

      utterance.onerror = () => {
        isAssistantSpeakingRef.current = false;
        if (callActiveRef.current) {
          setCallStatus("Listening...");
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Speech synthesis error:", err);
      isAssistantSpeakingRef.current = false;
      if (callActiveRef.current) {
        setCallStatus("Listening...");
      }
    }
  }

  async function speakAssistantFeedback(feedbackText) {
    if (!feedbackText) {
      if (callActiveRef.current) setCallStatus("Listening...");
      return;
    }

    stopCurrentAudio();
    isAssistantSpeakingRef.current = true;
    setCallStatus("Assistant speaking...");

    try {
      const audioUrl = `/api/tts?text=${encodeURIComponent(feedbackText)}`;
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      audio.onended = () => {
        currentAudioRef.current = null;
        isAssistantSpeakingRef.current = false;
        if (callActiveRef.current) {
          setCallStatus("Listening...");
        }
      };

      audio.onerror = () => {
        console.warn("Neural TTS fetch error, falling back to browser speech synthesis");
        currentAudioRef.current = null;
        fallbackSpeechSynthesis(feedbackText);
      };

      await audio.play();
    } catch (err) {
      console.warn("Audio play error, falling back to browser voice:", err);
      fallbackSpeechSynthesis(feedbackText);
    }
  }

  // --- Process Speech Turn in Call Mode ---
  async function processCallTurn(transcript) {
    const cleanText = transcript.trim();
    if (!cleanText || isLoadingRef.current) return;

    setCallStatus("Organizing canvas...");
    setLiveTranscript("");
    turnBufferRef.current = "";

    try {
      const result = await onOrganize(cleanText, { isCallMode: true });
      if (result && result.assistant_feedback) {
        setAssistantFeedback(result.assistant_feedback);
        speakAssistantFeedback(result.assistant_feedback);
      } else {
        setCallStatus("Listening...");
      }
    } catch (err) {
      console.error("Call mode organize error:", err);
      setCallStatus("Listening...");
    }
  }

  // --- Schedule Silence Debounce (2.0s silence + >=4 words threshold) ---
  function scheduleSilenceDebounce() {
    clearTimers();

    silenceTimerRef.current = setTimeout(() => {
      if (!callActiveRef.current || isAssistantSpeakingRef.current || isLoadingRef.current) {
        return;
      }

      const currentText = turnBufferRef.current.trim();
      const words = currentText.split(/\s+/).filter(Boolean);

      if (words.length >= 4) {
        // High confidence speech block: dispatch immediately!
        processCallTurn(currentText);
      } else if (words.length >= 1) {
        // Short fragment (e.g. "hello", "um", "wait"): wait extra 2.0s before deciding
        setCallStatus("Listening for more...");
        extensionTimerRef.current = setTimeout(() => {
          if (!callActiveRef.current || isAssistantSpeakingRef.current || isLoadingRef.current) {
            return;
          }
          const extendedText = turnBufferRef.current.trim();
          const extWords = extendedText.split(/\s+/).filter(Boolean);

          if (extWords.length >= 4) {
            processCallTurn(extendedText);
          } else {
            // Still below word threshold: discard noise/fillers without making API call
            turnBufferRef.current = "";
            setLiveTranscript("");
            setCallStatus("Listening...");
          }
        }, 2000);
      } else {
        setLiveTranscript("");
        setCallStatus("Listening...");
      }
    }, 2000);
  }

  // --- Start / Maintain Speech Recognition ---
  function startRecognition() {
    if (!SpeechRecognition) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    recognition.onstart = () => {
      setMicHint("");
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (dictatingRef.current) {
        setDictating(false);
      }
      setMicHint("Microphone error. You can still type your thoughts.");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      // Auto-restart if call mode is active or manual dictation is active
      if (callActiveRef.current || dictatingRef.current) {
        setTimeout(() => {
          if (callActiveRef.current || dictatingRef.current) {
            startRecognition();
          }
        }, 250);
      }
    };

    recognition.onresult = (event) => {
      // Ignore mic input if assistant is currently speaking back (prevents echo loop)
      if (isAssistantSpeakingRef.current) return;

      let interim = "";
      let finals = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finals += transcriptPart + " ";
        } else {
          interim += transcriptPart;
        }
      }

      if (callActiveRef.current) {
        // === LIVE CALL MODE ===
        if (finals) {
          turnBufferRef.current = (turnBufferRef.current + " " + finals).trim();
        }
        const fullCurrentSpoken = (turnBufferRef.current + " " + interim).trim();
        setLiveTranscript(fullCurrentSpoken);

        if (fullCurrentSpoken) {
          setCallStatus("Listening...");
          scheduleSilenceDebounce();
        }
      } else if (dictatingRef.current) {
        // === MANUAL IN-BOX DICTATION ===
        if (finals) {
          setText((current) => (current ? `${current.trim()} ${finals.trim()}` : finals.trim()));
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setTimeout(() => {
        if (callActiveRef.current || dictatingRef.current) {
          startRecognition();
        }
      }, 250);
    }
  }

  // --- Toggle Live Call Assistant Mode ---
  function toggleCallMode() {
    if (!SpeechRecognition) {
      setMicHint("Voice assistant call is not supported in this browser.");
      return;
    }

    if (callActive) {
      // Stop Call Mode
      setCallActive(false);
      callActiveRef.current = false;
      clearTimers();
      stopCurrentAudio();
      setLiveTranscript("");
      setCallStatus("Listening...");
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }
    } else {
      // Start Call Mode
      stopCurrentAudio();
      if (dictating) {
        setDictating(false);
        dictatingRef.current = false;
      }
      setCallActive(true);
      callActiveRef.current = true;
      setCallStatus("Listening...");
      turnBufferRef.current = "";
      setLiveTranscript("");
      startRecognition();
    }
  }

  // --- Toggle Manual Textarea Dictation ---
  function toggleDictate() {
    if (!SpeechRecognition) {
      setMicHint("Voice dictation is not supported in this browser.");
      return;
    }

    if (callActive) {
      // Turn off call mode if user clicks textarea mic
      setCallActive(false);
      callActiveRef.current = false;
      clearTimers();
      stopCurrentAudio();
    }

    if (dictating) {
      setDictating(false);
      dictatingRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    } else {
      setDictating(true);
      dictatingRef.current = true;
      startRecognition();
    }
  }

  // --- Manual Submit ---
  function handleSubmit(e) {
    if (e) e.preventDefault();
    const value = text.trim();
    if (!value || loading) return;
    onOrganize(value, { isCallMode: false });
    setText("");
    if (dictating) {
      setDictating(false);
      dictatingRef.current = false;
    }
  }

  return (
    <div className="input-wrapper">
      {/* Active Call Mode Status Banner */}
      {callActive && (
        <div className="call-banner" aria-live="polite">
          <div className="call-banner-left">
            <div className="call-live-indicator">
              <span className="live-pulse-dot" />
              <span className="call-title">Live Assistant Call</span>
            </div>
            <div className="call-waveform">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <span className="call-status-pill">{callStatus}</span>
          </div>

          {liveTranscript && (
            <div className="call-live-preview">
              <span className="preview-label">Hearing:</span>
              <span className="preview-text">&ldquo;{liveTranscript}&rdquo;</span>
            </div>
          )}

          {assistantFeedback && !liveTranscript && (
            <div className="call-feedback-preview">
              <span className="feedback-label">Assistant:</span>
              <span className="feedback-text">{assistantFeedback}</span>
            </div>
          )}

          <button
            type="button"
            className="end-call-button"
            onClick={toggleCallMode}
            title="End voice call"
          >
            ✕ End Call
          </button>
        </div>
      )}

      {/* Main ChatGPT-Style Input Bar */}
      <form className="chatgpt-input-bar" onSubmit={handleSubmit}>
        {/* Left: Call Assistant Mode Toggle */}
        <button
          type="button"
          className={`call-mode-button ${callActive ? "active" : ""}`}
          onClick={toggleCallMode}
          disabled={!SpeechRecognition}
          title={
            SpeechRecognition
              ? callActive
                ? "End Live Voice Call"
                : "Start Live Voice Call with Assistant"
              : "Live Voice Call unavailable"
          }
          aria-label={callActive ? "End Voice Call" : "Start Voice Call"}
        >
          {callActive ? (
            <span className="call-btn-inner">
              <span className="call-active-icon">📞</span>
              <span className="call-active-text">In Call</span>
            </span>
          ) : (
            <span className="call-btn-inner">
              <span className="call-idle-icon">📞</span>
              <span className="call-idle-text">Call Assistant</span>
            </span>
          )}
        </button>

        {/* Center: Textarea with inside mic button */}
        <div className="textbox-container">
          <textarea
            id="thought-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              callActive
                ? "Live Call is active — speak your thoughts hands-free, or type here..."
                : "Dump thoughts or refine canvas (e.g. 'split Studies into College and Career')..."
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            rows={1}
          />

          {/* Microphone inside textarea on the right side */}
          <button
            type="button"
            className={`inside-mic-button ${dictating ? "dictating" : ""}`}
            onClick={toggleDictate}
            disabled={!SpeechRecognition || callActive}
            title={
              dictating
                ? "Stop voice dictation"
                : "Dictate thoughts into textbox"
            }
            aria-label={dictating ? "Stop voice dictation" : "Dictate thoughts"}
          >
            🎤
          </button>
        </div>

        {/* Rightmost: Send / Organize Button */}
        <button
          type="submit"
          className="send-organize-button"
          disabled={loading || !text.trim()}
          title="Send & Organize thoughts"
        >
          {loading ? (
            <span className="loading-spinner-dots">...</span>
          ) : (
            <svg
              className="send-arrow-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          )}
        </button>
      </form>

      {error && <p className="input-error-msg">{error}</p>}
      {micHint && <p className="input-hint-msg">{micHint}</p>}
    </div>
  );
}
