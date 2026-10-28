import { createClient } from "@supabase/supabase-js";

// These two values are public by design — they're safe to ship in the app.
// Never put the "secret" / "service_role" key in this file.
const SUPABASE_URL = "https://lyfbhkpvrfpewmbaqccd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_O1_bq70O30N1Em7_g4MURA_UBrUlVq6";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const PHOTO_BUCKET = "profile-photos";

// ---------- Profile row <-> app profile ----------
export function profileFromRow(row) {
  return {
    name: row.full_name || "",
    email: row.email || "",
    phone: row.phone || "",
    state: row.state || "",
    program: row.program || "",
    soberDate: row.sober_date || "",
    bio: row.bio || "",
    avatar: row.avatar || "",
    avatarUrl: row.avatar_url || "",
    headerUrl: row.header_url || "",
    phaseStart: row.phase_start || 2,
    phaseStartMonth: row.phase_start_month || "",
    testingSlot: row.testing_slot || "",
    testingSlotChangedAt: row.testing_slot_changed_at || "",
    role: row.role || "participant",
  };
}

// Only the fields a person is allowed to edit from the Profile screen
export function rowFromProfile(p) {
  return {
    full_name: p.name || "",
    sober_date: p.soberDate || null,
    bio: p.bio || "",
    avatar: p.avatar || "",
    avatar_url: p.avatarUrl || null,
    header_url: p.headerUrl || null,
    phase_start: Number(p.phaseStart) || 2,
    phase_start_month: p.phaseStartMonth || null,
  };
}

// ---------- Photos: shrink on the phone before uploading ----------
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that photo")); };
    img.src = url;
  });
}

// square = true crops the center into a square (profile photos)
export async function compressImage(file, { maxSize, square = false, quality = 0.82 }) {
  const { img, url } = await loadImage(file);
  try {
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (square) {
      const side = Math.min(sw, sh);
      sx = (sw - side) / 2; sy = (sh - side) / 2; sw = side; sh = side;
    }
    const scale = Math.min(1, maxSize / Math.max(sw, sh));
    const w = Math.round(sw * scale), h = Math.round(sh * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("Couldn't process that photo");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// kind: "avatar" | "header"
export async function uploadPhoto(userId, file, kind) {
  const blob = kind === "avatar"
    ? await compressImage(file, { maxSize: 400, square: true })
    : await compressImage(file, { maxSize: 1200 });
  const path = `${userId}/${kind}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: "image/jpeg", upsert: false, cacheControl: "31536000",
  });
  if (error) throw error;
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}
