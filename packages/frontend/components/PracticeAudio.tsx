"use client";
import { useEffect, useRef, useState } from "react";

export default function PracticeAudio({
  text,
  record = false,
}: {
  text: string;
  record?: boolean;
}) {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioUrl = useRef("");
  const mounted = useRef(true);
  const acquiring = useRef(false);
  const [requesting, setRequesting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
      window.speechSynthesis?.cancel();
    };
  }, []);
  const speak = (rate: number) => {
    setError("");
    if (!("speechSynthesis" in window)) {
      setError("Speech playback is unavailable in this browser.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = rate;
    utterance.onerror = () => {
      if (mounted.current)
        setError(
          "Speech playback failed. Check your browser's installed English voices.",
        );
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };
  const startRecording = async () => {
    if (acquiring.current || recording) return;
    acquiring.current = true;
    setRequesting(true);
    setError("");
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Recording requires a supported browser on localhost or HTTPS.",
        );
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const rec = new MediaRecorder(media);
      recorder.current = rec;
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        media.getTracks().forEach((t) => t.stop());
        if (!mounted.current) return;
        if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
        audioUrl.current = URL.createObjectURL(
          new Blob(chunks, { type: rec.mimeType }),
        );
        setUrl(audioUrl.current);
        setRecording(false);
      };
      rec.start();
      setRecording(true);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Microphone unavailable.");
    } finally {
      acquiring.current = false;
      if (mounted.current) setRequesting(false);
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button className="rounded border px-3 py-2" onClick={() => speak(1)}>
          Listen
        </button>
        <button className="rounded border px-3 py-2" onClick={() => speak(0.8)}>
          Listen slowly
        </button>
        <button
          className="rounded border px-3 py-2"
          onClick={() => window.speechSynthesis?.cancel()}
        >
          Stop audio
        </button>
        {record && (
          <button
            className="rounded border px-3 py-2"
            disabled={requesting}
            aria-pressed={recording}
            onClick={() =>
              recording ? recorder.current?.stop() : void startRecording()
            }
          >
            {requesting
              ? "Waiting for microphone…"
              : recording
                ? "Stop recording"
                : "Record my response"}
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Synthetic browser voice. Recordings stay in this tab and disappear when
        you leave; no automatic pronunciation score.
      </p>
      {url && <audio controls src={url} aria-label="Your recorded response" />}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
