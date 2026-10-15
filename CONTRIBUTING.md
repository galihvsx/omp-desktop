# Contributing to OMP Desktop

Thanks for your interest in improving OMP Desktop! This document covers how to set up the project, run tests, and submit changes.

## Before you start

OMP Desktop is an early-stage project — expect churn in the code and in these instructions. If something here is outdated, a PR that fixes it is very welcome.

## Development setup

Prerequisites (see the README for details):

- Windows 10/11 with WebView2 (OMP Desktop is Windows-first)
- Go 1.25+
- Node.js 20+ and npm
- The [Wails CLI](https://wails.io) v2:

  ```sh
  go install github.com/wailsapp/wails/v2/cmd/wails@v2.16.0
  ```

- The `omp` CLI on your `PATH` if you want to exercise real sessions.

### Running the app

From the repo root:

```sh
wails dev
```

This runs the Go backend and the Vite dev server with hot reload. Go methods are also exposed to a browser dev server at http://localhost:34115.

### Frontend-only work

```sh
cd frontend
npm install        # first time
npm run dev        # Vite dev server only
npm run build      # production build + TypeScript typecheck
```

## Tests

```sh
go test ./...
go vet ./...
```

Notes:

- The Go build embeds `frontend/dist`, so run `cd frontend && npm run build` once on a clean checkout before Go commands.
- There is no frontend test suite yet; `npm run build` runs the typecheck (`tsc`).

## Submitting changes

1. Fork the repository and create a topic branch.
2. Keep changes focused — one logical change per pull request.
3. Make sure `go test ./...` and `cd frontend && npm run build` pass.
4. Add or update backend tests for behavior changes (the RPC bridge, sessions, terminals, and git helpers all have Go test coverage).
5. For UI changes, include a screenshot in the PR.
6. Describe what changed and why in the PR description.

## Code conventions

Repository conventions are documented in [AGENTS.md](AGENTS.md) — it is written for AI coding agents but doubles as an architecture overview. Highlights:

- Exported methods on `App` (Go) become frontend-callable bindings; `frontend/wailsjs/**` is generated — don't hand-edit it.
- New UI primitives should reuse the existing shadcn/Base UI components and the design tokens in `frontend/src/style.css` instead of hardcoding colors.
- The window is frameless; dragging/resizing goes through Wails runtime calls.

## Code of conduct

By participating in this project you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).
