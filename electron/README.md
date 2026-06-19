# Rockmundo Electron Wrapper (Phase 1)

Desktop shell that wraps the existing Vite/React app for Steam distribution
(Windows x64 + macOS x64/arm64 at launch; Linux/Steam Deck post-launch).

## Local run (dev)

```bash
# Terminal A - run the web app
npm run dev

# Terminal B - run Electron against the dev server
ELECTRON_START_URL=http://localhost:8080 npx electron electron/main.cjs
```

## Local run (production build)

```bash
npm run build
npx electron electron/main.cjs
```

`vite.config.ts` sets `base: './'` so the built `dist/index.html` works
under the `file://` protocol that Electron uses in production.

## Packaging (per-platform)

Use `@electron/packager` from CI (not electron-builder; 7zip dynamic-link
issues in our sandbox). Example commands:

```bash
# Windows x64
npx @electron/packager . "Rockmundo" \
  --platform=win32 --arch=x64 \
  --out=electron-release --overwrite \
  --ignore='^/src' --ignore='^/public' --ignore='^/electron-release'

# macOS universal (x64 + arm64)
npx @electron/packager . "Rockmundo" \
  --platform=darwin --arch=universal \
  --out=electron-release --overwrite \
  --ignore='^/src' --ignore='^/public' --ignore='^/electron-release'
```

macOS builds must be signed + notarized with an Apple Developer ID
(\$99/yr) before Steam delivery — Gatekeeper blocks unsigned apps even
when launched via Steam.

## Security posture

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Preload exposes only `window.rockmundo` (platform + version)
- External links open in the OS browser via `shell.openExternal`
- `will-navigate` is locked to `file://` (prod) or the dev server URL
