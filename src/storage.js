// ---------------------------------------------------------------------------
// STORAGE LAYER
// ---------------------------------------------------------------------------
// Right now this saves data in the browser's localStorage — private to each
// person's own device/browser. That's fine for Profile, Meetings, Calendar,
// and Fines, which are already personal to each user.
//
// IMPORTANT: the Community Feed needs data SHARED across everyone using the
// app — localStorage can't do that (it never leaves the device). Until a
// real backend (e.g. Supabase or Firebase) is wired in, each person's Feed
// tab will only show posts they made from that same device/browser — not
// posts from friends. This is the next real piece of engineering work
// (see README.md, "Next step: shared backend").
// ---------------------------------------------------------------------------

const PREFIX = "dca:"; // "Drug Court App" storage prefix, avoids collisions

export async function getJSON(key, shared, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export async function setJSON(key, value, shared) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error("storage set failed", e);
  }
}
