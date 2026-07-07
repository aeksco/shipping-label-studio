# Shipping Label Studio

A small web app for designing and exporting **4 × 6 in mailing labels** as print-ready PDFs.

Type in a return and recipient address, tune the typography, and the preview renders the *actual* exported PDF live (via [pdf.js](https://mozilla.github.io/pdf.js/)) — what you see is exactly what downloads.

## Features

- Return + recipient address fields, with a toggle to include/omit the return block
- **Swap** return and recipient in one click
- Recipient alignment (centered / left), adjustable font size and line height
- Live, pixel-accurate PDF preview — no browser PDF-viewer chrome
- One-click **Download 4 × 6 PDF** (landscape, 72 DPI)

## Getting started

**Prerequisites:** Node.js 20+ and [pnpm](https://pnpm.io/).

```bash
pnpm install      # install dependencies
pnpm dev          # start the dev server → http://localhost:3000
```

## Scripts

| Command      | What it does                          |
| ------------ | ------------------------------------- |
| `pnpm dev`   | Run the app locally with hot reload   |
| `pnpm build` | Create an optimized production build  |
| `pnpm start` | Serve the production build            |
| `pnpm lint`  | Run ESLint                            |

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router) + React 19
- [jsPDF](https://github.com/parallax/jsPDF) for PDF generation
- [pdf.js](https://mozilla.github.io/pdf.js/) for the live preview
- [Tailwind CSS](https://tailwindcss.com/) v4 and Instrument Sans / JetBrains Mono

## Notes for maintainers

- The pdf.js worker is served as a static asset from `public/pdf.worker.min.mjs`. If you upgrade `pdfjs-dist`, re-copy the matching worker so the API and worker versions stay in sync:

  ```bash
  cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
  ```

- `pdfjs-dist` is pinned to `4.10.38` for broad browser compatibility (newer major versions rely on very recent JS APIs).

## Deployment

Deploys as a static page plus client-side JS — works out of the box on [Vercel](https://vercel.com/). No server runtime or environment variables required.
