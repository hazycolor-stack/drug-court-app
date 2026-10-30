// POST /api/notify  { id: <announcement id> }
// Called by the app right after staff posts an announcement. Sends a
// lock-screen alert (with the phone's normal notification sound) to everyone
// it applies to, even if they don't have the app open.
//
// Needs these Environment Variables in Vercel → Project → Settings:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_SECRET_KEY
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "./_webpush.js";

const SUPABASE_URL = "https://lyfbhkpvrfpewmbaqccd.supabase.co";
const PHASE_MONTHS = 9;
const MAX_PHASE = 5;

const TITLES = {
  testing: (p) => `${p.testing_slot === "afternoon" ? "Afternoon" : "Morning"} testing today`,
  jobs: () => "New job posting",
  events: () => "New event",
  general: () => "Announcement",
};

// Same phase math as the app (src/App.jsx → getPhaseStatus)
function currentPhase(startPhase, startDate) {
  if (!startPhase || !startDate) return null;
  const iso = /^\d{4}-\d{2}$/.test(startDate) ? startDate + "-01" : startDate;
  const start = new Date(iso + "T12:00:00");
  if (isNaN(start)) return null;
  const addMonths = (d0, n) => {
    const d = new Date(d0);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return d;
  };
  const now = new Date();
  let cycles = 0;
  while (cycles < 10 && addMonths(start, (cycles + 1) * PHASE_MONTHS) <= now) cycles++;
  return Math.min(MAX_PHASE, Number(startPhase) + cycles);
}

// Describe a Supabase key without revealing it (for setup errors)
function keyKind(k) {
  k = (k || "").trim();
  if (k.startsWith("sb_secret_")) return "a secret key (sb_secret_)";
  if (k.startsWith("sb_publishable_")) return "the publishable key (sb_publishable_)";
  try {
    const role = JSON.parse(Buffer.from(k.split(".")[1], "base64url").toString()).role;
    if (role) return `a legacy "${role}" key`;
  } catch {}
  return `an unrecognized value starting "${k.slice(0, 4)}…"`;
}

function wantsIt(profile, post) {
  if (post.category === "testing") {
    if (profile.notify_testing === false) return false;
    if (post.testing_slot && profile.testing_slot && profile.testing_slot !== post.testing_slot) return false;
    if (post.phases && post.phases.length) {
      const phase = currentPhase(profile.phase_start, profile.phase_start_month);
      if (phase !== null && !post.phases.includes(phase)) return false;
    }
    return true;
  }
  return profile[`notify_${post.category}`] !== false;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_SECRET_KEY } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !SUPABASE_SECRET_KEY) {
    return res.status(500).json({ error: "Push isn't set up on the server yet (missing environment variables)." });
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY.trim(), { auth: { persistSession: false } });

  // Only signed-in staff/admins can trigger alerts
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const { data: who } = token ? await db.auth.getUser(token) : { data: null };
  if (!who || !who.user) return res.status(401).json({ error: "Sign in first." });
  const { data: me, error: meErr } = await db.from("profiles").select("role").eq("id", who.user.id).maybeSingle();
  if (meErr) return res.status(500).json({ error: `Server couldn't read profiles (${keyKind(SUPABASE_SECRET_KEY)}): ${meErr.message}` });
  if (!me) return res.status(500).json({ error: `Server can't see your profile. SUPABASE_SECRET_KEY in Vercel looks like ${keyKind(SUPABASE_SECRET_KEY)}; it must be the sb_secret_ key.` });
  if (!["staff", "admin"].includes(me.role)) return res.status(403).json({ error: `Staff only (your role is "${me.role}").` });

  const id = Number((req.body || {}).id);
  if (!id) return res.status(400).json({ error: "Missing announcement id." });

  // Claim the post so the same alert can never go out twice
  const { data: post } = await db.from("announcements")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", id).is("notified_at", null)
    .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
    .select("*").maybeSingle();
  if (!post) return res.status(200).json({ sent: 0, note: "Already sent, or post not found." });

  const { data: profiles, error: pErr } = await db.from("profiles")
    .select("id, testing_slot, phase_start, phase_start_month, notify_testing, notify_jobs, notify_events, notify_general");
  if (pErr) return res.status(500).json({ error: pErr.message });

  const userIds = profiles.filter((p) => p.id !== post.author_id && wantsIt(p, post)).map((p) => p.id);
  if (!userIds.length) return res.status(200).json({ sent: 0 });

  const subs = [];
  for (let i = 0; i < userIds.length; i += 200) {
    const { data, error } = await db.from("push_subscriptions")
      .select("id, endpoint, p256dh, auth").in("user_id", userIds.slice(i, i + 200));
    if (error) return res.status(500).json({ error: error.message });
    subs.push(...data);
  }

  const payload = {
    title: TITLES[post.category] ? TITLES[post.category](post) : "Drug Court App",
    body: post.body.length > 180 ? post.body.slice(0, 177) + "…" : post.body,
    tag: `announcement-${post.id}`,
    url: "/?tab=profile",
  };
  // Testing alerts are only useful today
  const ttl = post.category === "testing" ? 8 * 3600 : 3 * 24 * 3600;
  const vapid = { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY, subject: "mailto:support@drugcourtapp.org" };

  let sent = 0;
  const dead = [];
  for (let i = 0; i < subs.length; i += 50) {
    const batch = subs.slice(i, i + 50);
    const results = await Promise.allSettled(batch.map((s) => sendPush(s, payload, vapid, { ttl })));
    results.forEach((r, j) => {
      if (r.status === "fulfilled" && r.value >= 200 && r.value < 300) sent++;
      else if (r.status === "fulfilled" && (r.value === 404 || r.value === 410)) dead.push(batch[j].id);
    });
  }
  if (dead.length) await db.from("push_subscriptions").delete().in("id", dead);

  return res.status(200).json({ sent, phones: subs.length, removed: dead.length });
}
