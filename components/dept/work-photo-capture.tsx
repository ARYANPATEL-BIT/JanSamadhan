"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0,
    });
  });
}

export function WorkPhotoCapture({
  reportId,
  kind,
  pinLng,
  pinLat,
}: {
  reportId: string;
  kind: "BEFORE" | "AFTER";
  pinLng: number;
  pinLat: number;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      }).catch(() =>
        navigator.mediaDevices.getUserMedia({ video: true, audio: false }),
      );
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setError("Camera unavailable. Use “Upload photo” instead.");
    }
  }, []);

  useEffect(() => {
    void startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  async function resolveCoords(): Promise<{ lng: number; lat: number; accuracy: string }> {
    try {
      const pos = await getPosition();
      return {
        lng: pos.coords.longitude,
        lat: pos.coords.latitude,
        accuracy: String(pos.coords.accuracy ?? ""),
      };
    } catch {
      toast.message("GPS unavailable — using the report pin for this photo.");
      return { lng: pinLng, lat: pinLat, accuracy: "50" };
    }
  }

  async function upload(blob: Blob) {
    setBusy(true);
    try {
      const pos = await resolveCoords();
      const form = new FormData();
      form.set("image", blob, "work.jpg");
      form.set("lng", String(pos.lng));
      form.set("lat", String(pos.lat));
      form.set("accuracy", pos.accuracy);
      form.set("capturedAt", String(Date.now()));
      const path = kind === "BEFORE" ? "before" : "after";
      const res = await fetch(`/api/v1/dept/reports/${reportId}/${path}`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const text = await res.text();
      let data: { ok?: boolean; error?: string; reason?: string } = {};
      try {
        data = text ? (JSON.parse(text) as typeof data) : {};
      } catch {
        throw new Error(text.slice(0, 160) || `HTTP ${res.status}`);
      }
      if (!res.ok) {
        throw new Error(data.reason ?? data.error ?? `HTTP ${res.status}`);
      }
      toast.success(`${kind === "BEFORE" ? "Before" : "After"} photo saved`);
      stopCamera();
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function shutter() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) {
      fileRef.current?.click();
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) void upload(blob);
        else toast.error("Could not capture frame.");
      },
      "image/jpeg",
      0.9,
    );
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void upload(file);
  }

  return (
    <div className="gov-card" style={{ marginTop: "16px" }}>
      <div className="gov-card__header">
        Capture {kind === "BEFORE" ? "before-work" : "after-work"} photo
      </div>
      <div className="gov-card__body">
        <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "8px" }}>
          Camera or file upload. GPS is preferred; if it is blocked we use the complaint pin.
        </p>
        {error ? (
          <div className="gov-notice gov-notice--info" style={{ marginBottom: "8px" }}>{error}</div>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{ width: "100%", maxHeight: "320px", background: "#111", objectFit: "cover" }}
          />
        )}
        <canvas ref={canvasRef} hidden />
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
        <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="gov-btn gov-btn--primary"
            onClick={shutter}
            disabled={busy}
          >
            {busy ? "Uploading…" : `Take ${kind} photo`}
          </button>
          <button
            type="button"
            className="gov-btn gov-btn--secondary"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            Upload photo
          </button>
        </div>
      </div>
    </div>
  );
}
