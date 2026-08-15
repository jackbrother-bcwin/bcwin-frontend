# Admin Panel

**Route:** `/admin`  
**Login:** `/admin/login`  
**Auth:** Same cookie `auth-token` as player app; requires `role === ADMIN | SUB_ADMIN`

## Design
Inspired by screenshots in `notes/screenshots/`:
- Blue gradient sidebar (BCWin branding + logo)
- Blue stat cards dashboard
- Game managers: live countdown, ball/dice pickers, liability heat-map, charts, setResults for wingo/k3/5d
- Agents: list + create + detail/performance drill-down
- Salary / lucky-spin: full create · edit · toggle · delete

## Stack
- Next.js 16 App Router (`app/admin/**`)
- `react-icons` (io5)
- Existing `ToastProvider`
- `app/lib/admin-api.ts` — all admin backend endpoints

## Features (full endpoint coverage in UI)

- **CRUD:** VIP, activity tiers, lucky spin rewards/rules, win-streak, salary, notifications, gifts toggle
- **Bulk:** deposits (approve/reject all/selected), withdrawals (same), queries (bulk status), multi-delete on rules/gifts
- **Viz:** recharts bar / pie / area / line on turnover, VIP, spin weights, deposits, P&L-related screens
- **Invite tree:** visual downline hierarchy at `/admin/users/invite-tree`
- **Bank / IP / commission rates / top performance** dedicated pages

## Run
```bash
cd frontend && npm run dev
# open http://localhost:3002/admin/login
```

Admin must log in with an account whose backend role is ADMIN or SUB_ADMIN.

**Build:** passes with recharts + 38 admin routes.
