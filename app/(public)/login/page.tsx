import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="gov-container" style={{ padding: "20px" }}>Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
