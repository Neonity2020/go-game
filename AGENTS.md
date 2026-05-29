# Repository Guidelines

## Project Structure & Module Organization

React + TypeScript + Vite power the Go UI; Tauri 2 packages it as a desktop app.

- `src/main.tsx` and `src/App.tsx` bootstrap the app.
- `src/components/` contains React UI.
- `src/game/` contains core rules, AI helpers, audio, KataGo client code, shared types, and the AI worker.
- `server/katagoBridge.mjs` exposes KataGo for browser development.
- `src-tauri/` contains the Tauri 2 desktop shell and Rust KataGo bridge.
- `public/` stores static icons, favicon, and logo.
- `dist/`, `node_modules/`, logs, and `*.local` files are generated or local-only.

## Build, Test, and Development Commands

Use npm; `package-lock.json` is committed.

- `npm install` installs dependencies.
- `npm run dev` starts the Vite development server.
- `npm run bridge` starts the Node KataGo bridge for browser development.
- `npm run tauri:dev` starts the desktop app, Vite, and the Rust bridge.
- `npm run tauri:build` creates the desktop bundle.
- `npm run build` runs TypeScript project checks and builds production assets.
- `npm run lint` runs ESLint across the repository.
- `npm run preview` serves the built web app locally.

KataGo defaults target Homebrew installs. Override with `KATAGO_BIN`, `KATAGO_MODEL`, `KATAGO_CONFIG`, `KATAGO_BRIDGE_PORT`, or `KATAGO_LOG_DIR`.

## Coding Style & Naming Conventions

Use TypeScript, ES modules, semicolons, and 2-space indentation. Prefer pure helpers in `src/game/` for rules and state transitions. Name components in `PascalCase` (`Board.tsx`), functions and variables in `camelCase`, and exported domain types in `src/game/types.ts`.

Run `npm run lint` before submitting changes. ESLint uses recommended JavaScript, TypeScript, React Hooks, and Vite React Refresh rules.

## Testing Guidelines

There is no test script or framework configured. Validate changes with `npm run lint` and `npm run build`, then manually exercise affected gameplay paths. If adding tests, colocate them near the code they cover with a suffix such as `engine.test.ts`, and prioritize `src/game/engine.ts`.

## Commit & Pull Request Guidelines

Recent history uses short imperative commits, often with prefixes such as `feat:` and `style:`. Prefer messages like `feat: add capture review controls` or `fix: prevent illegal ko replay`.

Pull requests should include a concise description, linked issue when applicable, validation commands run, and screenshots or recordings for visible UI changes. Note any KataGo-specific setup required.

## Security & Configuration Tips

Do not commit local KataGo models, generated bridge logs, build output, or machine-specific configuration. Bridge failures should continue to fall back to built-in browser AI where possible.
