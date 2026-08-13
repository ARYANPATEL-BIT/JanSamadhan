"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const LANGS = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "bn", label: "বাংলা" },
  { code: "mr", label: "मराठी" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
];

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [lang, setLang] = useState("en");
  const [busy, setBusy] = useState(false);

  async function requestCode() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setStep("code");
      if (data.devCode) {
        toast.success(`Dev OTP: ${data.devCode}`, { duration: 10000 });
        setCode(data.devCode);
      } else {
        toast.success("OTP sent");
      }
    } catch (e) {
      toast.error(`Could not send OTP (${(e as Error).message})`);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      toast.success("Logged in");
      router.refresh();
      router.push("/report/new");
    } catch (e) {
      toast.error(`Verification failed (${(e as Error).message})`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <Card>
        <CardHeader>
          <CardTitle>{step === "phone" ? "Log in" : "Enter OTP"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "phone" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  inputMode="numeric"
                  placeholder="10-digit mobile"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <div className="flex flex-wrap gap-2">
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setLang(l.code)}
                      className={`rounded-full border px-3 py-1 text-sm ${
                        lang === l.code
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                className="w-full"
                onClick={requestCode}
                disabled={busy || phone.replace(/\D/g, "").length < 10}
              >
                {busy ? "Sending…" : "Send OTP"}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">6-digit code sent to {phone}</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="______"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  In dev the code is logged to the server console and shown above.
                </p>
              </div>
              <Button className="w-full" onClick={verify} disabled={busy || code.length !== 6}>
                {busy ? "Verifying…" : "Verify & continue"}
              </Button>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground hover:underline"
                onClick={() => setStep("phone")}
              >
                ← Change number
              </button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
