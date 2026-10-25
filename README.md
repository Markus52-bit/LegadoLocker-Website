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

## Remaining commerce work

This backend manages the catalog. It does **not** process payments, place orders, manage stock, calculate tax/shipping, or handle customer accounts. Cart selections remain local to each browser. Checkout stays disabled. Configure and implement those before accepting purchases; adding a price does not enable payment processing.

Use the existing isolated checkout; do not create a Git worktree unless requested. Restart the server in new cloud tasks; running processes are not retained by snapshots.
