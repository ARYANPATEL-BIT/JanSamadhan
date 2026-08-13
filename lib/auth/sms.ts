/**
 * SMS seam. Sprint 1 ships ConsoleSmsSender (logs the OTP to the server
 * console — zero budget, works offline). Swapping in a real provider (Twilio,
 * MessageBird, MSG91, Bhashini) is a new class behind this interface plus a
 * SMS_PROVIDER env value; no changes to the OTP flow.
 */
export interface SmsSender {
  send(phone: string, code: string): Promise<void>;
}

class ConsoleSmsSender implements SmsSender {
  async send(phone: string, code: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`\n  📲 [mock SMS → ${phone}] Your civic OTP is: ${code}\n`);
  }
}

export function getSmsSender(): SmsSender {
  const provider = process.env.SMS_PROVIDER ?? "console";
  switch (provider) {
    // case "twilio": return new TwilioSmsSender(...);  // sprint: production
    case "console":
    default:
      return new ConsoleSmsSender();
  }
}
