"use client";

import { useEffect, useRef, useState } from "react";

// Shared voice-input control for the app's idea-capture fields (home page,
// /try demo, new-post source field). Records audio client-side with
// MediaRecorder and uploads it to a transcription endpoint on stop, rather
// than using the browser's free Web Speech API — that approach has no
// Firefox support, flaky long sessions in Safari, and produces literal
// word-for-word transcripts with poor punctuation. Sending audio straight
// to Gemini lets the model clean it up the way it would any other input.
const MAX_RECORDING_SECONDS = 90;
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

type Status = "idle" | "recording" | "transcribing";

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  return MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "";
}

export function VoiceRecorderButton({
  endpoint,
  onTranscribed,
  disabled = false,
}: {
  endpoint: string;
  onTranscribed: (text: string) => void;
  disabled?: boolean;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function stopRecorder(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;

      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        resolve(blob.size > 0 ? blob : null);
      };

      recorder.stop();
    });
  }

  async function finishAndTranscribe() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setStatus("transcribing");

    const blob = await stopRecorder();

    if (!blob) {
      setErrorMessage("Didn't catch any audio. Try again.");
      setStatus("idle");
      return;
    }

    try {
      const formData = new FormData();
      const extension = blob.type.includes("mp4") ? "m4a" : "webm";
      formData.append("audio", blob, `voice-idea.${extension}`);

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      let payload: { text?: string; error?: string };

      try {
        payload = (await response.json()) as { text?: string; error?: string };
      } catch {
        throw new Error("Transcription failed. Please try again.");
      }

      if (!response.ok) {
        throw new Error(payload.error || "Transcription failed. Please try again.");
      }

      if (payload.text?.trim()) {
        onTranscribed(payload.text.trim());
      } else {
        setErrorMessage("Didn't catch any speech in that recording. Try again, or type it instead.");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Transcription failed. Please try again.",
      );
    } finally {
      setStatus("idle");
    }
  }

  async function handleStart() {
    setErrorMessage("");

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErrorMessage("Voice input isn't supported in this browser. Try typing instead.");
      return;
    }

    let stream: MediaStream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMessage(
        "Microphone access was blocked. Allow microphone access, or type your idea instead.",
      );
      return;
    }

    const mimeType = pickSupportedMimeType();
    // Cap the encoding bitrate so even the full 90-second recording stays a
    // few hundred KB — comfortably under the upload size the server will
    // accept, without needing the user to think about file size at all.
    const recorderOptions: MediaRecorderOptions = { audioBitsPerSecond: 32000 };
    if (mimeType) {
      recorderOptions.mimeType = mimeType;
    }
    const recorder = new MediaRecorder(stream, recorderOptions);

    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorderRef.current = recorder;
    streamRef.current = stream;
    recorder.start();

    setStatus("recording");
    setElapsedSeconds(0);

    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((current) => {
        const next = current + 1;

        if (next >= MAX_RECORDING_SECONDS) {
          void finishAndTranscribe();
        }

        return next;
      });
    }, 1000);
  }

  function handleClick() {
    if (disabled) {
      return;
    }

    if (status === "idle") {
      void handleStart();
    } else if (status === "recording") {
      void finishAndTranscribe();
    }
  }

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timeLabel = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="voice-recorder">
      <button
        type="button"
        className={
          status === "recording" ? "voice-recorder-button is-recording" : "voice-recorder-button"
        }
        onClick={handleClick}
        disabled={disabled || status === "transcribing"}
      >
        {status === "idle" ? "🎤 Record your idea" : null}
        {status === "recording" ? `⏹ Stop recording (${timeLabel})` : null}
        {status === "transcribing" ? "Transcribing..." : null}
      </button>
      {errorMessage ? <p className="voice-recorder-error">{errorMessage}</p> : null}
    </div>
  );
}
