import { NextResponse } from "next/server";

export function deptError(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : "failed";
  if (message === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (message === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (message.startsWith("proof_gate:")) {
    return NextResponse.json({ error: "proof_gate", reason: message.slice(11) }, { status: 400 });
  }
  if (message.startsWith("illegal_transition")) {
    return NextResponse.json({ error: "illegal_transition" }, { status: 409 });
  }
  if (message === "need_before_photo") {
    return NextResponse.json(
      { error: "need_before_photo", reason: "Capture a before photo first" },
      { status: 400 },
    );
  }
  return NextResponse.json({ error: message }, { status: 400 });
}
