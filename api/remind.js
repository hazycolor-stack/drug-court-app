// GET /api/remind — runs once every morning (see vercel.json "crons").
// Sends a lock-screen reminder for appointments (IOP, MRT, one-on-one, etc.):
//   • "Tomorrow" reminder for appointments on the next day
//   • "Today" reminder for appointments later the same day
// Each reminder is marked as sent, so nobody gets the same one twice even if
// this runs more than once.
//
// Needs these Environment Variables in Vercel → Project → Settings:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_SECRET_KEY
//   CRON_SECRET (recommended: any long random text; Vercel sends it automatically)
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "./_webpush.js";

const SUPABASE_URL = "https://lyfbhkpvrfpewmbaqccd.supabase.co";
// The program is in Mississippi; "today" and "tomorrow" are counted in Central time
const TIME_ZONE = "America/Chicago";

function dateInZone(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 24 * 3600 * 1000);
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function niceTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function describe(list) {
  const sorted = [...list].sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  return sorted.map((a) => (a.time ? `${a.type} at ${niceTime(a.time)}` : a.type)).join(", ");
}

export default async function handler(req, res) {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_SECRET_KEY, CRON_SECRET } = process.env;

  if (CRON_SECRET && req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "Not allowed." });
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !SUPABASE_SECRET_KEY) {
    return res.status(500).json({ error: "Push isn't set up on the server yet (missing environment variables)." });
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY.trim(), { auth: { persistSession: false } });
  const today = dateInZone(0);
  const tomorrow = dateInZone(1);
  const now = new Date().toISOString();

  // Claim the appointments first (marks them sent), so a second run can't double up
  const claim = async (date, column) => {
    const { data, error } = await db.from("appointments")
      .update({ [column]: now })
      .eq("date", date).is(column, null)
      .select("id, user_id, type, date, time");
    if (error) throw error;
    return data || [];
  };

  let dayBefore, dayOf;
  try {
    dayBefore = await claim(tomorrow, "reminded_before_at");
    dayOf = await claim(today, "reminded_day_of_at");
  } catch (e) {
    return res.status(500).json({ error: `Couldn't read appointments: ${e.message}` });
  }

  // One alert per person per kind, listing all of that day's appointments
  const messages = []; // { userId, payload, ttl }
  const group = (rows) => rows.reduce((m, a) => ((m[a.user_id] = m[a.user_id] || []).push(a), m), {});
  for (const [userId, list] of Object.entries(group(dayBefore))) {
    messages.push({
      userId,
      payload: { title: "Appointment tomorrow", body: `Reminder: ${describe(list)} tomorrow.`, tag: `appt-before-${tomorrow}`, url: "/?tab=calendar" },
      ttl: 12 * 3600,
    });
  }
  for (const [userId, list] of Object.entries(group(dayOf))) {
    messages.push({
      userId,
      payload: { title: "Appointment today", body: `Today: ${describe(list)}.`, tag: `appt-today-${today}`, url: "/?tab=calendar" },
      ttl: 8 * 3600,
    });
  }
  if (!messages.length) return res.status(200).json({ sent: 0, today, tomorrow });

  // Skip people who turned appointment reminders off
  const userIds = [...new Set(messages.map((m) => m.userId))];
  const { data: profiles } = await db.from("profiles").select("id, notify_appointments").in("id", userIds);
  const off = new Set((profiles || []).filter((p) => p.notify_appointments === false).map((p) => p.id));

  const subs = [];
  for (let i = 0; i < userIds.length; i += 200) {
    const { data, error } = await db.from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth").in("user_id", userIds.slice(i, i + 200));
    if (error) return res.status(500).json({ error: error.message });
    subs.push(...data);
  }

  const vapid = { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY, subject: "mailto:support@drugcourtapp.org" };
  const jobs = [];
  for (const m of messages) {
    if (off.has(m.userId)) continue;
    for (const s of subs) if (s.user_id === m.userId) jobs.push({ s, m });
  }

  let sent = 0;
  const dead = new Set();
  for (let i = 0; i < jobs.length; i += 50) {
    const batch = jobs.slice(i, i + 50);
    const results = await Promise.allSettled(batch.map(({ s, m }) => sendPush(s, m.payload, vapid, { ttl: m.ttl })));
    results.forEach((r, j) => {
      if (r.status === "fulfilled" && r.value >= 200 && r.value < 300) sent++;
      else if (r.status === "fulfilled" && (r.value === 404 || r.value === 410)) dead.add(batch[j].s.id);
    });
  }
  if (dead.size) await db.from("push_subscriptions").delete().in("id", [...dead]);

  return res.status(200).json({ sent, people: userIds.length, today, tomorrow, removed: dead.size });
}
