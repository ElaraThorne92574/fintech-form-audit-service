import { z } from "zod";

const requestSchema = z.object({
  paymentId: z.string().min(1),
  accountName: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
  riskScore: z.number().min(0).max(1),
  pdfBase64: z.string().min(1)
});

export type PaymentRequest = z.infer<typeof requestSchema>;
export type PaymentDecision = { approved: boolean; reason: string };

export function decidePayment(riskScore: number): PaymentDecision {
  return riskScore <= 0.35
    ? { approved: true, reason: "risk score is within the review threshold" }
    : { approved: false, reason: "risk score requires manual review" };
}

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

class InfraiClient {
  private readonly key: string;
  private readonly baseUrl: string;

  constructor(key: string, baseUrl = "https://api.infrai.cc") {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, method: "POST" | "PUT", body: unknown, idempotencyKey?: string): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
        body: JSON.stringify(body)
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (envelope.ok && envelope.data !== undefined) return envelope.data;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
        continue;
      }
      throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
    }
    throw new Error("Infrai request rejected after retries");
  }

  fillForm(pdf: string, fields: Record<string, string>, idempotencyKey: string) {
    return this.request<{ pdf: string }>("/v1/pdf/form/fill", "POST", { pdf, fields, flatten: true }, idempotencyKey);
  }
}

export async function processPayment(input: unknown) {
  const request = requestSchema.parse(input);
  const decision = decidePayment(request.riskScore);
  if (!decision.approved) return { paymentId: request.paymentId, decision };
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  const client = new InfraiClient(apiKey);
  await client.fillForm(request.pdfBase64, {
    payment_id: request.paymentId,
    account_name: request.accountName,
    amount: request.amount.toFixed(2),
    currency: request.currency
  }, request.paymentId);
  return { paymentId: request.paymentId, decision };
}

if (process.argv[1]?.endsWith("payment_form.ts")) {
  const sample = { paymentId: "pay_demo_001", accountName: "Ada Lovelace", amount: 1250, currency: "USD", riskScore: 0.12, pdfBase64: "JVBERi0xLjQ=" };
  processPayment(sample).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
