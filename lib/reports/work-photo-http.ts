import { NextResponse } from "next/server";
import { isActor, requireDeptActor } from "@/lib/auth/dept";
import { deptError } from "@/lib/auth/dept-http";
import { validateImage } from "@/lib/ai/image-validation";
import { uploadWorkPhoto } from "@/lib/services/dept";

export const runtime = "nodejs";

function num(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asBlob(v: FormDataEntryValue | null): Blob | null {
  if (v instanceof Blob) return v;
  return null;
}

export async function handleWorkPhotoPost(
  req: Request,
  id: string,
  kind: "BEFORE" | "AFTER",
) {
  const actor = await requireDeptActor();
  if (!isActor(actor)) return actor;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = asBlob(form.get("image"));
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "image_required" }, { status: 400 });
  }

  const lng = num(form.get("lng"));
  const lat = num(form.get("lat"));
  if (lng === null || lat === null) {
    return NextResponse.json({ error: "invalid_location" }, { status: 400 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateImage(bytes, file.type || "image/jpeg", "work.jpg");
    if (!validation.valid) {
      return NextResponse.json(
        { error: "invalid_image", reason: validation.error },
        { status: 400 },
      );
    }
    return NextResponse.json(
      await uploadWorkPhoto(actor, id, kind, {
        bytes,
        contentType: validation.detectedMime ?? file.type ?? "image/jpeg",
        lng,
        lat,
        accuracy: num(form.get("accuracy")),
        capturedAt: num(form.get("capturedAt")) ?? Date.now(),
      }),
    );
  } catch (e) {
    return deptError(e);
  }
}
