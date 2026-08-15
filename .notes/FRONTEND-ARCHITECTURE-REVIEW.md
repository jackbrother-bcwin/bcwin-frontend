# Frontend Architecture Review & Upgrade Plan

**Date:** 2026-07-13  
**Skills used:** `.agents/skills/tailwind`, `.agents/skills/frontend-design`, Next.js 16 docs in `node_modules/next/dist/docs/`  
**Note:** `nextjs-frontend-best-practices` skill was **not present** in `.agents/skills/`. Review used official Next 16 guides + local skills.

---

## Current state (audit)

| Area | Finding | Severity |
|------|---------|----------|
| Bundle | Root `page.tsx` is a mega client island importing **all** games/wallet/history eagerly | Critical |
| RSC | Almost everything is `"use client"`; layout shell is server but trivial | High |
| Context | Single AuthContext value object recreated each render → full tree re-renders on balance tick | High |
| Routing | SPA `activeTab` instead of App Router; `/wingo` `/k3` `/5d` are thin stubs unused by shell | Medium |
| Boundaries | No `error.tsx` / `loading.tsx` / `not-found.tsx` / `global-error.tsx` | High |
| Next 16 | No `optimizePackageImports` (react-icons already default-listed), no images config, no PPR flag | Medium |
| Tailwind v4 | Custom CSS classes not `@utility`; no `color-scheme` | Medium |
| a11y | Some icon buttons missing labels; tab state not `aria-current` | Medium |
| TS | `strict: true` but missing `noUncheckedIndexedAccess` | Low |

---

## Step-by-step plan

### Phase 1 — Foundation (this PR / now)

1. **Next config** — `reactStrictMode`, `poweredByHeader: false`, `images`, keep rewrites for API proxy  
2. **TypeScript** — tighten `tsconfig` (`noUncheckedIndexedAccess`)  
3. **Error/loading/404** — App Router file conventions  
4. **Auth context** — split **state** vs **actions**; memoize; stable action refs  
5. **Code-split** — `next/dynamic` for Wingo/K3/5D/Moto/wallet/history  
6. **Server `page.tsx`** — default Server Component renders client `AppShell` only  
7. **Tailwind** — `@utility` for scrollbar/page patterns; `scheme-dark` on html  

### Phase 2 — App Router routes (follow-up)

8. Move screens to real routes under `(app)/` with shared chrome layout  
9. Enable `cacheComponents: true` once routes have static shell + Suspense dynamic slots  
10. Prefetch with `<Link>` for home → wingo etc.  

### Phase 3 — Hardening

11. Route Handlers only if BFF needed; prefer cookie rewrite  
12. ESLint a11y pass; focus traps on modals  
13. E2E smoke (login → bet → wallet)  

---

## Commands

```bash
cd frontend
npm install
npm run lint
npm run build
npm run dev   # :3002
```

Optional upgrade check:

```bash
npx next@latest info
```

---

## Constraints (product)

- Keep **ts777 Black Gold** tokens  
- Keep **cookie auth** + `/api/v1` rewrite  
- Games remain **client-interactive** (timers, WS, bets) — cannot be pure RSC  
- SPA shell retained short-term; dynamic import + context split give most of the perf win without full rewrite  

---

## File change map (Phase 1) — DONE 2026-07-13

| File | Change | Status |
|------|--------|--------|
| `next.config.ts` | StrictMode, images, optimizePackageImports, compress | ✅ |
| `tsconfig.json` | ES2022, noUncheckedIndexedAccess, noImplicitOverride | ✅ |
| `app/layout.tsx` | Server shell, scheme-dark, skip link, font display swap | ✅ |
| `app/page.tsx` | **Server Component** → `<AppShell />` | ✅ |
| `app/components/AppShell.tsx` | Client shell + `next/dynamic` for all heavy screens | ✅ |
| `app/context/AuthContext.tsx` | State/actions split, useMemo, useAuthState/Actions | ✅ |
| `app/error.tsx` / `global-error.tsx` / `loading.tsx` / `not-found.tsx` | Boundaries | ✅ |
| `app/globals.css` | `@utility no-scrollbar`, `color-scheme: dark` | ✅ |
| `app/wingo|k3|5d/page.tsx` | Server redirect → `/` | ✅ |
| BottomNav / TopNav | a11y + useAuthState | ✅ |

**Build:** `npm run build` passes after Phase 1.
