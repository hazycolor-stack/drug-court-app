// Lock-screen alerts (Web Push) — phone side.
import { supabase } from "./supabase.js";

// Public half of the server's key pair. Safe to ship in the app.
// (The private half lives only in Vercel's Environment Variables.)
export const VAPID_PUBLIC_KEY = "BN4Ne9rwgvV6MXIjJ5nM0512W6k8YPCx4dZW87N2t4sfcNCPtz3fXNk59gjbZoWN02T2HWV4Xgfu-humOCysO2o";

function keyBytes(b64u) {
  const s = b64u.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64u.length % 4)) % 4);
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

function installed() {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  } catch {
    return false;
  }
}

function isIOS() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

// "ready" | "needs-install" (iPhone must add to Home Screen first) | "unsupported"
export function pushSupport() {
  if (isIOS() && !installed()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return "ready";
}

export function permission() {
  return "Notification" in window ? Notification.permission : "default";
}

async function saveSubscription(sub) {
  const json = sub.toJSON();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_user_agent: navigator.userAgent.slice(0, 300),
  });
  if (error) throw error;
}

// Must be called from a button tap (iPhone requires it)
export async function enablePush() {
  const result = await Notification.requestPermission();
  if (result !== "granted") throw new Error("denied");
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
  }
  await saveSubscription(sub);
}

// Re-save on every app open in case the phone rotated its push address
export async function syncPush() {
  if (pushSupport() !== "ready" || permission() !== "granted") return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await saveSubscription(sub);
}

export async function isSubscribed() {
  if (pushSupport() !== "ready" || permission() !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  return !!(await reg.pushManager.getSubscription());
}

// Stop alerts on this phone (used when turning off, and on log out)
export async function disablePush() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

// Staff: send the alert for a post that was just created
export async function notifyAnnouncement(id) {
  const { data } = await supabase.auth.getSession();
  const token = data.session && data.session.access_token;
  const res = await fetch("/api/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Couldn't send the alert.");
  return body;
}
