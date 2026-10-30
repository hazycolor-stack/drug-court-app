# The Drug Court App — PWA Starter

This is a real, standalone codebase (not a chat artifact) that installs as a
home-screen app on both iPhone and Android via "Add to Home Screen" — no
App Store or Play Store required to get this in front of people.

## What works right now
- Profile, sobriety counter, phase tracker, meeting counters, fines, appointment
  calendar, Court Calendar (which phase goes to court on which Tuesday),
  12 Steps, literature links, and the searchable Handbook tab — all save to
  each person's own device.
- Installable home screen icon (the blue "DC" chip) on iOS and Android.
- Loads reliably even on a spotty connection (basic offline app-shell caching).

## Handbook tab
The text lives in `src/handbook.js`. It was typed from photos of the printed
handbook; obvious printer typos were corrected. Page 4 does not exist in the
printed handbook. To fix a typo or add pages, edit that one file.

## Lock-screen alerts (push notifications)
When staff posts in the feed, everyone it applies to gets an alert with the
phone's normal notification sound, even when the app is closed. Testing posts
only go to people with that testing time and phase.

- Each person turns alerts on from **Profile → Alerts** (iPhone: the app must
  be added to the Home Screen first, iOS 16.4 or newer).
- `api/notify.js` sends the alerts (a Vercel function); `public/sw.js` shows them.
- One-time setup: run `supabase/push-notifications.sql` in Supabase, and add
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `SUPABASE_SECRET_KEY` under
  Vercel → Settings → Environment Variables. The public key must match
  `VAPID_PUBLIC_KEY` in `src/push.js`.

## Not built yet
There is no community feed and no photo/video upload. Those need a shared
backend with file storage, which is a later build step.

---

## Local setup (on your Mac, once Claude Code / Node is installed)

```bash
cd dca-pwa
npm install
npm run dev
```

This opens the app at `http://localhost:5173` — you can preview it on your
Mac's browser. To preview on your phone on the same Wi-Fi, run:

```bash
npm run dev -- --host
```

and open the "Network" URL it prints on your phone's browser.

## Deploying it live (so friends can actually open it)

The easiest option is **Vercel** — free, no server management, deploys in
about a minute:

1. Push this folder to a GitHub repo (Claude Code can help set this up)
2. Go to vercel.com, sign in with GitHub, click "New Project," pick the repo
3. Vercel auto-detects it's a Vite project — just click Deploy
4. Point your domain (e.g. drugcourtapp.com) at it in Vercel's Domains tab

**Netlify** works the same way and is an equally good option.

Once it's live at your real domain:
- On iPhone: open the site in **Safari**, tap the Share icon, tap
  **"Add to Home Screen."**
- On Android: open the site in **Chrome**, tap the menu (⋮), tap
  **"Install app"** or **"Add to Home Screen."**

Both will show the blue "DC" icon and open full-screen, no browser bar.

---

## Next step: shared backend (Feed, photos/video, real accounts)

To make the Community Feed actually shared, and to support photo/video
posts, this needs a real backend. The two easiest options to wire in next:

- **Supabase** (supabase.com) — free tier, gives you a database, file
  storage for photos/video, and real user login out of the box
- **Firebase** (firebase.google.com) — Google's equivalent, also solid

Once one of those is connected, `src/storage.js` is the only file that
needs to change — everything else in the app already calls `getJSON` /
`setJSON`, so the rest of the app doesn't need to be rewritten.

This is real backend engineering work — a good next task to tackle with
Claude Code once the Mac is set up.
