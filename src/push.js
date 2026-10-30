// Lock-screen alerts (Web Push) — phone side.
import { supabase } from "./supabase.js";

// Public half of the server's key pair. Safe to ship in the app.
// (The private half lives only in Vercel's Environment Variables.)
export const VAPID_PUBLIC_KEY = "BDXojkGgOh_K0qLi_NDezlFHegDrUiIlEW_WjGojvuHrLCqHHrBBx9T0tICVrDFn5FGEOND64A585XWUe0c10hA";

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

// True if this phone's subscription was made with an older server key
// (alerts sent with the new key would be rejected by the phone's push service)
function staleKey(sub) {
  try {
    const k = sub.options && sub.options.applicationServerKey;
    if (!k) return false;
    const have = new Uint8Array(k);
    const want = keyBytes(VAPID_PUBLIC_KEY);
    return have.length !== want.length || have.some((b, i) => b !== want[i]);
  } catch {
    return false;
  }
}

async function dropSubscription(sub) {
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
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
  if (sub && staleKey(sub)) {
    await dropSubscription(sub);
    sub = null;
  }
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
  if (!sub) return;
  // Server key changed: clear the old one so the Alerts card offers "Turn on" again
  if (staleKey(sub)) return dropSubscription(sub);
  await saveSubscription(sub);
}

export async function isSubscribed() {
  if (pushSupport() !== "ready" || permission() !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return !!sub && !staleKey(sub);
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
