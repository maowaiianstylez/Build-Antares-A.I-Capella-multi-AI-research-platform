"use client";

// Voice in and out using the browser's built-in speech engines (no extra service or key).
// Speech recognition works in Chrome, Edge, and Safari; speaking works in every modern browser.
import { useCallback, useEffect, useRef, useState } from "react";

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getRecognition(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Turns Markdown into something pleasant to hear: no symbols, links read as their text, code skipped. */
export function speakableText(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, " I've put the code on screen. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[\d+\]/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/[*_~>|]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .trim();
}

export function useVoice({ onFinalTranscript }: { onFinalTranscript: (text: string) => void }) {
  const [supported, setSupported] = useState({ listen: false, speak: false });
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<Recognition | null>(null);
  const finalCb = useRef(onFinalTranscript);

  useEffect(() => {
    finalCb.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    const t = setTimeout(() =>
      setSupported({ listen: Boolean(getRecognition()), speak: typeof window !== "undefined" && "speechSynthesis" in window }),
    );
    return () => clearTimeout(t);
  }, []);

  const stopListening = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const listen = useCallback(() => {
    const Rec = getRecognition();
    if (!Rec || recRef.current) return;
    window.speechSynthesis?.cancel();
    const rec = new Rec();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let partial = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else partial += r[0].transcript;
      }
      setInterim(finalText + partial);
    };
    rec.onerror = () => {
      finalText = "";
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      setInterim("");
      if (finalText.trim()) finalCb.current(finalText.trim());
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, []);

  const speak = useCallback((markdown: string, onDone?: () => void) => {
    if (!("speechSynthesis" in window)) return onDone?.();
    window.speechSynthesis.cancel();
    const text = speakableText(markdown);
    if (!text) return onDone?.();
    // Long answers are split into sentences; some browsers stop speaking very long utterances.
    const parts = text.match(/[^.!?]+[.!?]*/g) ?? [text];
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part.trim());
      u.lang = navigator.language || "en-US";
      if (i === 0) u.onstart = () => setSpeaking(true);
      if (i === parts.length - 1) {
        u.onend = () => {
          setSpeaking(false);
          onDone?.();
        };
      }
      window.speechSynthesis.speak(u);
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  useEffect(
    () => () => {
      recRef.current?.abort();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    },
    [],
  );

  return { supported, listening, speaking, interim, listen, stopListening, speak, stopSpeaking };
}
