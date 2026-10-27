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
2. Select **Pieces**. Enter a name, collection, category, color, sizes/fits, optional price and currency, and description. Select multiple PNG, JPEG, or WebP photos, up to 5 MB each. You can add more photos in later batches; there is no fixed photo-count limit beyond available storage. The first photo is the cover. Use Make cover, earlier/later arrows, and Remove to arrange the gallery, then save the piece.
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

## Dynamic collection hero

The homepage hero features the first published collection in the saved collection order by default. Choosing a collection from the storefront dropdown or locker sticky notes updates the hero title, collection number, description preview, product colors/categories, image caption, announcement, and browser title. All collections returns to the first published collection. The hero's Shop the Collection button selects that featured collection and shows its products.

The hero uses the first available product cover photo in that collection, falling back through other product covers and finally to the brand logo. Product photo edits and cover ordering in the existing admin control this image; no additional upload setting is required. Full collection descriptions remain above the product grid, while the hero shows a preview up to 280 characters. With no published collections, the hero uses general Legado Locker branding and a coming-soon message. Publishing, editing, or reordering collections takes effect on the next storefront refresh.

## Collection sticky notes

Each published collection appears as a paper sticky note attached to the locker door, in the saved collection order. Selecting a note opens the door and takes the shopper to that collection's description and products. Draft collections stay hidden. Additional notes scroll within the door on desktop and mobile; there is no fixed collection-count cap.

Desktop hover has a short intent delay and pauses over the notes so shoppers can choose a collection. Hovering the bare door or selecting SHOP still opens all collections. Notes are keyboard accessible and honor reduced-motion preferences. Updates to collection names, publishing, and ordering appear on the next homepage load.

## Collection order

In **Admin → Collections**, use the up/down arrows next to each collection. Each move saves immediately, independently of the collection editor, so unsaved description/name edits are retained. Refresh the storefront to see the new order in the collection dropdown, description cards, and product grouping. Order within each collection's product group is preserved.

Draft collections can be arranged in advance but remain hidden from shoppers. New collections append to the end. Renaming, publishing, and restarting the service preserve the saved order. The order is stored in the existing SQLite settings without changing collection or product records. If another session has added/deleted a collection, reload the admin before moving items to avoid overwriting a stale list.

## Footer links

Open **Admin → Footer links** to add, edit, reorder, or remove links. Each link has a label, destination, section (Support, Contact, or Socials), and an optional new-tab setting. Use HTTPS addresses for social profiles, `mailto:` for contact email, `tel:` for phone links, or an existing internal `/path`. Links are grouped by section; their saved order determines the order within each section. Adding a link does not create a destination page.

Select **Save footer links**, then refresh the storefront. Changes persist in SQLite across deployments/restarts; no code edit or rebuild is required. Empty sections are hidden. Removing every link and saving removes the footer link groups while keeping the brand and copyright. Only the owner can change links; the public endpoint exposes only the saved link list.

## Product photo galleries

Product cards automatically cycle through their photos every five seconds. Each gallery has previous/next controls, a position counter, and a pause/play button. Automatic cycling pauses on mouse hover, keyboard focus, when offscreen, and when the browser tab is hidden. Reduced-motion preferences disable automatic cycling and transitions; manual navigation remains available. Customers can also use keyboard arrows or swipe horizontally on touch screens. Product details open a manual gallery so customers can examine each view while selecting a size.

There is no fixed photo-count cap. Each upload retains the 5 MB limit and is uploaded separately, so adding many photos does not create one oversized request. First/next images load as needed instead of fetching every full-resolution image at once. Storage is still bounded by the persistent disk on your hosting plan. Removing a photo from a piece removes its reference, not the file from disk, consistent with the existing upload-retention policy. Successful uploads are retained in the editor if a later upload/save fails, so retrying does not upload those photos again.

Existing products keep their original cover automatically. Catalog responses include an ordered `images` array and retain `image` as the first photo for compatibility. Existing multi-photo galleries survive edits from legacy clients that submit the unchanged cover. Catalog and order data are preserved; no database reset or manual migration is needed.

## Customer accounts

Customers use `/account` to create an account, verify their email, sign in, recover a forgotten password, change email preferences, and see orders recorded against their verified email address. Passwords are salted and hashed with scrypt. Customer sessions cannot access owner APIs. Verification links expire after 24 hours; password-reset links expire after one hour and can be used once. Resetting a password revokes customer sessions.

Marketing consent is optional and unchecked by default. Verification does not override the selected consent. Unsubscribe links remain valid across campaigns, and opting out is checked again before each email is submitted. Customers can opt back in from their signed-in account. Registration and recovery require configured email delivery; they stay unavailable without it. Existing catalog administration continues to work.

## Connect email with Resend

Create a Resend account and verify your sending domain using **the exact DNS records Resend supplies**. Add its records in Wix without replacing your Render website records or nameservers. Create an API key allowed to send email. In **Render → Environment**, securely add:

| Variable | Value to supply |
| --- | --- |
| `RESEND_API_KEY` | Your Resend API key; server-side secret |
| `EMAIL_FROM` | A verified sender, such as `Legado Locker <hello@legadolocker.com>` after verifying that domain |

| `PUBLIC_ORIGIN` | Your exact HTTPS site origin, currently `https://legadolocker.com`, no trailing slash |

Save and redeploy. Never send API keys or passwords in chat or commit them. These are raw server environment values in Render, not cloud proxy placeholders. Verify registration and recovery with your own email first. No production email was sent during development; automated tests use an injected fake mail provider.

In **Admin → Email campaigns**, draft a subject and plain-text message and optionally select a discount. Saving a draft sends nothing. The explicit send action confirms the audience and submits small batches until finished or a provider error requires retry. The audience is snapshotted when sending begins; only verified subscribers who opted in are eligible. Campaign content is fixed once sending begins. Send a separate campaign for later subscribers.

Counts distinguish pending, provider-accepted, skipped, retry, and unknown outcomes. **Accepted means the provider accepted the email, not that it reached an inbox.** Delivery, bounce, open, and click analytics are not implemented; use Resend for delivery diagnostics. There is no marketing tracking pixel. Every campaign includes an unsubscribe link, one-click unsubscribe headers, but no automatically appended mailing address. Include any legally required sender address in your campaign message. Account and order-status emails are transactional and separate from marketing consent.

Recipient progress survives restarts. Ambiguous requests retry with stable idempotency keys for up to 23 hours. Older ambiguous requests are marked unknown and will not automatically resend; check the provider before deciding whether to draft another campaign. Resume interrupted campaigns from the admin; no background queue runs after the admin request completes. Confirmed opt-outs are skipped even if a campaign was already started.

## Orders and discounts

**Admin → Customers** shows registration, verification, email consent, and related order history. **Admin → Discounts** creates percentage codes with optional expiration dates and an enable/disable control. Codes apply to product subtotal, before shipping and tax, in Stripe checkout and manual order entry.

**Admin → Orders** records manual sales and tracks Stripe checkout orders. It shows the customer, immutable item/size/price snapshots, currency, subtotal, discount, shipping, tax, total, refunds, payment status, fulfillment status, shipping address, carrier, tracking number/link, external references, internal notes, and a timestamped order timeline. Search by order/customer/email and filter by fulfillment status. Payment summaries are grouped by currency and exclude unpaid orders.

Manual entry is for sales taken elsewhere: it records an unpaid order and does not charge a card, reserve stock, or automatically send email. Mark actual external payments/refunds with their reference after handling the transaction elsewhere. Manual financial statuses are bookkeeping, not processor verification. Customers see matching orders after signing in with the same verified email, but do not see internal notes or payment references. The explicit **Email status update** action sends saved fulfillment/tracking details to that order's customer.

Stripe financial fields update from signed events or **Sync payment**; admins cannot manually mark Stripe payments/refunds as confirmed. Refund actual Stripe payments in Stripe, then sync or wait for the webhook. Fulfillment, returns, carrier details, and tracking links are managed by the owner. A tracking link does not connect live carrier events or buy a shipping label.

## Shopify website checkout (without POS)

A **Shopify store/account and a plan supporting online checkout are required**, even when only using Shopify for checkout. Your custom storefront remains on Render at `legadolocker.com`; this integration sends the bag to Shopify's hosted checkout through a cart permalink. No Shopify Storefront API or Admin API token is required for this handoff. It does not configure or use POS.

### Activate

1. Create the Shopify store. Keep its original `your-store.myshopify.com` address available. Do **not** move the existing `legadolocker.com` DNS records off Render. If configuring a branded Shopify domain later, use a separate appropriate subdomain and check redirects so the cart link does not loop back to the Render site.
2. Create matching products, colors, and size variants in Shopify. Make them available for the online sales channel used by your store. Configure payments, shipping profiles/rates, tax, checkout, store access/password settings, and customer notifications in Shopify. Live carrier-calculated shipping depends on your Shopify plan and carrier integrations; this site does not calculate Shippo/Pirate Ship rates.
3. In this site's **Admin → Pieces**, edit each item. Enter its **Shopify variant ID for each size** in the Shopify checkout links section. Use the numeric **variant** ID (not product ID), or `gid://shopify/ProductVariant/123456789`. A variant's Shopify admin detail URL contains its numeric ID. Save the piece. Blank sizes cannot check out. Keep your local display names, photos, and prices consistent with Shopify; this integration does not automatically synchronize the catalog.
4. In **Render → Environment**, set `CHECKOUT_PROVIDER=shopify` and `SHOPIFY_STORE_DOMAIN=your-store.myshopify.com` (bare hostname, no `https://` or trailing slash). Keep `PUBLIC_ORIGIN=https://legadolocker.com`. Save and redeploy.
5. The bag now offers **Checkout with Shopify**. Guest checkout is allowed without a website account or Resend configuration. Selected variants and quantities are validated against published local pieces and sent to Shopify. Final prices, stock, accepted discount codes, shipping, taxes, and payment methods are determined by Shopify. Website sign-in does not sign a customer into a Shopify customer account.

Discount codes included in campaigns or entered in the bag **must also exist in Shopify**. The local Discounts admin manages only local/manual/Stripe discounts and does not create Shopify promotions. Shopify can reject unavailable variants or quantities at checkout. Local prices are display information; no browser-supplied price is sent to Shopify. Review your Shopify catalog and checkout configuration before accepting sales. No Shopify store was provisioned, plan purchased, or real payment made during implementation.

If `CHECKOUT_PROVIDER` is omitted, the previous Stripe flow remains active. To return to it, set `CHECKOUT_PROVIDER=stripe` and retain its required settings. Historical Stripe orders and webhook processing remain available. Shopify checkout does not use your Stripe API keys or Stripe shipping settings; Shopify handles its own payment setup.

### Mirror Shopify orders into this admin

Order synchronization is optional for checkout, but required for Shopify orders to appear in the custom admin/customer history and for automatic local bag reconciliation after purchase:

1. In **Shopify → Settings → Notifications → Webhooks** (or the corresponding webhook configuration area), add JSON webhooks for **Order creation** and **Order update**. Both use `https://legadolocker.com/api/shopify/webhook`. Order payment/cancellation topics are also supported if configured.
2. Copy the webhook **signing secret** shown by Shopify into Render as `SHOPIFY_WEBHOOK_SECRET`, then redeploy. This is the webhook signing secret, not a Shopify API access token. Enter it securely in Render, not in chat or Git.
3. Received order payloads must come from the configured original `.myshopify.com` domain and pass the Shopify HMAC check. The dashboard mirrors Shopify totals, financial status, refunds included in order payloads, fulfillment and tracking data, and order history. Duplicate/stale payloads do not overwrite newer records. Unknown partial-refund amounts are marked pending and excluded from payment summaries rather than invented.
4. Shopify orders are read-only in this dashboard. Use **Manage order in Shopify** to capture/refund payments, fulfill, or update tracking. The site mirrors received order webhook snapshots; it does not independently poll carrier delivery events. Existing manual and Stripe orders continue to use their existing controls.

Matching verified website customers can see Shopify orders by email, but Shopify guests are not automatically signed up for local marketing or customer accounts. With signed order webhooks connected, a private checkout reference reconciles purchased quantities from the same browser tab's bag when the shopper returns. Without the webhook, the local bag is not automatically cleared; payment and order confirmation remain available in Shopify. A short webhook delay may require a refresh. External Shopify checkout/thank-you navigation is managed by Shopify; configure available store navigation/branding links there to point shoppers back to your custom site.

The integration was validated with local Shopify-shaped payloads and intercepted browser checkout navigation. No live Shopify account or order delivery has been verified in this cloud task; activation awaits the merchant's actual Shopify store and configuration.

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

There is one owner login, not separate staff roles. No stock levels/reservations, live carrier integration, purchased shipping labels, scheduled campaigns, delivery/open analytics, or accounting integration are implemented. The configured checkout provider handles card collection; the application never stores card details. Flat shipping and optional Stripe Tax cover checkout totals; more complex shipping rules require further work. Customer data, campaign queues, and orders live in the existing SQLite database, so retain the persistent disk and include it in backups. New tables are added without deleting catalog data. No email/payment credentials are supplied automatically by this repository.

Use the existing isolated checkout; do not create a Git worktree unless requested. Restart the server in new cloud tasks; running processes are not retained by snapshots.

### New and active customer audiences

Admin → Customers filters accounts into Pending verification, New (verified but not yet welcomed), and Active (a welcome campaign was accepted by the email provider). Existing verified accounts start as New until welcomed; Active does not measure visits or purchases. Admin → Email campaigns offers All subscribers, New accounts (welcome), and Active accounts. Only verified customers with marketing consent qualify. A New-account campaign marks recipients welcomed only after provider acceptance; failures stay New. Recipient snapshots and retry protections still apply. Welcome messages are manually drafted and sent, not automatically sent at registration. Provider acceptance does not guarantee delivery.

## Storefront popup ads

Open Admin → Marketing → Popup ads. Create a headline, message, optional discount code, and storefront button destination (for example `/#collection`). Preview opens the same accessible, dismissible popup used in the store. Save with Enabled checked to publish; uncheck and save to stop showing it on new visits, or delete it. Optional start/end dates use the administrator’s local time and are stored in UTC. Discount codes must already exist in the checkout provider.

Choose a delay of 0–120 seconds and once per browser session, once per UTC day, or every page visit. Browser storage remembers display, not customer identity; clearing storage or changing browsers resets this limit. Only the first enabled, in-schedule popup eligible for that browser appears per page visit. Popups wait until the locker has opened and other dialogs have closed, support Escape and a close button, and do not block shopping if the promotions service fails. Schedule changes apply on the next page load; existing open pages do not poll for edits. Saved promotions share the persistent catalog database.

### Email signup popups

Select **Email signup** in the popup editor to collect an email address with an unchecked, required marketing-consent checkbox. No password or purchase is required. Resend must be configured. The visitor receives a 24-hour confirmation link and presses **Subscribe to offers** to verify ownership and consent. No marketing messages are sent before confirmation. Preview does not submit or send email.

Email-only subscribers appear in Customers as Email subscriber and use the same New/Active audiences, welcome campaigns, and unsubscribe links. Existing accounts keep their passwords and preferences until the email confirmation is completed. Existing opted-in subscribers are not mailed another confirmation. Unsubscribing or opting out invalidates pending signup links; opting back in requires a fresh confirmation. Email signup does not create a usable account password. Subscribers who later want to sign in can use Forgot password to choose one; regular account registration does not overwrite their existing record. New and welcome campaigns remain manual.

Email signup popups keep their discount code out of both the popup and the public promotions API. The signup confirmation email includes the saved popup headline, description, discount code, and optional shop button destination, followed by the email-confirmation link and unsubscribe controls. This requested offer arrives immediately; future marketing campaigns still require confirmed consent. The server uses the live popup ID to retrieve the offer, ignores client-supplied message/code values, and rejects disabled or expired offers. Existing subscribers can request the offer too. Keep codes out of the headline and description if they should only appear in email; those fields remain public. Announcement popups continue to display their codes.
