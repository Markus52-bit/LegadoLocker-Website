# Legado Locker

A responsive Fallen Angel collection storefront, built with native HTML, CSS, JavaScript, and a dependency-free Node static server.

## Develop

Requires Node 22 or newer. From this directory:

```sh
npm run dev
```

The server uses port 3000 by default; override with `PORT`. Run `npm test` for catalog/cart and HTTP smoke tests. No install, external services, secrets, build, or database are needed.

## Launch checklist

This is a storefront prototype. Bag selections persist locally, but it does not accept payments or place orders. Prices, currency, inventory, shipping and returns, and a payment provider must be supplied and implemented before launch. Clothing sizes are provisional.

The logo was recovered from repository history and matches the logo shared in chat. Uploaded clothing mockups were visible in chat but were not available as workspace files. Product photography slots remain explicitly labeled. Add approved product images to `public/assets/tee-black.webp`, `tee-white.webp`, `cap-black.webp`, and `cap-white.webp` to replace them automatically. Do not substitute generated imagery for the actual products.

## Environment

Use the existing isolated checkout; no Git worktree is needed. Start `npm run dev` after a new task begins; live processes do not survive environment snapshots. Validate the homepage and logo with local HTTP requests. This server is for development; deploy `public/` to a static host for production after completing the launch checklist.

## GitHub Pages

Publish the `main` branch from `/ (root)`. Root `index.html` loads the storefront assets from `public/`; `CNAME` preserves legadolocker.com. After editing page markup, update both HTML entry points. The Node development server continues to serve `public/` directly.
