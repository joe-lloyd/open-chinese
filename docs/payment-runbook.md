# Stripe launch and recovery runbook

This runbook covers the Stripe adapter only. Keep test and live products, Prices,
API keys, webhook endpoints, and Customer Portal configuration separate.

## Required configuration

All secrets are server-side Netlify environment variables. Never use a `VITE_`
prefix for a secret.

| Setting | Purpose |
|---|---|
| `VITE_PAYMENTS_ENABLED` | Shared rollout/rollback flag; exactly `true` enables checkout UI and server checkout/portal |
| `PAYMENT_PROVIDER=stripe` | Selects the registered launch adapter |
| `PUBLIC_SITE_URL` | Canonical HTTPS origin, without `/app` |
| `FIREBASE_SERVICE_ACCOUNT` | Dedicated least-privilege Firebase Admin credential |
| `STRIPE_SECRET_KEY` | Matching test or live secret key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for this exact endpoint and mode |
| `STRIPE_PRICE_PRO_YEARLY` | Price id for the currently offered SKU |

Hidden pack Price ids are not required. If a pack is added to the purchasable
catalogue, configure its Price id in the same deploy.

The app build additionally needs the public client variables — the six
`VITE_FIREBASE_*` values and `VITE_ALLOWED_EMAIL` — in the Netlify build
environment (see `DEPLOY.md` and `apps/app/.env.example`). Without them a fresh
site produces a broken app build long before payments enter the picture.

Run `pnpm check:payments-config` in an environment with the intended variables.
It performs no network call and prints setting names, never values. A non-ready
configuration exits non-zero.

## Stripe test setup

1. In Stripe test mode, create the Pro product and yearly recurring EUR Price.
2. In Payment methods, enable the methods the business accepts. Checkout will
   show only methods eligible for the customer and session; do not hard-code or
   promise a particular local method.
3. Configure Customer Portal to allow subscription cancellation and payment
   method changes. Set the business identity and support contact.
4. Add `https://<origin>/.netlify/functions/webhook` and subscribe to:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, and `customer.subscription.deleted`.
5. Set test variables, keep `VITE_PAYMENTS_ENABLED=false`, deploy, and run the
   configuration check in the deploy environment.
6. For local delivery, run Netlify dev and:
   `stripe listen --forward-to localhost:8888/.netlify/functions/webhook`.
   Use the signing secret printed by that listener only for local testing.

## Lifecycle smoke test

Use a test user with free entitlements.

1. Enable payments and deploy. Confirm pricing renders and a known SKU redirects
   to `checkout.stripe.com`; cancel returns to `/app/pricing`.
2. Complete Checkout with a Stripe test payment. Confirm return to
   `/app/billing/return`, then confirm the Firestore entitlement becomes Pro.
3. Confirm the stored billing customer belongs to that Firebase uid. Open
   Customer Portal and verify its return URL is `/app/pricing`.
4. Cancel at period end and then use a test clock or controlled test event to
   verify updated/deleted events produce the expected entitlement state.
5. Redeliver one successful event from Stripe. It must return 2xx without
   duplicating a pack or changing the result.
6. Send an older subscription event after a newer event and confirm logs report
   it as out of order without resurrecting access.
7. For any newly offered one-time pack, purchase it twice in test mode and
   confirm its grant remains additive and deduplicated.

## Monitoring

- Alert on checkout/portal 5xx rate, webhook 4xx/5xx deliveries, Stripe endpoint
  disablement, and entitlement-write failures.
- Review Stripe's webhook delivery dashboard after each deploy.
- Public responses contain stable error codes only. Correlate them with
  sanitized function logs; never log request authorization headers, raw webhook
  payloads, secret values, or Firebase credentials.
- Reconcile successful Stripe payments against current entitlements regularly,
  and immediately before/after key rotation.

## Incidents and rollback

To stop new sales, set `VITE_PAYMENTS_ENABLED=false` and redeploy. This hides
purchase prompts and causes direct checkout/portal requests to return 503.
Webhook processing deliberately remains active so existing subscription
cancellations and renewals are not lost. Existing entitlements and user data are
not deleted.

If a paid user missed access:

1. Confirm the payment in Stripe and record its event/customer/subscription ids.
2. Fix the configuration or Firestore incident.
3. Redeliver the signed event from Stripe's webhook dashboard.
4. If redelivery cannot recover the user promptly, use the existing entitlement
   CLI for a time-bounded/manual grant, record who approved it, and reconcile it
   after webhook recovery. Never edit a browser-writable document.

For a signing-secret compromise, disable checkout, roll the webhook secret in
Stripe, update Netlify atomically, deploy, send a test event, then re-enable.
For an API-key compromise, roll the restricted/live key, update Netlify, verify
configuration, run checkout and portal smoke tests, then revoke the old key.

## Going live

1. Verify the published Firestore rules in the Firebase console match the
   repo's `firestore.rules` — the console must show `allow write: if false`
   under `entitlements` (DEPLOY.md step 0). Rules are deployed by hand, so do
   not enable payments against stale, more permissive rules.
2. Complete Stripe business activation and banking details.
3. Create live products/Prices; never reuse test ids.
4. Create the live webhook endpoint and copy its own live signing secret.
5. Configure live payment methods and Customer Portal.
6. Confirm VAT/OSS registration, tax collection, invoice/refund process, privacy
   disclosures, and support ownership with the business's accountant.
7. Deploy live settings with payments disabled, run the config and bundle checks,
   then enable and complete a low-value real purchase/refund smoke test.
