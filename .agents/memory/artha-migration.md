---
name: Artha migration notes
description: Next.js → Vite/React migration gotchas specific to this project
---

**Rule:** `process.env` is not available in Vite — replace `process.env.NEXT_PUBLIC_*` with `import.meta.env.VITE_*` or just `""` for empty base URL (relative fetch works fine with Vite proxy).

**Why:** `src/utils/api.ts` used `process.env.NEXT_PUBLIC_API_URL` which blew up at runtime with "process is not defined".

**Rule:** `next/dynamic(() => import(...), { ssr: false })` → plain `import` in Vite (no SSR to suppress). Remove `dynamic` import entirely.

**Rule:** Vite proxy config handles `/api/*` → Python backend. Add to `vite.config.ts` `server.proxy`:
```ts
proxy: {
  "/api": { target: "http://localhost:8000", changeOrigin: true },
  "/health": { target: "http://localhost:8000", changeOrigin: true },
}
```

**Rule:** Wouter router must receive `base={import.meta.env.BASE_URL?.replace(/\/$/, "")}` to work correctly under the artifact's base path.

**How to apply:** Any future Next.js page copy needs these three checks: (1) no process.env, (2) no next/dynamic, (3) no next/link or useRouter — use wouter Link and useLocation instead.
