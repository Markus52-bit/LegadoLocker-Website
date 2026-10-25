# Legado Locker

Streetwear storefront with an animated locker entrance and a password-protected catalog admin. Built with native HTML, CSS, JavaScript, Node 24, and SQLite; no third-party runtime packages or build step.

## Local development

```sh
npm run dev
```

Node **24 or newer** is required (`.node-version` pins major 24). The server defaults to port 3000; override `PORT` if needed. `npm test` runs catalog, bag, HTTP, authentication, publication, upload, validation, rate limiting, and database persistence checks.

The first server start creates `data/legado.sqlite` and `data/uploads/`, seeds Fallen Angel once, and preserves later edits. Override `DATA_DIR` to store both on a persistent disk. Data, uploads, and credentials are ignored by Git. Source deployment never resets an existing catalog.

## Set the owner password

From an interactive server terminal:

```sh
npm run admin:password
```

Enter a strong password of at least 12 characters at the hidden prompts. This saves a salted scrypt hash, never plaintext, and signs out existing sessions. Use the same command to reset or rotate the password. Do not put passwords in commands, Git, or chat.

For hosting services without an interactive terminal, securely set **ADMIN_PASSWORD** in the hosting service's environment settings before first startup. The server uses it only when the database does not already have an owner password. It does not reset an existing password on redeployment. This must be a real server-side environment value, not a proxy placeholder. No password is supplied by default: administration stays locked until one is configured. Use the host terminal password command for subsequent changes.

## Manage pieces and collections

Open **`/admin` on the running Node site**, then sign in with the owner password.

1. Select **Collections** and add a name and description. Leave **Published** unchecked for a draft, or check it to show the collection.
2. Select **Pieces**. Enter a name, collection, category, color, sizes/fits, optional price and currency, and description. Upload a PNG, JPEG, or WebP up to 5 MB.
3. Save as a draft, or check **Published** and save. A piece appears only when both the piece and its collection are published. Refresh the storefront to load updates.
4. Select an existing item to edit or delete it. A collection cannot be deleted while pieces belong to it; move/delete those pieces first. Prefer unpublishing to permanently deleting.

The storefront reads `/api/catalog` and supports collection and category filters, custom size choices, product descriptions, pricing, and photos. The owner login uses expiring HttpOnly, SameSite sessions with throttled sign-in attempts. Production cookies require HTTPS. This is one shared owner account; separate staff accounts and permissions are not implemented.

Uploads are retained even after replacing a photo or deleting a piece, to avoid destroying images still in use. Monitor disk usage. To back up, stop the service and copy the entire `DATA_DIR`, including the SQLite files and `uploads/`; restore them together before restarting. Do not commit these backups to Git.

## Deploy the backend

**GitHub Pages cannot run this backend.** It continues to serve the original static catalog. Database/admin changes do not update a GitHub Pages deployment. Host the entire Node site, then point the custom domain at that hosting service to use live catalog updates. There is no cross-origin API or token embedded in the storefront.

A single Node 24 instance with a persistent disk is required. `render.yaml` is an optional Render deployment template; its Starter service and disk are paid resources and are not created by committing the file.

For Render:

1. Create a Blueprint from this repository, or a Node web service running `npm start` with a persistent disk mounted at `/var/data`.
2. Securely set `ADMIN_PASSWORD` before first startup. Set `PUBLIC_ORIGIN` to the exact HTTPS origin of the service (for example, `https://your-service.onrender.com`), without a trailing slash. Set `NODE_ENV=production` and `DATA_DIR=/var/data` if configuring manually.
3. Verify `/api/health` responds with `{"status":"ok"}`, `/admin` accepts your owner password, and a published test piece appears in the storefront after refresh. Restart the service and verify the piece and photo remain.
4. Add `legadolocker.com` to the host's custom domains and follow its DNS instructions. Once HTTPS is active, change `PUBLIC_ORIGIN` to `https://legadolocker.com`, restart, and sign in again at that domain. Remove conflicting GitHub Pages DNS settings as instructed by the new host. Keep existing DNS records until the new host provides the exact replacement.

`PUBLIC_ORIGIN` is required for production admin writes. It protects browser origin checks; an incorrect origin prevents sign-in/saving. Use the service's HTTPS URL before the custom domain is connected. Deploy a single instance against one disk; do not horizontally scale this SQLite setup. Hosting, DNS, and HTTPS must be configured in your account; nothing here has provisioned or billed a service.

A `Dockerfile` is also included for other hosts. Mount persistent storage at `/app/data`, supply the same secure configuration, and terminate HTTPS at your hosting proxy. Never use an ephemeral disk for production catalog data.

## Storefront and GitHub Pages compatibility

Root `index.html` loads assets from `public/` for the existing GitHub Pages site; the Node server serves `public/` directly. Keep both HTML entry points synchronized after markup edits. `CNAME` retains the existing custom-domain declaration.

The centered locker opens on desktop mouse hover or the SHOP button; touch users use SHOP. Keyboard activation and reduced-motion preferences are supported. Direct section links bypass the entrance. Without JavaScript, the storefront shell is visible, but product rendering and the cart require JavaScript.

Original clothing uploads were visible in chat but unavailable as workspace files. The four seed images have explicit placeholders until you upload photos in admin, or supply `public/assets/tee-black.webp`, `tee-white.webp`, `cap-black.webp`, and `cap-white.webp`. The logo was recovered from repository history. Oswald font licensing is included in `public/assets/Oswald-LICENSE.txt`.

## Customer accounts

Customers use `/account` to create an account, verify their email, sign in, recover a forgotten password, change email preferences, and see orders recorded against their verified email address. Passwords are salted and hashed with scrypt. Customer sessions cannot access owner APIs. Verification links expire after 24 hours; password-reset links expire after one hour and can be used once. Resetting a password revokes customer sessions.

Marketing consent is optional and unchecked by default. Verification does not override the selected consent. Unsubscribe links remain valid across campaigns, and opting out is checked again before each email is submitted. Customers can opt back in from their signed-in account. Registration and recovery require configured email delivery; they stay unavailable without it. Existing catalog administration continues to work.

## Connect email with Resend

Create a Resend account and verify your sending domain using **the exact DNS records Resend supplies**. Add its records in Wix without replacing your Render website records or nameservers. Create an API key allowed to send email. In **Render → Environment**, securely add:

| Variable | Value to supply |
| --- | --- |
| `RESEND_API_KEY` | Your Resend API key; server-side secret |
| `EMAIL_FROM` | A verified sender, such as `Legado Locker <hello@legadolocker.com>` after verifying that domain |
| `SHOP_POSTAL_ADDRESS` | Your actual business mailing address, included in marketing emails |
| `PUBLIC_ORIGIN` | Your exact HTTPS site origin, currently `https://legadolocker.com`, no trailing slash |

Save and redeploy. Never send API keys or passwords in chat or commit them. These are raw server environment values in Render, not cloud proxy placeholders. Verify registration and recovery with your own email first. No production email was sent during development; automated tests use an injected fake mail provider.

In **Admin → Email campaigns**, draft a subject and plain-text message and optionally select a discount. Saving a draft sends nothing. The explicit send action confirms the audience and submits small batches until finished or a provider error requires retry. The audience is snapshotted when sending begins; only verified subscribers who opted in are eligible. Campaign content is fixed once sending begins. Send a separate campaign for later subscribers.

Counts distinguish pending, provider-accepted, skipped, retry, and unknown outcomes. **Accepted means the provider accepted the email, not that it reached an inbox.** Delivery, bounce, open, and click analytics are not implemented; use Resend for delivery diagnostics. There is no marketing tracking pixel. Every campaign includes an unsubscribe link, one-click unsubscribe headers, and the configured mailing address. Account and order-status emails are transactional and separate from marketing consent.

Recipient progress survives restarts. Ambiguous requests retry with stable idempotency keys for up to 23 hours. Older ambiguous requests are marked unknown and will not automatically resend; check the provider before deciding whether to draft another campaign. Resume interrupted campaigns from the admin; no background queue runs after the admin request completes. Confirmed opt-outs are skipped even if a campaign was already started.

## Orders and discounts

**Admin → Customers** shows registration, verification, email consent, and related order history. **Admin → Discounts** creates percentage codes with optional expiration dates and an enable/disable control. Codes apply to product subtotal, before shipping and tax, in Stripe checkout and manual order entry.

**Admin → Orders** records manual sales and tracks Stripe checkout orders. It shows the customer, immutable item/size/price snapshots, currency, subtotal, discount, shipping, tax, total, refunds, payment status, fulfillment status, shipping address, carrier, tracking number/link, external references, internal notes, and a timestamped order timeline. Search by order/customer/email and filter by fulfillment status. Payment summaries are grouped by currency and exclude unpaid orders.

Manual entry is for sales taken elsewhere: it records an unpaid order and does not charge a card, reserve stock, or automatically send email. Mark actual external payments/refunds with their reference after handling the transaction elsewhere. Manual financial statuses are bookkeeping, not processor verification. Customers see matching orders after signing in with the same verified email, but do not see internal notes or payment references. The explicit **Email status update** action sends saved fulfillment/tracking details to that order's customer.

Stripe financial fields update from signed events or **Sync payment**; admins cannot manually mark Stripe payments/refunds as confirmed. Refund actual Stripe payments in Stripe, then sync or wait for the webhook. Fulfillment, returns, carrier details, and tracking links are managed by the owner. A tracking link does not connect live carrier events or buy a shipping label.

## Connect Stripe checkout

Create a Stripe account. Start with its test/sandbox credentials. In **Render → Environment**, add:

| Variable | Value to supply |
| --- | --- |
| `STRIPE_SECRET_KEY` | Your server-side Stripe secret key, initially test mode |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the webhook endpoint below, from the same Stripe mode/account |
| `SHIPPING_COUNTRIES` | Comma-separated ISO country codes you actually ship to, such as `US,CA` |
| `SHIPPING_AMOUNT_MINOR` | Your flat shipping charge in the catalog currency's minor units; explicitly set `0` for free shipping |
| `STRIPE_AUTOMATIC_TAX` | Explicitly choose `true` after configuring Stripe Tax, or `false` if tax is handled as appropriate for your business |

In Stripe's webhook/event destination settings, add **`https://legadolocker.com/api/stripe/webhook`**. Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`
- `payment_intent.payment_failed`
- `charge.refunded`

Copy that endpoint's signing secret securely into Render and redeploy. API requests pin Stripe version `2024-06-20`; webhook handling supports both `shipping_details` and newer `collected_information.shipping_details` payload shapes. No API credentials or card fields are exposed in browser code.

Checkout enables only after all payment, shipping, tax-choice, and origin settings exist. A verified customer signs in, chooses priced/published pieces and sizes, optionally enters a discount, and goes to Stripe's hosted card checkout. All prices and discounts are recalculated server-side; browser-supplied totals are ignored. All pieces in one bag must use the same currency. The single shipping setting is interpreted in that currency. Product and shipping prices are exclusive of tax; configure your Stripe Tax registrations/default product classification if enabling automatic tax. A successful browser redirect alone never marks an order paid. Only a verified Stripe event or server-to-server synchronization does so. Event IDs are stored to prevent duplicate processing; out-of-order refund totals are retained.

Test a full sandbox purchase, webhook delivery, order history, shipping details, discount, and refund before replacing test credentials with live credentials and creating the corresponding live-mode webhook destination. Development tests mock Stripe requests and sign local fixture events; no live charge or external webhook delivery has been verified here.

## Current limits

There is one owner login, not separate staff roles. No stock levels/reservations, live carrier integration, purchased shipping labels, scheduled campaigns, delivery/open analytics, or accounting integration are implemented. Stripe handles card collection; the application never stores card details. Flat shipping and optional Stripe Tax cover checkout totals; more complex shipping rules require further work. Customer data, campaign queues, and orders live in the existing SQLite database, so retain the persistent disk and include it in backups. New tables are added without deleting catalog data. No email/payment credentials are supplied automatically by this repository.

Use the existing isolated checkout; do not create a Git worktree unless requested. Restart the server in new cloud tasks; running processes are not retained by snapshots.
