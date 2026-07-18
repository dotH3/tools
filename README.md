# tools

A small collection of browser-based tools, styled with **Tailwind CSS**.
Everything runs locally in the browser — no build server or accounts required.

## Tools

- **Image editor** (`image-editor.html`) — load an image, annotate it with text,
  shapes, arrows and freehand drawing, and adjust filters. Every annotation is an
  object you can **select, move, resize and restyle after creating it**.

## Tailwind setup

This project uses Tailwind's utility-class workflow. Because this environment's
egress policy blocks the npm registry and every public CDN, the official
`tailwindcss` package and the Play CDN can't be fetched. To keep the project
fully self-contained and offline, Tailwind is compiled by a small
dependency-free generator:

```
scripts/generate-tailwind.js   # compiles the theme into dist/tailwind.css
tailwind.config.js             # theme tokens: colors, spacing, radius, shadows…
src/input.css                  # @tailwind directives + custom component classes
dist/tailwind.css              # generated stylesheet (committed so it works offline)
```

The generator emits the standard Tailwind palette and scale (spacing, colors,
typography, flex/grid, borders, shadows, transitions…) plus `hover:` / `focus:`
and `sm:`/`md:`/`lg:`/`xl:` responsive variants, so the markup is authored with
ordinary Tailwind classes.

### Rebuild the CSS

After editing `tailwind.config.js` or `src/input.css`:

```bash
npm run build:css
```

If a normal Tailwind toolchain becomes available, this drops in cleanly: point
your build at `src/input.css` (which already has the `@tailwind` directives) and
output to `dist/tailwind.css` — the markup needs no changes.

### Run locally

```bash
npm run dev      # builds CSS and serves on http://localhost:8000
# or just open index.html directly in a browser
```
