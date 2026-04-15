import { useEffect, useRef, useState, useCallback } from "react";
import { Keypad, KeyboardProvider, useKeyboardSound } from "../components/ui/keyboard";
import { cn } from "../lib/utils";

const TEXT = "What should I write about today?";
const TYPE_SPEED = 80;
const KEY_HOLD_MS = 100;
const PAUSE_AFTER_TYPE = 800;
const FADE_DURATION = 600;

function charToKeyCode(ch: string): string {
  if (ch === " ") return "Space";
  if (ch === "?") return "Slash";
  const upper = ch.toUpperCase();
  if (upper >= "A" && upper <= "Z") return `Key${upper}`;
  return "";
}

function IntroInner({ onComplete }: { onComplete?: () => void }) {
  const { setPressed, setReleased, playSoundDown, playSoundUp } = useKeyboardSound();
  const [displayed, setDisplayed] = useState("");
  const [exiting, setExiting] = useState(false);
  const idx = useRef(0);
  const started = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const pressKey = useCallback(
    (code: string) => {
      if (!code) return;
      playSoundDown(code);
      setPressed(code);
      setTimeout(() => {
        playSoundUp(code);
        setReleased(code);
      }, KEY_HOLD_MS);
    },
    [playSoundDown, playSoundUp, setPressed, setReleased],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const tick = () => {
      if (idx.current >= TEXT.length) {
        setTimeout(() => setExiting(true), PAUSE_AFTER_TYPE);
        setTimeout(() => onCompleteRef.current?.(), PAUSE_AFTER_TYPE + FADE_DURATION);
        return;
      }
      const ch = TEXT[idx.current];
      setDisplayed(TEXT.slice(0, idx.current + 1));
      pressKey(charToKeyCode(ch));
      idx.current++;
      setTimeout(tick, TYPE_SPEED);
    };

    setTimeout(tick, 600);
  }, [pressKey]);

  const done = displayed.length >= TEXT.length;

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen gap-8"
      style={{
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'scale(0.97) translateY(-20px)' : 'scale(1) translateY(0)',
        transition: `opacity ${FADE_DURATION}ms ease, transform ${FADE_DURATION}ms ease`,
      }}
    >
      <h1 className="text-[36px] font-semibold text-center" style={{ color: 'var(--color-text-primary)' }}>
        {displayed}
        {!done && (
          <span className={cn("inline-block ml-0.5 w-[3px] h-[1em] bg-current align-middle animate-blink-cursor")} />
        )}
      </h1>
      <div style={{ zoom: 2 }}>
        <Keypad />
      </div>
    </div>
  );
}

export default function Intro({ onComplete }: { onComplete?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={containerRef}>
      <KeyboardProvider enableSound containerRef={containerRef}>
        <IntroInner onComplete={onComplete} />
      </KeyboardProvider>
    </div>
  );
}
