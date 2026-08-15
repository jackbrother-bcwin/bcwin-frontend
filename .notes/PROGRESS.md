# BCWin Frontend — Progress & Work Done

**Last updated:** 2026-07-13  
**Visual reference:** [ts777.info](https://ts777.info) — **p5BlackGoldStyle ONLY** (no fireclub palette)  
**Backend docs:** `./backend-docs.txt`  
**Stack:** Next.js 16 + React 19 + Tailwind 4 + **react-icons** · mobile shell `max-w-[400px]`

---

## Theme (ts777 only — fireclub colors removed)

Pulled from live `https://ts777.info` CSS `:root` (Black Gold).  
**Policy:** zero fireclub / legacy navy-gold hex in `app/`.

| Token | Value |
|-------|--------|
| `--main-color` | `#FED358` |
| `--main-gradient` | `#FED358 → #FFB472` |
| `--text_color_L1` | `#FDE4BC` |
| `--text_color_L2` | `#B79C8B` |
| `--text_color_L3` | `#837064` |
| `--bg_color_L1` (#app) | `#110D14` |
| `--bg_color_L2` | `#241E22` |
| `--bg_color_L3` | `#382E35` |
| `--bg_HomeModule_Stroke` | `#A28422` |
| Home module pad | `linear-gradient(180deg, #312712, #1E180A)` |
| Red / Green / Blue / Purple | `#DA3735` / `#17B15E` / `#5088D3` / `#9B48DB` |
| Desktop body frame | `#9195a3` (ts777, not fireclub `#7b8a9c`) |

Viewport: `user-scalable=no`, `themeColor=#110D14`.

---

## Feature status

| Feature | Status | Notes |
|---------|--------|--------|
| **Theme = ts777 Black Gold** | ✅ Done | globals.css + bulk hex migrate |
| **react-icons** | ✅ Done | BottomNav, Login, TopNav, Moto, Notice, CS, headers |
| **Auth — Login / Register / Forgot** | ✅ Done | Cookie API; Login UI matches cream/gold text |
| **Home / lobby** | ✅ Done | Categories, grid, notice marquee, tabBarBg |
| **Bottom nav** | ✅ Done | `tabBarBg-*.webp` + gold center CTA |
| **Profile / Wallet / Deposit / Withdraw** | ✅ Done | Wired to backend payment APIs |
| **Win Go / TRX / K3 / 5D** | ✅ Done | Live periods + bets (backend) |
| **Moto Racing** | ✅ Done | Track BG, bike pass animation, race lock, podium reveal |
| **Spin / Activity / Agency** | ✅ Done | Live API |
| **Inout launch** | ✅ Done | Search + launch (third-party) |
| **Pixel-perfect every sub-screen** | 🔄 Ongoing | Colors match; layout continues refining vs screenshots |

---

## Moto production animations

- Track background: `MotoRace_bg-6e64cdd9.png`
- Bikes: `moto-c4134853.png` + colored numbers
- **Racing state** on period end / WS results: lane scroll + bike-pass + speedometer
- **Lock overlay** when countdown ≤ 5s
- **Podium confetti** reveal animation
- Bet sheet slide-up (ts777 style)

---

## How to run

```bash
cd frontend
# .env.local optional:
# BACKEND_URL=http://localhost:3000
# NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws
npm run dev   # :3002
```

`npm run build` — **passing** (2026-07-13).

---

## ts777 reference login (visual only — not our backend)

- Number: `9999333322`
- Password: `Hello111`

---

## Backlog

1. Side-by-side screenshot pass for Wallet / Deposit / Profile list icons  
2. In-app Inout webview  
3. Dedicated Moto tile on lobby (not WinGo art)  
4. Staging E2E: login → deposit → bet → withdraw  

---

## Changelog

| Date | Work |
|------|------|
| 2026-07-11 | Auth + home shell + mock games |
| 2026-07-12 | Full API, live games, wallet, progress file |
| 2026-07-13 | **ts777 Black Gold ditto theme**, react-icons, Moto race animations, tabBarBg nav, production build verify |
