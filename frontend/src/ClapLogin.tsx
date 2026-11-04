import { useCallback, useEffect, useRef, useState } from "react";
import { createClapDetector, DEFAULT_CLAP_OPTIONS } from "./clapDetector";
import { listenToMicrophone, type MicrophoneListener } from "./microphone";

const REQUIRED_CLAPS = DEFAULT_CLAP_OPTIONS.requiredClaps;
/** How long the welcome moment shows before the app opens. */
export const WELCOME_MS = 600;

type MicStatus = "starting" | "listening" | "needs-tap" | "unavailable";

const STATUS_MESSAGES: Record<MicStatus, string> = {
  starting: "Asking for your microphone…",
  listening: "Listening… clap, clap, clap!",
  "needs-tap": "Tap the screen once so your browser lets us listen, then clap.",
  unavailable: "No microphone? Tap the Clap button three times instead.",
};

interface ClapLoginProps {
  onLogIn: () => void;
}

/**
 * The pink lock screen: clap three times (heard through the microphone) or tap the Clap button
 * three times to come in. Starts listening as soon as it opens.
 */
export function ClapLogin({ onLogIn }: ClapLoginProps) {
  const [claps, setClaps] = useState(0);
  const [status, setStatus] = useState<MicStatus>("starting");
  const [welcome, setWelcome] = useState(false);
  const [detector] = useState(() => createClapDetector());
  const listener = useRef<MicrophoneListener | null>(null);
  const resetTimer = useRef<number | undefined>(undefined);
  const welcomeTimer = useRef<number | undefined>(undefined);
  const done = useRef(false);
  const onLogInRef = useRef(onLogIn);

  useEffect(() => {
    onLogInRef.current = onLogIn;
  }, [onLogIn]);

  const countClap = useCallback((count: number) => {
    if (done.current) return;
    setClaps(count);
    window.clearTimeout(resetTimer.current);
    if (count >= REQUIRED_CLAPS) {
      done.current = true;
      setWelcome(true);
      listener.current?.stop();
      welcomeTimer.current = window.setTimeout(() => onLogInRef.current(), WELCOME_MS);
      return;
    }
    // Too slow: the detector starts over after this pause, so the hands go dark again too.
    resetTimer.current = window.setTimeout(() => setClaps(0), DEFAULT_CLAP_OPTIONS.maxGapMs);
  }, []);

  useEffect(() => {
    let cancelled = false;
    listenToMicrophone((level, timeMs) => {
      const count = detector.feed(level, timeMs);
      if (count !== null) countClap(count);
    })
      .then((mic) => {
        if (cancelled || done.current) {
          mic.stop();
          return;
        }
        listener.current = mic;
        setStatus(mic.suspended ? "needs-tap" : "listening");
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });
    return () => {
      cancelled = true;
      listener.current?.stop();
      listener.current = null;
      window.clearTimeout(resetTimer.current);
      window.clearTimeout(welcomeTimer.current);
    };
  }, [detector, countClap]);

  function wakeMicrophone() {
    listener.current?.resume();
    if (status === "needs-tap") setStatus("listening");
  }

  function tap() {
    wakeMicrophone();
    countClap(detector.clap(performance.now()));
  }

  return (
    <main className="clap-login" onPointerDown={wakeMicrophone}>
      <h1>
        Meme-Tinder{" "}
        <span className="sparkle" aria-hidden="true">
          💖
        </span>
      </h1>
      <section className="clap-card" aria-labelledby="clap-title">
        <h2 id="clap-title">Clap three times to log in</h2>
        <div className="clap-hands" role="img" aria-label={`${claps} of ${REQUIRED_CLAPS} claps`}>
          {Array.from({ length: REQUIRED_CLAPS }, (_, index) => (
            <span key={index} className={`clap-hand${index < claps ? " lit" : ""}`}>
              👏
            </span>
          ))}
        </div>
        <p className="clap-status" aria-live="polite">
          {welcome ? "Welcome in! 💖" : STATUS_MESSAGES[status]}
        </p>
        <button type="button" className="clap-button" onClick={tap} disabled={welcome}>
          <span className="emoji" aria-hidden="true">
            👏
          </span>
          Clap
        </button>
      </section>
    </main>
  );
}
