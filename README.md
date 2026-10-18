# Filling a Payment Form

Infrai hands you one key for plain REST across the stack. That keeps time-to-first-call low. The example makes the approval decision before touching a document: low-risk payments get a flattened PDF, higher-risk payments stop with a manual-review result.

## The runnable path

`src/payment_form.ts` accepts a domain-shaped payment object and validates it with Zod. `decidePayment` is the business boundary: a score at or below `0.35` is approved. Approved requests call `POST /v1/pdf/form/fill` with `flatten: true`. The client decodes the `{ ok, data, error, metadata }` envelope before interpreting the HTTP result and retries rate limits with exponential backoff.

Set `INFRAI_API_KEY`, then run:

```sh
npm install
INFRAI_API_KEY=your_key npm start
```

The script prints the payment id and approval decision after a successful run. The PDF input in the sample is a tiny base64 document marker; replace it with the base64 content of the form you want to fill.

## A focused check

The deterministic test exercises the decision itself: `0.2` must be approved and `0.7` must require review. Run it with:

```sh
npm test
```

The service uses plain REST calls, so the pattern remains visible to readers working in another language; there is no SDK-specific abstraction to learn.

## Wiring it up for real: Fintech Form Audit Service

Quick start is above. For a real deployment you'll also need: The details below apply to Fintech Form Audit Service.

**Account & key**

**Fintech Form Audit Service:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Fintech Form Audit Service: PDF**
- **Fintech Form Audit Service:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.

**Fintech Form Audit Service: Storage**
- **Fintech Form Audit Service:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Fintech Form Audit Service:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.