"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_META } from "@/lib/categories";

type Category = keyof typeof CATEGORY_META;

interface DraftResponse {
  ticket: string;
  verdict: {
    combined: string;
    captureTrust: number;
    nsfw: boolean;
    candidates: unknown[];
  };
  suggestion: {
    category: Category;
    confidence: number;
    ward: { wardNo: number; municipalityName: string } | null;
    hasDepartment: boolean;
    imageUrl: string;
  };
}

type Phase = "capture" | "analyzing" | "draft" | "submitting";

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

export function CaptureFlow({ categories }: { categories: readonly string[] }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>("capture");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [chosenCategory, setChosenCategory] = useState<Category>("pothole");
  const [description, setDescription] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraError(
        "Camera unavailable or permission denied. You can upload from your gallery instead.",
      );
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  /** Convert a blob + capture facts into a draft via the pipeline. */
  async function submitDraft(blob: Blob, capturePath: "IN_APP" | "GALLERY") {
    setPhase("analyzing");
    try {
      // Bind device geolocation + client timestamp at the moment of capture.
      const pos = await getPosition().catch(() => {
        throw new Error("Location permission is required to file a report.");
      });
      const capturedAt = Date.now();

      const form = new FormData();
      form.set("image", blob, "capture.jpg");
      form.set("lng", String(pos.coords.longitude));
      form.set("lat", String(pos.coords.latitude));
      form.set("accuracy", String(pos.coords.accuracy ?? ""));
      form.set("capturedAt", String(capturedAt));
      form.set("capturePath", capturePath);

      const res = await fetch("/api/v1/reports/draft", { method: "POST", body: form });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await res.json()) as DraftResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "draft_failed");

      stopCamera();
      setDraft(data);
      setChosenCategory(data.suggestion.category);
      setPreviewUrl(data.suggestion.imageUrl);
      setPhase("draft");
    } catch (e) {
      toast.error((e as Error).message);
      setPhase("capture");
    }
  }

  function shutter() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) {
      toast.error("Camera not ready yet.");
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) submitDraft(blob, "IN_APP");
      },
      "image/jpeg",
      0.9,
    );
  }

  function onGalleryPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) submitDraft(file, "GALLERY");
  }

  async function submitReport() {
    if (!draft) return;
    setPhase("submitting");
    try {
      const res = await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket: draft.ticket,
          category: chosenCategory,
          description: description || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "submit_failed");
      toast.success("Report submitted");
      router.push(`/report/${data.id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setPhase("draft");
    }
  }

  // ---- Draft screen -------------------------------------------------------
  if (phase === "draft" || phase === "submitting") {
    const s = draft!.suggestion;
    const trust = draft!.verdict.captureTrust;
    return (
      <div className="space-y-4">
        {previewUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={previewUrl}
            alt="captured issue"
            className="w-full rounded-lg border object-cover"
          />
        )}

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <div className="mb-2 text-sm text-muted-foreground">
                Looks like{" "}
                <span className="font-medium text-foreground">
                  {CATEGORY_META[s.category].label}
                </span>
                {s.ward
                  ? ` → Ward ${s.ward.wardNo}, ${s.ward.municipalityName}`
                  : " → outside seeded wards (no auto-routing)"}
                . Not right? Pick below.
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChosenCategory(c as Category)}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      chosenCategory === c
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    {CATEGORY_META[c as Category].emoji} {CATEGORY_META[c as Category].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant={trust >= 0.75 ? "secondary" : "destructive"}>
                capture trust {(trust * 100).toFixed(0)}%
              </Badge>
              {draft!.verdict.combined === "MANUAL_REVIEW" && (
                <Badge variant="outline">routed to manual review</Badge>
              )}
              {draft!.verdict.combined === "CLEAN_HIGH_TRUST" && (
                <Badge variant="outline">clean · auto-routed</Badge>
              )}
            </div>

            <div>
              <Textarea
                placeholder="Optional: add a short description (max 200 chars)"
                maxLength={200}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={submitReport}
                disabled={phase === "submitting"}
              >
                {phase === "submitting" ? "Submitting…" : "Submit report"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDraft(null);
                  setPhase("capture");
                  startCamera();
                }}
                disabled={phase === "submitting"}
              >
                Retake
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Capture screen -----------------------------------------------------
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-lg border bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="aspect-[3/4] w-full object-cover"
        />
        {phase === "analyzing" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white">
            Analyzing photo… (spam &amp; duplicate checks)
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {cameraError && (
        <p className="text-sm text-destructive">{cameraError}</p>
      )}

      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={shutter}
          disabled={phase === "analyzing" || !!cameraError}
        >
          {phase === "analyzing" ? "Analyzing…" : "📸 Capture"}
        </Button>
        <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm hover:bg-muted">
          Gallery
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onGalleryPick}
            disabled={phase === "analyzing"}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        In-app camera is the primary path. Gallery uploads are accepted but
        flagged lower-trust and always manually reviewed.
      </p>
    </div>
  );
}
