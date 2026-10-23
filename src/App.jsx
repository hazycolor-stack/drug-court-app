import React, { useState, useEffect, useCallback } from "react";
import {
  Home, Users, BookOpen, FileText, User, Plus, Minus,
  DollarSign, Calendar, Search, ChevronDown, ChevronLeft, ChevronRight, ExternalLink,
  Award, Edit2, X, Check, Trash2
} from "lucide-react";
import { getJSON, setJSON } from "./storage.js";
import { HANDBOOK, HANDBOOK_QUICK } from "./handbook.js";

// ---------- Fonts ----------
const FontLoader = () => (
  <style>{`
    * { box-sizing: border-box; }
    body, html { margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    button, input, textarea, select { font-family: inherit; }
  `}</style>
);

// ---------- Font: Helvetica everywhere (headers use Helvetica Bold) ----------
const HELV = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// ---------- Palette (tokens) ----------
const C = {
  ink: "#132540",
  inkSoft: "#5A7292",
  paper: "#EAF1F8",
  paperDeep: "#D9E5F1",
  card: "#F9FBFE",
  gold: "#3E7FD1",
  goldDeep: "#265CC8",
  teal: "#2B6A8F",
  tealDeep: "#173E54",
  rust: "#7A5CB8",
  line: "#C7D6E6",
};

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------- Original reflection pool (not copied from any book) ----------
const REFLECTIONS = [
  { title: "One Day", body: "You don't have to solve the rest of your life today. You only have to get through today. Tomorrow gets its own turn." },
  { title: "Honesty First", body: "The truth is heavier to carry when it's hidden. Say the hard thing to one person today and notice how much lighter you feel." },
  { title: "Small Wins Count", body: "A meeting attended, a call made, a craving that passed — none of it is small. Recovery is built one unremarkable choice at a time." },
  { title: "Ask for Help", body: "Needing help isn't the opposite of strength. The people who make it are the ones who learned to ask." },
  { title: "Progress, Not Perfect", body: "You will not do this flawlessly. Nobody does. The goal isn't a clean record, it's showing up again after the messy days." },
  { title: "Old Habits, New Paths", body: "The people, places, and routines that used to lead you somewhere bad still remember the way. It's okay to choose a different road, even if it's less convenient." },
  { title: "Sit With It", body: "Uncomfortable feelings pass whether or not you use. You've survived every hard feeling so far. This one will pass too." },
  { title: "Gratitude in Small Things", body: "Coffee that's still hot. A text back. A bed to sleep in tonight. Recovery makes room to notice things you used to walk past." },
  { title: "Your Word Matters", body: "Every promise you keep to yourself — even small ones — rebuilds trust with the person you'll need to rely on most: you." },
  { title: "Boundaries Are Care", body: "Saying no to an old friend, a bad scene, or a risky night isn't rejection. It's you choosing your future over your comfort." },
  { title: "The Work Isn't Punishment", body: "Meetings, check-ins, paperwork — it can feel like a sentence. It's also proof someone's willing to help you rebuild, if you let it be that." },
  { title: "Slips Aren't the End", body: "A hard day doesn't erase the good ones before it. What matters most is the very next choice you make." },
  { title: "Structure Is Freedom", body: "A schedule can feel like a cage at first. Give it time — routine is often what holds people up when willpower runs out." },
  { title: "You Are Not Your Worst Day", body: "Whatever brought you here doesn't have to be the whole story. The next chapter is still unwritten." },
  { title: "Community Over Isolation", body: "Using thrives in secrecy. Recovery thrives in rooms full of people who already know your excuses because they used them too." },
];

function reflectionForToday() {
  const day = Math.floor(Date.now() / DAY_MS);
  return REFLECTIONS[day % REFLECTIONS.length];
}

const TWELVE_STEPS = [
  "We admitted we were powerless over our addiction – that our lives had become unmanageable.",
  "Came to believe that a Power greater than ourselves could restore us to sanity.",
  "Made a decision to turn our will and our lives over to the care of God as we understood Him.",
  "Made a searching and fearless moral inventory of ourselves.",
  "Admitted to God, to ourselves, and to another human being the exact nature of our wrongs.",
  "Were entirely ready to have God remove all these defects of character.",
  "Humbly asked Him to remove our shortcomings.",
  "Made a list of all persons we had harmed, and became willing to make amends to them all.",
  "Made direct amends to such people wherever possible, except when to do so would injure them or others.",
  "Continued to take personal inventory and when we were wrong promptly admitted it.",
  "Sought through prayer and meditation to improve our conscious contact with God as we understood Him, praying only for knowledge of His will for us and the power to carry that out.",
  "Having had a spiritual awakening as the result of these steps, we tried to carry this message to others, and to practice these principles in all our affairs.",
];

function daysSince(dateStr) {
  if (!dateStr) return null;
  const start = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const diff = Math.floor((now - start) / DAY_MS);
  return diff >= 0 ? diff : 0;
}

const PHASE_MONTHS = 9;
const MAX_PHASE = 5;
const CR_AA_WEEKLY_GOAL = 2;
const CR_AA_PHASE_GOAL = Math.round(PHASE_MONTHS * (52 / 12) * CR_AA_WEEKLY_GOAL);

function monthsBetween(startDate, now) {
  return (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
}

// startPhase: 2-5, startMonth: "YYYY-MM"
function getPhaseStatus(startPhase, startMonth) {
  if (!startPhase || !startMonth) return null;
  const start = new Date(startMonth + "-01T00:00:00");
  const now = new Date();
  const elapsed = Math.max(0, monthsBetween(start, now));
  const cyclesCompleted = Math.floor(elapsed / PHASE_MONTHS);
  const currentPhase = Math.min(MAX_PHASE, startPhase + cyclesCompleted);
  if (currentPhase >= MAX_PHASE) {
    return { phase: MAX_PHASE, maxed: true, daysUntilNext: null, nextDate: null };
  }
  const nextPhaseDate = new Date(start);
  nextPhaseDate.setMonth(nextPhaseDate.getMonth() + (cyclesCompleted + 1) * PHASE_MONTHS);
  const daysUntilNext = Math.max(0, Math.ceil((nextPhaseDate - now) / DAY_MS));
  return { phase: currentPhase, maxed: false, daysUntilNext, nextDate: nextPhaseDate };
}

// ---------- Profile avatars (original artwork, drawn as SVG) ----------
const _eyes = (y = 55, dx = 12, ink = "#1c1a2e") =>
  `<ellipse cx="${50 - dx}" cy="${y}" rx="4.3" ry="5.6" fill="${ink}"/><ellipse cx="${50 + dx}" cy="${y}" rx="4.3" ry="5.6" fill="${ink}"/>` +
  `<circle cx="${50 - dx + 1.6}" cy="${y - 2.2}" r="1.7" fill="#fff"/><circle cx="${50 + dx + 1.6}" cy="${y - 2.2}" r="1.7" fill="#fff"/>` +
  `<circle cx="${50 - dx - 1.4}" cy="${y + 2}" r="0.8" fill="#fff" opacity=".8"/><circle cx="${50 + dx - 1.4}" cy="${y + 2}" r="0.8" fill="#fff" opacity=".8"/>`;
const _blush = (y = 63, dx = 19, c = "#ff8fa3") =>
  `<ellipse cx="${50 - dx}" cy="${y}" rx="5" ry="3" fill="${c}" opacity=".55"/><ellipse cx="${50 + dx}" cy="${y}" rx="5" ry="3" fill="${c}" opacity=".55"/>`;
const _smile = (y = 66, w = 5, ink = "#5b2d2d") =>
  `<path d="M${50 - w} ${y} Q50 ${y + 5} ${50 + w} ${y}" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`;

const AVATARS = [
  {
    id: "ninja", label: "Ninja", bg: "#2f4a78",
    svg:
      `<path d="M22 100 Q22 80 50 80 Q78 80 78 100Z" fill="#232a3b"/>` +
      `<circle cx="50" cy="52" r="32" fill="#232a3b"/>` +
      `<rect x="24" y="44" width="52" height="22" rx="11" fill="#f6d3b0"/>` +
      `<path d="M18 40 Q50 28 82 40 L82 49 Q50 38 18 49Z" fill="#d64545"/>` +
      `<rect x="43" y="36.5" width="14" height="9" rx="2" fill="#c8d2e0"/><path d="M47 41 h6" stroke="#6b7a90" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M80 43 L96 36 L92 46 L97 54 L82 49Z" fill="#b83a3a"/>` +
      _eyes(56, 11) + _blush(62, 17, "#ff8f8f"),
  },
  {
    id: "cowboy", label: "Cowboy", bg: "#e8b36a",
    svg:
      `<path d="M20 100 Q22 82 50 82 Q78 82 80 100Z" fill="#3e7fd1"/>` +
      `<path d="M38 82 L50 96 L62 82Z" fill="#d64545"/>` +
      `<circle cx="50" cy="56" r="28" fill="#f6d3b0"/>` +
      `<path d="M23 54 Q22 40 34 36 L66 36 Q78 40 77 54 Q70 44 50 44 Q30 44 23 54Z" fill="#6b3f1d"/>` +
      `<ellipse cx="50" cy="38" rx="42" ry="9" fill="#9a6232"/>` +
      `<path d="M31 38 Q29 12 50 11 Q71 12 69 38Z" fill="#b8763c"/>` +
      `<path d="M31 35 Q50 41 69 35 L69 31 Q50 37 31 31Z" fill="#5b3414"/>` +
      `<circle cx="50" cy="35" r="2" fill="#f2c14e"/>` +
      _eyes(58, 11) + _blush(66, 18) + _smile(68, 6),
  },
  {
    id: "cowgirl", label: "Cowgirl", bg: "#f2a7b8",
    svg:
      `<path d="M20 100 Q22 82 50 82 Q78 82 80 100Z" fill="#e8788e"/>` +
      `<path d="M38 82 L50 95 L62 82Z" fill="#fff"/>` +
      `<ellipse cx="21" cy="66" rx="8" ry="14" fill="#7a4a2a"/><ellipse cx="79" cy="66" rx="8" ry="14" fill="#7a4a2a"/>` +
      `<circle cx="21" cy="80" r="3.5" fill="#e8788e"/><circle cx="79" cy="80" r="3.5" fill="#e8788e"/>` +
      `<circle cx="50" cy="56" r="28" fill="#f8dcc0"/>` +
      `<path d="M23 54 Q22 40 34 36 L66 36 Q78 40 77 54 Q72 46 60 45 Q50 49 40 45 Q28 46 23 54Z" fill="#7a4a2a"/>` +
      `<ellipse cx="50" cy="37" rx="42" ry="9" fill="#d9a05f"/>` +
      `<path d="M31 37 Q29 12 50 11 Q71 12 69 37Z" fill="#e6b777"/>` +
      `<path d="M31 34 Q50 40 69 34 L69 30 Q50 36 31 30Z" fill="#e8788e"/>` +
      `<path d="M50 28.5 l1.7 3.4 3.7.5-2.7 2.6.6 3.7-3.3-1.8-3.3 1.8.6-3.7-2.7-2.6 3.7-.5z" fill="#fff"/>` +
      _eyes(58, 11) + _blush(66, 18) + _smile(68, 6),
  },
  {
    id: "puppy", label: "Puppy", bg: "#bfe0f5",
    svg:
      `<path d="M12 44 Q6 76 28 80 Q36 62 32 42Z" fill="#6b4226"/><path d="M88 44 Q94 76 72 80 Q64 62 68 42Z" fill="#6b4226"/>` +
      `<circle cx="50" cy="54" r="31" fill="#d9a066"/>` +
      `<path d="M50 30 Q64 30 70 44 Q60 36 50 38Z" fill="#c68a4f" opacity=".0"/>` +
      `<circle cx="64" cy="48" r="11" fill="#6b4226" opacity=".9"/>` +
      `<ellipse cx="50" cy="68" rx="15" ry="11" fill="#f6e3c8"/>` +
      `<ellipse cx="50" cy="61" rx="5.5" ry="4" fill="#2a1e1e"/><circle cx="48.5" cy="59.8" r="1.2" fill="#fff"/>` +
      `<path d="M50 65 V70 M43 70 Q50 76 57 70" fill="none" stroke="#2a1e1e" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="M46 72 Q50 82 54 72Z" fill="#ff7d93"/>` +
      _eyes(50, 13) + _blush(62, 24, "#ff9aa8"),
  },
  {
    id: "kitty", label: "Kitty", bg: "#ffe3a3",
    svg:
      `<path d="M20 44 L24 14 L46 30Z" fill="#f08a3c"/><path d="M80 44 L76 14 L54 30Z" fill="#f08a3c"/>` +
      `<path d="M26 36 L28 22 L40 31Z" fill="#ffb5c0"/><path d="M74 36 L72 22 L60 31Z" fill="#ffb5c0"/>` +
      `<ellipse cx="50" cy="58" rx="33" ry="29" fill="#f6993f"/>` +
      `<path d="M50 30 V40 M42 31 L44 39 M58 31 L56 39" stroke="#c9691f" stroke-width="3" stroke-linecap="round"/>` +
      `<ellipse cx="50" cy="70" rx="13" ry="9" fill="#fff3df"/>` +
      `<path d="M46.5 63 H53.5 L50 67Z" fill="#ff7d93"/>` +
      `<path d="M50 67 V70 M44 71 Q47 74 50 70 Q53 74 56 71" fill="none" stroke="#6b3a1a" stroke-width="1.7" stroke-linecap="round"/>` +
      `<path d="M30 66 L16 63 M30 70 L16 72 M70 66 L84 63 M70 70 L84 72" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".9"/>` +
      _eyes(54, 14, "#1c1a2e") + _blush(65, 24),
  },
  {
    id: "fox", label: "Fox", bg: "#cfe8d5",
    svg:
      `<path d="M16 46 L22 12 L46 30Z" fill="#e8662a"/><path d="M84 46 L78 12 L54 30Z" fill="#e8662a"/>` +
      `<path d="M24 36 L26 22 L38 31Z" fill="#3a2a2a"/><path d="M76 36 L74 22 L62 31Z" fill="#3a2a2a"/>` +
      `<path d="M50 90 Q16 72 14 52 Q14 34 50 34 Q86 34 86 52 Q84 72 50 90Z" fill="#f0742f"/>` +
      `<path d="M50 86 Q28 74 16 58 Q34 56 50 70 Q66 56 84 58 Q72 74 50 86Z" fill="#fff6ea"/>` +
      `<ellipse cx="50" cy="69" rx="4.5" ry="3.4" fill="#2a1e1e"/>` +
      `<path d="M50 72 Q50 76 46 77 M50 72 Q50 76 54 77" fill="none" stroke="#2a1e1e" stroke-width="1.6" stroke-linecap="round"/>` +
      _eyes(54, 14) + _blush(64, 25),
  },
  {
    id: "panda", label: "Panda", bg: "#d6e4f3",
    svg:
      `<circle cx="22" cy="26" r="12" fill="#22252b"/><circle cx="78" cy="26" r="12" fill="#22252b"/>` +
      `<ellipse cx="50" cy="56" rx="35" ry="31" fill="#fbfbfd"/>` +
      `<ellipse cx="36" cy="54" rx="9.5" ry="12" fill="#22252b" transform="rotate(20 36 54)"/><ellipse cx="64" cy="54" rx="9.5" ry="12" fill="#22252b" transform="rotate(-20 64 54)"/>` +
      `<ellipse cx="37" cy="54" rx="4.2" ry="5.4" fill="#fff"/><ellipse cx="63" cy="54" rx="4.2" ry="5.4" fill="#fff"/>` +
      `<circle cx="37.5" cy="54.5" r="2.8" fill="#1c1a2e"/><circle cx="62.5" cy="54.5" r="2.8" fill="#1c1a2e"/>` +
      `<circle cx="38.5" cy="53.2" r="1" fill="#fff"/><circle cx="63.5" cy="53.2" r="1" fill="#fff"/>` +
      `<ellipse cx="50" cy="65" rx="5" ry="3.6" fill="#22252b"/>` +
      `<path d="M50 68 Q50 73 45 73 M50 68 Q50 73 55 73" fill="none" stroke="#22252b" stroke-width="1.8" stroke-linecap="round"/>` +
      _blush(68, 22, "#ff9aa8"),
  },
  {
    id: "bunny", label: "Bunny", bg: "#e6d9f5",
    svg:
      `<ellipse cx="36" cy="22" rx="9" ry="22" fill="#fbf4f6"/><ellipse cx="64" cy="22" rx="9" ry="22" fill="#fbf4f6"/>` +
      `<ellipse cx="36" cy="24" rx="4.6" ry="15" fill="#ffb5c8"/><ellipse cx="64" cy="24" rx="4.6" ry="15" fill="#ffb5c8"/>` +
      `<ellipse cx="50" cy="60" rx="33" ry="29" fill="#fbf4f6"/>` +
      `<path d="M46.5 64 H53.5 L50 68Z" fill="#ff8fa6"/>` +
      `<path d="M50 68 V71 M44 72 Q47 75 50 71 Q53 75 56 72" fill="none" stroke="#9a5a6a" stroke-width="1.7" stroke-linecap="round"/>` +
      `<rect x="46" y="72.5" width="3.5" height="5" rx="1" fill="#fff" stroke="#e5cdd6" stroke-width=".8"/><rect x="50.5" y="72.5" width="3.5" height="5" rx="1" fill="#fff" stroke="#e5cdd6" stroke-width=".8"/>` +
      _eyes(57, 14) + _blush(66, 25),
  },
  {
    id: "robot", label: "Robot", bg: "#cdd9ea",
    svg:
      `<path d="M50 20 V10" stroke="#5a6b84" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="8" r="4.5" fill="#d64545"/>` +
      `<rect x="14" y="48" width="8" height="18" rx="3" fill="#7d8da6"/><rect x="78" y="48" width="8" height="18" rx="3" fill="#7d8da6"/>` +
      `<rect x="20" y="20" width="60" height="58" rx="16" fill="#aebcd2"/>` +
      `<rect x="27" y="30" width="46" height="30" rx="10" fill="#1d2c45"/>` +
      `<circle cx="39" cy="45" r="6" fill="#6fe3ff"/><circle cx="61" cy="45" r="6" fill="#6fe3ff"/>` +
      `<circle cx="40.8" cy="43" r="2" fill="#fff"/><circle cx="62.8" cy="43" r="2" fill="#fff"/>` +
      `<path d="M38 69 H62" stroke="#5a6b84" stroke-width="3" stroke-linecap="round"/><path d="M44 66 V72 M50 66 V72 M56 66 V72" stroke="#5a6b84" stroke-width="1.6"/>` +
      `<circle cx="27" cy="70" r="2" fill="#7d8da6"/><circle cx="73" cy="70" r="2" fill="#7d8da6"/>`,
  },
  {
    id: "frog", label: "Froggy", bg: "#d7efc2",
    svg:
      `<circle cx="30" cy="34" r="14" fill="#5cb85c"/><circle cx="70" cy="34" r="14" fill="#5cb85c"/>` +
      `<ellipse cx="50" cy="62" rx="36" ry="28" fill="#6cc76a"/>` +
      `<circle cx="30" cy="34" r="9.5" fill="#fff"/><circle cx="70" cy="34" r="9.5" fill="#fff"/>` +
      `<circle cx="31" cy="35" r="5.6" fill="#1c1a2e"/><circle cx="69" cy="35" r="5.6" fill="#1c1a2e"/>` +
      `<circle cx="32.8" cy="33" r="1.9" fill="#fff"/><circle cx="70.8" cy="33" r="1.9" fill="#fff"/>` +
      `<path d="M28 64 Q50 82 72 64" fill="none" stroke="#2f6b34" stroke-width="2.4" stroke-linecap="round"/>` +
      `<circle cx="45" cy="55" r="1.3" fill="#2f6b34"/><circle cx="55" cy="55" r="1.3" fill="#2f6b34"/>` +
      _blush(66, 27, "#ff9aa8"),
  },

  {
    id: "locs-boy", label: "Locs Boy", bg: "#f2c36b",
    svg:
      `<path d="M20 100 Q22 82 50 82 Q78 82 80 100Z" fill="#3e7fd1"/>` +
      `<g stroke="#1d1512" stroke-width="7" stroke-linecap="round" fill="none"><path d="M22 44 Q14 58 17 78"/><path d="M29 38 Q22 58 25 82"/><path d="M78 44 Q86 58 83 78"/><path d="M71 38 Q78 58 75 82"/><path d="M36 33 Q30 50 32 70" opacity=".0"/></g>` +
      `<circle cx="50" cy="56" r="28" fill="#8d5a3b"/>` +
      `<path d="M22 50 Q20 28 36 22 Q50 16 64 22 Q80 28 78 50 Q72 40 62 38 Q50 42 38 38 Q28 40 22 50Z" fill="#1d1512"/>` +
      `<g stroke="#1d1512" stroke-width="6.5" stroke-linecap="round"><path d="M32 24 L28 12"/><path d="M42 20 L40 8"/><path d="M52 19 L52 7"/><path d="M62 20 L65 8"/><path d="M71 25 L77 14"/></g>` +
      _eyes(58, 11) + `<ellipse cx="31" cy="66" rx="5" ry="3" fill="#e0707a" opacity=".4"/><ellipse cx="69" cy="66" rx="5" ry="3" fill="#e0707a" opacity=".4"/>` + _smile(68, 6, "#3b1d12"),
  },
  {
    id: "locs-girl", label: "Locs Girl", bg: "#c8a6ec",
    svg:
      `<path d="M20 100 Q22 82 50 82 Q78 82 80 100Z" fill="#e8788e"/>` +
      `<g stroke="#1d1512" stroke-width="7" stroke-linecap="round" fill="none"><path d="M22 42 Q10 62 14 90"/><path d="M29 36 Q20 62 24 94"/><path d="M78 42 Q90 62 86 90"/><path d="M71 36 Q80 62 76 94"/></g>` +
      `<circle cx="14" cy="90" r="3" fill="#f2c14e"/><circle cx="24" cy="94" r="3" fill="#6fe3ff"/><circle cx="86" cy="90" r="3" fill="#f2c14e"/><circle cx="76" cy="94" r="3" fill="#6fe3ff"/>` +
      `<circle cx="50" cy="56" r="28" fill="#7a4a2d"/>` +
      `<path d="M22 50 Q20 28 36 22 Q50 16 64 22 Q80 28 78 50 Q72 41 62 39 Q50 44 38 39 Q28 41 22 50Z" fill="#1d1512"/>` +
      `<g stroke="#1d1512" stroke-width="6.5" stroke-linecap="round"><path d="M34 23 L30 11"/><path d="M45 19 L43 7"/><path d="M56 19 L58 7"/><path d="M67 23 L71 12"/></g>` +
      `<path d="M23 40 Q50 28 77 40 L77 46 Q50 35 23 46Z" fill="#f2c14e"/>` +
      `<circle cx="22" cy="64" r="2.6" fill="#f2c14e"/><circle cx="78" cy="64" r="2.6" fill="#f2c14e"/>` +
      _eyes(58, 11) + `<ellipse cx="31" cy="66" rx="5" ry="3" fill="#ff8fa3" opacity=".5"/><ellipse cx="69" cy="66" rx="5" ry="3" fill="#ff8fa3" opacity=".5"/>` + _smile(68, 6, "#3b1d12"),
  },
  {
    id: "puff-girl", label: "Curly Puff", bg: "#9ad9d0",
    svg:
      `<path d="M20 100 Q22 82 50 82 Q78 82 80 100Z" fill="#f2c14e"/>` +
      `<circle cx="50" cy="34" r="30" fill="#1d1512"/><circle cx="24" cy="48" r="13" fill="#1d1512"/><circle cx="76" cy="48" r="13" fill="#1d1512"/>` +
      `<circle cx="50" cy="58" r="27" fill="#6f4529"/>` +
      `<path d="M24 46 Q50 30 76 46 Q70 40 62 40 Q50 44 38 40 Q30 40 24 46Z" fill="#1d1512"/>` +
      `<path d="M21 42 Q50 24 79 42 L78 48 Q50 32 22 48Z" fill="#d64545"/>` +
      `<circle cx="22" cy="68" r="3.2" fill="#fff" stroke="#e8c3a0" stroke-width=".8"/><circle cx="78" cy="68" r="3.2" fill="#fff" stroke="#e8c3a0" stroke-width=".8"/>` +
      _eyes(59, 11) + `<ellipse cx="31" cy="67" rx="5" ry="3" fill="#ff8fa3" opacity=".5"/><ellipse cx="69" cy="67" rx="5" ry="3" fill="#ff8fa3" opacity=".5"/>` + _smile(69, 6, "#3b1d12"),
  },
  {
    id: "fade-boy", label: "Fade Boy", bg: "#a9c7f0",
    svg:
      `<path d="M20 100 Q22 82 50 82 Q78 82 80 100Z" fill="#2f9e6a"/><path d="M39 82 Q50 90 61 82" fill="none" stroke="#1f7a50" stroke-width="3"/>` +
      `<circle cx="50" cy="56" r="28" fill="#7a4a2d"/>` +
      `<path d="M23 50 Q20 26 50 24 Q80 26 77 50 Q72 40 64 39 Q50 36 36 39 Q28 40 23 50Z" fill="#1d1512"/>` +
      `<path d="M26 47 Q30 38 38 38" fill="none" stroke="#3a2a22" stroke-width="2"/>` +
      `<g fill="none" stroke="#2a2f45" stroke-width="2.4"><circle cx="39" cy="58" r="8"/><circle cx="61" cy="58" r="8"/><path d="M47 58 H53"/></g>` +
      _eyes(58, 11) + `<ellipse cx="29" cy="68" rx="4.5" ry="2.8" fill="#e0707a" opacity=".4"/><ellipse cx="71" cy="68" rx="4.5" ry="2.8" fill="#e0707a" opacity=".4"/>` + _smile(69, 6, "#3b1d12"),
  },
  {
    id: "boy", label: "Boy", bg: "#bde3a8",
    svg:
      `<path d="M20 100 Q22 82 50 82 Q78 82 80 100Z" fill="#6c5fc7"/>` +
      `<circle cx="50" cy="56" r="28" fill="#f6d3b0"/>` +
      `<path d="M22 52 Q18 24 40 20 Q50 12 62 20 Q82 24 78 52 Q74 42 66 40 L58 33 Q50 41 42 34 L34 40 Q26 42 22 52Z" fill="#8a5a2b"/>` +
      `<g stroke="#8a5a2b" stroke-width="5" stroke-linecap="round"><path d="M36 21 L33 10"/><path d="M48 17 L49 6"/><path d="M60 19 L65 9"/></g>` +
      _eyes(58, 11) + _blush(66, 18) + `<path d="M43 67 Q50 75 57 67Z" fill="#8a2f3b"/><path d="M45.5 69.5 H54.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: "girl", label: "Girl", bg: "#f7c6a3",
    svg:
      `<path d="M20 100 Q22 82 50 82 Q78 82 80 100Z" fill="#2fa3a0"/>` +
      `<path d="M72 34 Q96 40 90 74 Q86 90 76 88 Q84 66 70 46Z" fill="#b5532a"/>` +
      `<circle cx="50" cy="56" r="28" fill="#f8dcc0"/>` +
      `<path d="M22 54 Q18 24 50 21 Q82 24 78 54 Q74 44 66 40 Q56 46 44 38 Q30 42 22 54Z" fill="#b5532a"/>` +
      `<path d="M30 40 Q42 30 62 36" fill="none" stroke="#c96a3a" stroke-width="2" opacity=".7"/>` +
      `<rect x="70" y="35" width="9" height="7" rx="3" fill="#e8788e" transform="rotate(25 74 38)"/>` +
      _eyes(58, 11) + _blush(66, 18) + _smile(68, 6),
  },

  {
    id: "dragon", label: "Dragon", bg: "#f5a77a",
    svg:
      `<path d="M20 100 Q22 82 50 82 Q78 82 80 100Z" fill="#3d9e6a"/>` +
      `<path d="M26 40 L20 16 L40 30Z M74 40 L80 16 L60 30Z" fill="#f2c14e"/>` +
      `<path d="M38 28 L42 18 L47 27Z M47 26 L50 14 L55 26Z M54 27 L58 18 L62 28Z" fill="#2f7d52"/>` +
      `<circle cx="50" cy="56" r="29" fill="#5ac27e"/>` +
      `<ellipse cx="50" cy="68" rx="17" ry="12" fill="#a8e6b8"/>` +
      `<circle cx="44" cy="68" r="2" fill="#2f7d52"/><circle cx="56" cy="68" r="2" fill="#2f7d52"/>` +
      _eyes(52, 12, "#2a1a2e") + `<ellipse cx="29" cy="62" rx="4.5" ry="3" fill="#ff8fa3" opacity=".55"/><ellipse cx="71" cy="62" rx="4.5" ry="3" fill="#ff8fa3" opacity=".55"/>` +
      `<path d="M43 74 Q50 79 57 74" fill="none" stroke="#2f7d52" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: "samurai", label: "Samurai", bg: "#d96a5a",
    svg:
      `<path d="M18 100 Q20 82 50 82 Q80 82 82 100Z" fill="#8b1f2b"/><path d="M34 82 L50 94 L66 82" fill="none" stroke="#f2c14e" stroke-width="3"/>` +
      `<circle cx="50" cy="56" r="28" fill="#f6d3b0"/>` +
      `<path d="M22 50 Q20 22 50 20 Q80 22 78 50 Q72 40 64 38 Q50 34 36 38 Q28 40 22 50Z" fill="#1d1512"/>` +
      `<circle cx="50" cy="12" r="7" fill="#1d1512"/><rect x="45" y="17" width="10" height="4" rx="2" fill="#d64545"/>` +
      `<path d="M26 38 Q50 28 74 38 L74 44 Q50 34 26 44Z" fill="#f2f2f2"/><circle cx="50" cy="37" r="3" fill="#d64545"/>` +
      _eyes(58, 11) + _blush(66, 18) + `<path d="M45 69 Q50 72 55 69" fill="none" stroke="#5b2d2d" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M42 64 Q50 61 58 64" fill="none" stroke="#1d1512" stroke-width="1.8" stroke-linecap="round" opacity="0"/>`,
  },
  {
    id: "ninja-girl", label: "Ninja Girl", bg: "#b184d8",
    svg:
      `<path d="M22 100 Q22 80 50 80 Q78 80 78 100Z" fill="#5a2a7a"/>` +
      `<circle cx="50" cy="52" r="32" fill="#5a2a7a"/>` +
      `<rect x="24" y="44" width="52" height="22" rx="11" fill="#f8dcc0"/>` +
      `<path d="M18 40 Q50 28 82 40 L82 49 Q50 38 18 49Z" fill="#f2c14e"/>` +
      `<rect x="43" y="36.5" width="14" height="9" rx="2" fill="#c8d2e0"/><path d="M47 41 h6" stroke="#6b7a90" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M80 43 L98 30 L94 44 L99 56 L82 49Z" fill="#d9a53a"/>` +
      `<circle cx="22" cy="30" r="7" fill="#5a2a7a"/><circle cx="22" cy="30" r="3" fill="#e8788e"/>` +
      _eyes(56, 11) + _blush(62, 17, "#ff8fa3"),
  },
  {
    id: "viking", label: "Viking", bg: "#8fb8d8",
    svg:
      `<path d="M18 100 Q20 82 50 82 Q80 82 82 100Z" fill="#7a5a3a"/><path d="M30 84 Q50 96 70 84" fill="#e8e8f0" opacity=".9"/>` +
      `<circle cx="50" cy="56" r="28" fill="#f6d3b0"/>` +
      `<path d="M26 62 Q28 90 50 94 Q72 90 74 62 Q66 74 50 74 Q34 74 26 62Z" fill="#d9822b"/>` +
      `<path d="M22 50 Q18 30 50 28 Q82 30 78 50 Q70 42 50 42 Q30 42 22 50Z" fill="#d9822b"/>` +
      `<path d="M20 38 Q22 20 50 18 Q78 20 80 38 L80 44 Q50 34 20 44Z" fill="#a9b4c6"/><rect x="20" y="38" width="60" height="6" fill="#7d8aa0"/>` +
      `<path d="M22 40 Q8 36 10 14 Q18 24 26 30Z M78 40 Q92 36 90 14 Q82 24 74 30Z" fill="#f4ecd8"/>` +
      _eyes(56, 11) + _blush(63, 19) + `<path d="M44 68 Q50 73 56 68" fill="#8a2f3b" stroke="#8a2f3b" stroke-width="1.5" stroke-linecap="round"/>`,
  },
];

const avatarById = (id) => AVATARS.find((a) => a.id === id) || null;

function Avatar({ id, size = 76, fallback }) {
  const a = avatarById(id);
  if (!a) return fallback || null;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={a.label}
      style={{ display: "block", borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
      <rect width="100" height="100" fill={a.bg} />
      <g dangerouslySetInnerHTML={{ __html: a.svg }} />
    </svg>
  );
}

// ---------- Small UI bits ----------
const Card = ({ children, style }) => (
  <div style={{
    background: C.card, border: `1px solid ${C.line}`, borderRadius: 16,
    padding: 18, ...style
  }}>{children}</div>
);

const SectionLabel = ({ children }) => (
  <div style={{
    fontFamily: HELV, fontSize: 11, letterSpacing: 1.5,
    textTransform: "uppercase", color: C.inkSoft, marginBottom: 8, fontWeight: 700
  }}>{children}</div>
);

const Button = ({ children, onClick, variant = "primary", style, disabled }) => {
  const base = {
    fontFamily: HELV, fontWeight: 600, fontSize: 14,
    padding: "10px 16px", borderRadius: 10, border: "none", cursor: disabled ? "default" : "pointer",
    display: "inline-flex", alignItems: "center", gap: 6, opacity: disabled ? 0.5 : 1,
    transition: "transform 0.1s ease",
  };
  const variants = {
    primary: { background: C.ink, color: C.paper },
    gold: { background: C.gold, color: C.ink },
    ghost: { background: "transparent", color: C.ink, border: `1px solid ${C.line}` },
    teal: { background: C.teal, color: "#fff" },
  };
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
      style={{ ...base, ...variants[variant], ...style }}
    >{children}</button>
  );
};

// ---------- Sobriety Chip (signature element) ----------
function SobrietyChip({ days, phase }) {
  const size = 220;
  const r = size / 2;
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <radialGradient id="chipFace" cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#8FBBEE" />
            <stop offset="55%" stopColor={C.gold} />
            <stop offset="100%" stopColor={C.goldDeep} />
          </radialGradient>
        </defs>
        <circle cx={r} cy={r} r={r - 3} fill="url(#chipFace)" stroke={C.goldDeep} strokeWidth="3" />
        <circle cx={r} cy={r} r={r - 16} fill="none" stroke={C.ink} strokeOpacity="0.15" strokeWidth="1.5" strokeDasharray="2 5" />
        <circle cx={r} cy={r} r={r - 26} fill="none" stroke={C.ink} strokeOpacity="0.25" strokeWidth="1.5" />
        <text x="50%" y="40%" textAnchor="middle" fontFamily={HELV} fontSize="44" fontWeight="700" fill={C.ink}>
          {days === null ? "–" : days}
        </text>
        <text x="50%" y="52%" textAnchor="middle" fontFamily={HELV} fontSize="11" letterSpacing="2" fill={C.ink} fillOpacity="0.75">
          {days === null ? "SET YOUR DATE" : "DAYS SOBER"}
        </text>
        {phase != null && (
          <text x="50%" y="68%" textAnchor="middle" fontFamily={HELV} fontSize="16" fontWeight="700" fill={C.ink} letterSpacing="1">
            PHASE {phase}
          </text>
        )}
      </svg>
    </div>
  );
}

// ---------- Tabs ----------
function HomeTab({ profile, counters }) {
  const days = daysSince(profile.soberDate);
  const refl = reflectionForToday();
  const phaseStatus = getPhaseStatus(profile.phaseStart, profile.phaseStartMonth);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ textAlign: "center", background: `linear-gradient(180deg, ${C.card}, ${C.paperDeep})` }}>
        <SectionLabel>Your Chip</SectionLabel>
        <SobrietyChip days={days} phase={phaseStatus ? phaseStatus.phase : null} />
        {profile.soberDate && (
          <div style={{ fontFamily: HELV, fontSize: 13, color: C.inkSoft, marginTop: 4 }}>
            Sober since {new Date(profile.soberDate + "T00:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
          </div>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card style={{ textAlign: "center" }}>
          <div style={{ fontFamily: HELV, fontSize: 30, fontWeight: 700, color: C.teal }}>{counters.aa}</div>
          <div style={{ fontFamily: HELV, fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>CR/AA MEETINGS</div>
        </Card>
        <Card style={{ textAlign: "center" }}>
          <div style={{ fontFamily: HELV, fontSize: 30, fontWeight: 700, color: C.teal }}>{counters.oneOnOne}</div>
          <div style={{ fontFamily: HELV, fontSize: 10.5, color: C.inkSoft, fontWeight: 600, lineHeight: 1.3 }}>IOP/AFTERCARE/MRT</div>
        </Card>
      </div>

      <Card>
        <SectionLabel>Phase Progress</SectionLabel>
        {!phaseStatus ? (
          <div style={{ fontFamily: HELV, fontSize: 13.5, color: C.inkSoft }}>
            Set your starting phase and start month in your Profile to track your phase-up countdown.
          </div>
        ) : phaseStatus.maxed ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Award size={22} color={C.gold} />
            <div style={{ fontFamily: HELV, fontSize: 14.5, color: C.ink, fontWeight: 600 }}>
              You've reached Phase 5 — the final phase.
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div style={{ fontFamily: HELV, fontSize: 26, fontWeight: 700, color: C.teal }}>Phase {phaseStatus.phase}</div>
              <div style={{ fontFamily: HELV, fontSize: 13, color: C.inkSoft }}>
                {phaseStatus.daysUntilNext} days to Phase {phaseStatus.phase + 1}
              </div>
            </div>
            <div style={{ width: "100%", height: 8, borderRadius: 999, background: C.paperDeep, overflow: "hidden" }}>
              <div style={{
                width: `${Math.round((1 - phaseStatus.daysUntilNext / (PHASE_MONTHS * 30.4)) * 100)}%`,
                height: "100%", background: C.gold, borderRadius: 999
              }} />
            </div>
          </div>
        )}
      </Card>

      <Card>
        <SectionLabel>Today's Reflection</SectionLabel>
        <div style={{ fontFamily: HELV, fontSize: 19, fontWeight: 700, color: C.ink, marginBottom: 6 }}>
          {refl.title}
        </div>
        <div style={{ fontFamily: HELV, fontSize: 14.5, color: C.inkSoft, lineHeight: 1.55 }}>
          {refl.body}
        </div>
      </Card>
    </div>
  );
}

function MeetingsTab({ counters, setCounters, fines, setFines, profile }) {
  const [newFine, setNewFine] = useState("");
  const [owedInput, setOwedInput] = useState(fines.totalOwed || "");
  const phaseStatus = getPhaseStatus(profile.phaseStart, profile.phaseStartMonth);
  const currentPhase = phaseStatus ? phaseStatus.phase : null;
  const weekIndex = Math.floor(Date.now() / (7 * DAY_MS));

  // Reset CR/AA phase-total count every time the person phases up
  useEffect(() => {
    if (currentPhase == null) return;
    if (counters.aaResetPhase !== currentPhase) {
      const next = { ...counters, aa: 0, aaResetPhase: currentPhase };
      setCounters(next);
      setJSON("counters:me", next, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPhase]);

  // Reset the "this week" CR/AA count every week
  useEffect(() => {
    if (counters.aaResetWeek !== weekIndex) {
      const next = { ...counters, aaWeek: 0, aaResetWeek: weekIndex };
      setCounters(next);
      setJSON("counters:me", next, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekIndex]);

  const bump = (key, delta) => {
    const next = { ...counters, [key]: Math.max(0, counters[key] + delta) };
    // CR/AA meetings count toward both this week's goal and the phase running total
    if (key === "aa") {
      next.aaWeek = Math.max(0, (counters.aaWeek || 0) + delta);
    }
    setCounters(next);
    setJSON("counters:me", next, false);
  };

  const addPayment = () => {
    const amt = parseFloat(newFine);
    if (!amt || amt <= 0) return;
    const next = { ...fines, paid: fines.paid + amt, log: [...fines.log, { amt, date: new Date().toISOString() }] };
    setFines(next);
    setJSON("fines:me", next, false);
    setNewFine("");
  };

  const saveOwed = () => {
    const amt = parseFloat(owedInput) || 0;
    const next = { ...fines, totalOwed: amt };
    setFines(next);
    setJSON("fines:me", next, false);
  };

  const remaining = Math.max(0, (fines.totalOwed || 0) - fines.paid);
  const lastPayment = fines.log && fines.log.length ? fines.log[fines.log.length - 1].amt : 0;

  const Counter = ({ label, field, icon, goal }) => (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ background: C.teal, color: "#fff", borderRadius: 10, padding: 8, display: "flex" }}>{icon}</div>
          <div>
            <div style={{ fontFamily: HELV, fontWeight: 700, fontSize: 15, color: C.ink }}>{label}</div>
            <div style={{ fontFamily: HELV, fontSize: 22, fontWeight: 700, color: C.teal }}>{counters[field]}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {goal && (
            <div style={{
              fontFamily: HELV, fontSize: 11, fontWeight: 700,
              color: (counters.aaWeek || 0) >= CR_AA_WEEKLY_GOAL ? C.teal : C.inkSoft,
              background: C.paperDeep, borderRadius: 999, padding: "4px 9px", whiteSpace: "nowrap"
            }}>
              WK {counters.aaWeek || 0}/{CR_AA_WEEKLY_GOAL}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => bump(field, -1)} style={{ width: 34, height: 34, borderRadius: 999, border: `1px solid ${C.line}`, background: C.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus size={16} color={C.ink} /></button>
            <button onClick={() => bump(field, 1)} style={{ width: 34, height: 34, borderRadius: 999, border: "none", background: C.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={16} color={C.paper} /></button>
          </div>
        </div>
      </div>
      {goal && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontFamily: HELV, fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>
              Running total toward phase-up goal
            </span>
            <span style={{ fontFamily: HELV, fontSize: 12, color: C.inkSoft }}>
              {counters[field]} / {CR_AA_PHASE_GOAL}
            </span>
          </div>
          <div style={{ width: "100%", height: 7, borderRadius: 999, background: C.paperDeep, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, Math.round((counters[field] / CR_AA_PHASE_GOAL) * 100))}%`, height: "100%", background: C.gold, borderRadius: 999 }} />
          </div>
          <div style={{ fontFamily: HELV, fontSize: 11, color: C.inkSoft, marginTop: 5 }}>
            {currentPhase == null ? "Set your phase in Profile to track this goal." : "Resets automatically each time you phase up."}
          </div>
        </div>
      )}
    </Card>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionLabel>Meeting Log</SectionLabel>
      <Counter label="CR/AA Meetings" field="aa" icon={<Users size={16} />} goal />
      <Counter label="IOP/AFTERCARE/MRT" field="oneOnOne" icon={<User size={16} />} />

      <SectionLabel>Fines &amp; Fees</SectionLabel>
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: HELV, fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>PAID</div>
            <div style={{ fontFamily: HELV, fontSize: 20, fontWeight: 700, color: C.teal }}>${lastPayment.toFixed(2)}</div>
            <div style={{ fontFamily: HELV, fontSize: 10.5, color: C.inkSoft }}>last payment</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: HELV, fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>AMOUNT PAID</div>
            <div style={{ fontFamily: HELV, fontSize: 20, fontWeight: 700, color: C.goldDeep }}>${fines.paid.toFixed(2)}</div>
            <div style={{ fontFamily: HELV, fontSize: 10.5, color: C.inkSoft }}>running total</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: HELV, fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>REMAINING</div>
            <div style={{ fontFamily: HELV, fontSize: 20, fontWeight: 700, color: C.rust }}>${remaining.toFixed(2)}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            type="number" placeholder="Amount paid" value={newFine}
            onChange={(e) => setNewFine(e.target.value)}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, fontFamily: HELV, fontSize: 14 }}
          />
          <Button variant="gold" onClick={addPayment}><DollarSign size={15} />Log</Button>
        </div>
        <details>
          <summary style={{ fontFamily: HELV, fontSize: 13, color: C.inkSoft, cursor: "pointer" }}>Set total amount owed</summary>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              type="number" placeholder="Total owed" value={owedInput}
              onChange={(e) => setOwedInput(e.target.value)}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, fontFamily: HELV, fontSize: 14 }}
            />
            <Button variant="ghost" onClick={saveOwed}><Check size={15} />Save</Button>
          </div>
        </details>
      </Card>

      <SectionLabel>Court Calendar</SectionLabel>
      <CourtCalendar phase={currentPhase} />
    </div>
  );
}

function LiteratureTab() {
  const LinkOut = ({ title, blurb, url }) => (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
      <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: HELV, fontWeight: 700, fontSize: 16, color: C.ink }}>{title}</div>
          <div style={{ fontFamily: HELV, fontSize: 13, color: C.inkSoft }}>{blurb}</div>
        </div>
        <ExternalLink size={18} color={C.teal} />
      </Card>
    </a>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionLabel>The Twelve Steps</SectionLabel>
      <Card>
        {TWELVE_STEPS.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < 11 ? 14 : 0 }}>
            <div style={{
              fontFamily: HELV, fontWeight: 700, color: C.gold,
              fontSize: 14, minWidth: 20
            }}>{String(i + 1).padStart(2, "0")}</div>
            <div style={{ fontFamily: HELV, fontSize: 14, color: C.ink, lineHeight: 1.5 }}>{s}</div>
          </div>
        ))}
        <div style={{ fontFamily: HELV, fontSize: 11, color: C.inkSoft, marginTop: 14, fontStyle: "italic" }}>
          The Twelve Steps reprinted with permission of AA World Services, Inc.
        </div>
      </Card>

      <SectionLabel>Official Literature</SectionLabel>
      <div style={{ fontFamily: HELV, fontSize: 13, color: C.inkSoft, marginTop: -8, marginBottom: 4 }}>
        The Big Book, Living Sober, and Daily Reflections are copyrighted works — full text can't be hosted here. These links go to AA's official sources.
      </div>
      <LinkOut title="Alcoholics Anonymous (Big Book)" blurb="Read online or order · aa.org" url="https://www.aa.org/the-big-book" />
      <LinkOut title="Daily Reflections" blurb="Official daily meditation book · aa.org" url="https://www.aa.org/daily-reflections" />
      <LinkOut title="Living Sober" blurb="Practical sobriety tips · aa.org store" url="https://www.aa.org/living-sober" />
      <LinkOut title="Find a Meeting" blurb="AA meeting guide" url="https://www.aa.org/find-aa" />
    </div>
  );
}


// ---------- Court calendar ----------
const COURT_COLORS = { 2: "#2F6FD6", 3: "#D64545", 4: "#F2B705" };

// Which phases go to court on a given date (Tuesdays only, 9:00 AM)
function courtPhasesFor(date) {
  if (date.getDay() !== 2) return [];
  const nth = Math.ceil(date.getDate() / 7);
  const out = [2];                       // Phase 2: every Tuesday
  if (nth === 1 || nth === 3) out.push(3); // Phase 3: 1st & 3rd Tuesday
  if (nth === 2) out.push(4);              // Phase 4: 2nd Tuesday only
  return out;
}

function courtBackground(phases) {
  if (phases.length === 1) return COURT_COLORS[phases[0]];
  return `linear-gradient(135deg, ${COURT_COLORS[phases[0]]} 50%, ${COURT_COLORS[phases[1]]} 50%)`;
}

function CourtCalendar({ phase }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const lead = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const monthLabel = cursor.toLocaleString("en-US", { month: "long", year: "numeric" });
  const isToday = (d) => d === today.getDate() && m === today.getMonth() && y === today.getFullYear();

  const legend = [
    { p: 2, text: "Phase 2 goes every Tuesday at 9:00 AM" },
    { p: 3, text: "Phase 3 goes the 1st and 3rd Tuesday at 9:00 AM" },
    { p: 4, text: "Phase 4 goes the 2nd Tuesday only, at 9:00 AM" },
  ];
  const navBtn = { width: 34, height: 34, borderRadius: 999, border: `1px solid ${C.line}`, background: C.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {legend.map(({ p, text }) => (
          <div key={p} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: COURT_COLORS[p], flexShrink: 0 }} />
            <span style={{ fontFamily: HELV, fontSize: 13.5, color: C.ink, lineHeight: 1.35 }}>
              {text}
              {phase === p && <b style={{ color: C.goldDeep, marginLeft: 6, fontSize: 11, letterSpacing: 0.5 }}>YOUR PHASE</b>}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button aria-label="Previous month" onClick={() => setCursor(new Date(y, m - 1, 1))} style={navBtn}><ChevronLeft size={16} color={C.ink} /></button>
        <div style={{ fontFamily: HELV, fontWeight: 700, fontSize: 16, color: C.ink }}>{monthLabel}</div>
        <button aria-label="Next month" onClick={() => setCursor(new Date(y, m + 1, 1))} style={navBtn}><ChevronRight size={16} color={C.ink} /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontFamily: HELV, fontSize: 11, fontWeight: 700, color: C.inkSoft, paddingBottom: 2 }}>{d}</div>
        ))}
        {cells.map((d, i) => {
          if (d == null) return <div key={i} />;
          const phases = courtPhasesFor(new Date(y, m, d));
          const court = phases.length > 0;
          return (
            <div key={i} style={{
              aspectRatio: "1 / 1", borderRadius: 8, position: "relative",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: court ? courtBackground(phases) : "#fff",
              border: isToday(d) ? `2px solid ${C.ink}` : `1px solid ${court ? "transparent" : C.line}`,
            }}>
              <span style={{
                fontFamily: HELV, fontSize: 12.5, fontWeight: 700, color: C.ink,
                minWidth: 22, height: 22, borderRadius: 999, lineHeight: "22px", textAlign: "center",
                background: court ? "rgba(255,255,255,0.88)" : "transparent",
              }}>{d}</span>
            </div>
          );
        })}
      </div>

      <div style={{ fontFamily: HELV, fontSize: 11.5, color: C.inkSoft, marginTop: 12, lineHeight: 1.5 }}>
        Split squares mean both phases go that day. Solid blue means Phase 2 only. Your court date or time can change, so always go by what the Judge and staff tell you.
      </div>
    </Card>
  );
}

// ---------- Handbook ----------
function hbText(sec) {
  const parts = [sec.title];
  sec.blocks.forEach((b) => {
    Object.values(b).forEach((v) => {
      if (typeof v === "string") parts.push(v);
      else if (Array.isArray(v)) v.forEach((x) => parts.push(Array.isArray(x) ? x.join(" ") : String(x)));
      else if (v && typeof v === "object") {
        parts.push(v.title || "");
        (v.items || []).forEach((x) => parts.push(Array.isArray(x) ? x.join(" ") : String(x)));
      }
    });
  });
  return parts.join(" ").toLowerCase();
}

function HbBlock({ b }) {
  const body = { fontFamily: HELV, fontSize: 14, color: C.ink, lineHeight: 1.55, margin: "0 0 10px" };
  const chip = { fontFamily: HELV, fontSize: 12.5, color: C.ink, background: C.paperDeep, borderRadius: 999, padding: "3px 10px" };
  if (b.h) return <div style={{ fontFamily: HELV, fontWeight: 700, fontSize: 15, color: C.ink, margin: "14px 0 6px" }}>{b.h}</div>;
  if (b.p) return <p style={body}>{b.p}</p>;
  if (b.strong) return <p style={{ ...body, fontWeight: 700 }}>{b.strong}</p>;
  if (b.intro) return <p style={{ ...body, fontStyle: "italic", color: C.inkSoft }}>{b.intro}</p>;
  if (b.ul) return <ul style={{ ...body, paddingLeft: 20 }}>{b.ul.map((x, i) => <li key={i} style={{ marginBottom: 6 }}>{x}</li>)}</ul>;
  if (b.ol) return <ol style={{ ...body, paddingLeft: 24 }}>{b.ol.map((x, i) => <li key={i} style={{ marginBottom: 8 }}>{x}</li>)}</ol>;
  if (b.note) return <div style={{ background: C.paperDeep, borderRadius: 8, padding: "8px 10px", fontFamily: HELV, fontSize: 12.5, color: C.inkSoft, margin: "0 0 10px", lineHeight: 1.45 }}>{b.note}</div>;
  if (b.terms) return <div>{b.terms.map(([l, t], i) => <p key={i} style={body}><b>{l}:</b> {t}</p>)}</div>;
  if (b.list) return (
    <div style={{ margin: "0 0 14px" }}>
      <div style={{ fontFamily: HELV, fontWeight: 700, fontSize: 13.5, color: C.ink, marginBottom: 6 }}>{b.list.title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{b.list.items.map((x, i) => <span key={i} style={chip}>{x}</span>)}</div>
    </div>
  );
  if (b.pct) return (
    <div style={{ margin: "0 0 14px" }}>
      <div style={{ fontFamily: HELV, fontWeight: 700, fontSize: 13.5, color: C.ink, marginBottom: 6 }}>{b.pct.title}</div>
      {b.pct.items.map(([name, pct], i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 0", borderBottom: `1px solid ${C.line}`, fontFamily: HELV, fontSize: 13.5, color: C.ink }}>
          <span>{name}</span><b>{pct}</b>
        </div>
      ))}
    </div>
  );
  return null;
}

function HandbookTab() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const query = q.trim().toLowerCase();
  const sections = query ? HANDBOOK.filter((sec) => hbText(sec).includes(query)) : HANDBOOK;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontFamily: HELV, fontSize: 12.5, color: C.inkSoft, background: C.paperDeep, padding: "10px 12px", borderRadius: 10, lineHeight: 1.5 }}>
        A copy of your Intervention Court Participant Handbook for easy reference. The court's official handbook and the Judge and staff always come first. Before you take any medication, vitamin or supplement, get approval from the court.
      </div>

      <SectionLabel>Quick Facts</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {HANDBOOK_QUICK.map((f) => (
          <Card key={f.label} style={{ padding: 14 }}>
            <div style={{ fontFamily: HELV, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: C.inkSoft, textTransform: "uppercase" }}>{f.label}</div>
            {f.tel ? (
              <a href={`tel:${f.tel}`} style={{ fontFamily: HELV, fontWeight: 700, fontSize: 20, color: C.teal, textDecoration: "none" }}>{f.value}</a>
            ) : (
              <div style={{ fontFamily: HELV, fontWeight: 700, fontSize: 20, color: C.teal }}>{f.value}</div>
            )}
            <div style={{ fontFamily: HELV, fontSize: 13, color: C.inkSoft, lineHeight: 1.45, marginTop: 2 }}>{f.sub}</div>
          </Card>
        ))}
      </div>

      <SectionLabel>Full Handbook</SectionLabel>
      <div style={{ position: "relative" }}>
        <Search size={16} color={C.inkSoft} style={{ position: "absolute", left: 12, top: 13 }} />
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the handbook (try: curfew, Nyquil, sanctions)"
          style={{ width: "100%", padding: "10px 12px 10px 34px", borderRadius: 10, border: `1px solid ${C.line}`, fontFamily: HELV, fontSize: 14, background: "#fff" }}
        />
      </div>

      {sections.length === 0 && (
        <Card style={{ textAlign: "center", color: C.inkSoft, fontFamily: HELV, fontSize: 13.5 }}>No sections match "{q}".</Card>
      )}

      {sections.map((sec) => {
        const isOpen = query ? true : open === sec.id;
        return (
          <Card key={sec.id} style={{ padding: 0, overflow: "hidden" }}>
            <button
              onClick={() => setOpen(isOpen && !query ? null : sec.id)}
              style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, textAlign: "left" }}
            >
              <div>
                <div style={{ fontFamily: HELV, fontWeight: 700, fontSize: 16, color: C.ink }}>{sec.title}</div>
                <div style={{ fontFamily: HELV, fontSize: 12, color: C.inkSoft }}>Handbook {sec.pages}</div>
              </div>
              <ChevronDown size={18} color={C.inkSoft} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", flexShrink: 0 }} />
            </button>
            {isOpen && (
              <div style={{ padding: "0 16px 14px", borderTop: `1px solid ${C.line}` }}>
                {sec.blocks.map((b, i) => <HbBlock key={i} b={b} />)}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function ProfileTab({ profile, setProfile }) {
  const [editing, setEditing] = useState(!profile.name);
  const [name, setName] = useState(profile.name || "");
  const [soberDate, setSoberDate] = useState(profile.soberDate || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [avatar, setAvatar] = useState(profile.avatar || "");
  const [phaseStart, setPhaseStart] = useState(profile.phaseStart || 2);
  const [phaseStartMonth, setPhaseStartMonth] = useState(profile.phaseStartMonth || "");

  const initials = (profile.name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const save = async () => {
    const next = { name: name.trim() || "Anonymous", soberDate, bio: bio.trim(), avatar, phaseStart: Number(phaseStart), phaseStartMonth };
    setProfile(next);
    await setJSON("profile:me", next, false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <SectionLabel>Edit Profile</SectionLabel>
        <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontFamily: HELV, fontSize: 12, fontWeight: 600, color: C.inkSoft, marginBottom: 4 }}>NAME</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: `1px solid ${C.line}`, fontFamily: HELV, fontSize: 14 }} />
          </div>
          <div>
            <div style={{ fontFamily: HELV, fontSize: 12, fontWeight: 600, color: C.inkSoft, marginBottom: 6 }}>PROFILE PICTURE</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {AVATARS.map((a) => (
                <button key={a.id} type="button" aria-label={a.label} aria-pressed={avatar === a.id}
                  onClick={() => setAvatar(a.id)}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "center" }}>
                  <div style={{ borderRadius: "50%", padding: 2, border: `3px solid ${avatar === a.id ? C.goldDeep : "transparent"}` }}>
                    <Avatar id={a.id} size={48} />
                  </div>
                  <div style={{ fontFamily: HELV, fontSize: 10.5, color: avatar === a.id ? C.goldDeep : C.inkSoft, fontWeight: avatar === a.id ? 700 : 500, marginTop: 2 }}>{a.label}</div>
                </button>
              ))}
            </div>
            {avatar && (
              <button type="button" onClick={() => setAvatar("")}
                style={{ background: "none", border: "none", padding: "8px 0 0", cursor: "pointer", fontFamily: HELV, fontSize: 12, color: C.inkSoft, textDecoration: "underline" }}>
                Use my initials instead
              </button>
            )}
          </div>
          <div>
            <div style={{ fontFamily: HELV, fontSize: 12, fontWeight: 600, color: C.inkSoft, marginBottom: 4 }}>SOBER DATE</div>
            <input type="date" value={soberDate} onChange={e => setSoberDate(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: `1px solid ${C.line}`, fontFamily: HELV, fontSize: 14 }} />
          </div>
          <div>
            <div style={{ fontFamily: HELV, fontSize: 12, fontWeight: 600, color: C.inkSoft, marginBottom: 4 }}>BIO (optional)</div>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: `1px solid ${C.line}`, fontFamily: HELV, fontSize: 14, resize: "none" }} />
          </div>
          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10, marginTop: 2 }}>
            <div style={{ fontFamily: HELV, fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>SELECT YOUR PHASE AND START DATE</div>
            <div style={{ fontFamily: HELV, fontSize: 12, fontWeight: 600, color: C.inkSoft, marginBottom: 4 }}>PHASE</div>
            <select value={phaseStart} onChange={e => setPhaseStart(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: `1px solid ${C.line}`, fontFamily: HELV, fontSize: 14, marginBottom: 10, background: "#fff" }}>
              <option value={2}>Phase 2</option>
              <option value={3}>Phase 3</option>
              <option value={4}>Phase 4</option>
              <option value={5}>Phase 5</option>
            </select>
            <div style={{ fontFamily: HELV, fontSize: 12, fontWeight: 600, color: C.inkSoft, marginBottom: 4 }}>PHASE START MONTH</div>
            <input type="month" value={phaseStartMonth} onChange={e => setPhaseStartMonth(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: `1px solid ${C.line}`, fontFamily: HELV, fontSize: 14 }} />
            <div style={{ fontFamily: HELV, fontSize: 12, color: C.inkSoft, marginTop: 6 }}>
              You phase up every 9 months. We'll count down to your next phase automatically.
            </div>
          </div>
          <Button variant="primary" onClick={save}><Check size={15} />Save Profile</Button>
        </Card>
      </div>
    );
  }

  const days = daysSince(profile.soberDate);
  const phaseStatus = getPhaseStatus(profile.phaseStart, profile.phaseStartMonth);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card style={{ textAlign: "center" }}>
        <div style={{ margin: "0 auto 12px", width: 76, height: 76 }}>
          <Avatar id={profile.avatar} size={76} fallback={
            <div style={{
              width: 76, height: 76, borderRadius: "50%", background: `linear-gradient(135deg, ${C.gold}, ${C.teal})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: HELV, fontSize: 26, fontWeight: 700, color: "#fff"
            }}>{initials}</div>
          } />
        </div>
        <div style={{ fontFamily: HELV, fontSize: 22, fontWeight: 700, color: C.ink }}>{profile.name}</div>
        {profile.bio && <div style={{ fontFamily: HELV, fontSize: 14, color: C.inkSoft, marginTop: 4 }}>{profile.bio}</div>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, color: C.gold }}>
          <Award size={16} />
          <span style={{ fontFamily: HELV, fontSize: 13, fontWeight: 700 }}>
            {days === null ? "No date set" : `${days} days sober`}
          </span>
        </div>
        {phaseStatus && (
          <div style={{ fontFamily: HELV, fontSize: 13, color: C.teal, fontWeight: 700, marginTop: 6 }}>
            Phase {phaseStatus.phase}{!phaseStatus.maxed && ` · ${phaseStatus.daysUntilNext} days to phase up`}
          </div>
        )}
      </Card>
      <button
        aria-label="Edit Profile"
        onClick={() => setEditing(true)}
        style={{
          position: "absolute", left: 16, bottom: 88, width: 32, height: 32, borderRadius: "50%",
          border: `1px solid ${C.line}`, background: C.card, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 6px rgba(19,37,64,0.12)"
        }}
      >
        <Edit2 size={13} color={C.ink} />
      </button>
    </div>
  );
}

function formatTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, "0")} ${period}`;
}

const APPT_TYPES = ["IOP", "MRT", "One-on-One Therapy", "Aftercare", "Other"];

function CalendarTab() {
  const [appts, setAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const emptyForm = { type: "IOP", date: "", time: "", notes: "" };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    (async () => {
      const data = await getJSON("appointments:me", false, []);
      setAppts(data);
      setLoading(false);
    })();
  }, []);

  const persist = async (next) => {
    setAppts(next);
    await setJSON("appointments:me", next, false);
  };

  const startAdd = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const startEdit = (a) => { setForm({ type: a.type, date: a.date, time: a.time || "", notes: a.notes || "" }); setEditingId(a.id); setShowForm(true); };
  const cancelForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };

  const save = async () => {
    if (!form.date) return;
    if (editingId) {
      await persist(appts.map(a => a.id === editingId ? { ...a, ...form } : a));
    } else {
      await persist([...appts, { id: Date.now() + "-" + Math.random().toString(36).slice(2), ...form }]);
    }
    cancelForm();
  };

  const remove = async (id) => {
    await persist(appts.filter(a => a.id !== id));
  };

  const labelStyle = { fontFamily: HELV, fontSize: 12, fontWeight: 600, color: C.inkSoft, marginBottom: 4 };
  const inputStyle = { width: "100%", padding: 10, borderRadius: 10, border: `1px solid ${C.line}`, fontFamily: HELV, fontSize: 14, background: "#fff" };
  const iconBtnStyle = { width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.line}`, background: C.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
  const TYPE_COLORS = { "IOP": C.teal, "MRT": C.gold, "One-on-One Therapy": C.rust, "Aftercare": C.tealDeep, "Other": C.inkSoft };

  const todayStr = new Date().toISOString().slice(0, 10);
  const sorted = [...appts].sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  const upcoming = sorted.filter(a => a.date >= todayStr);
  const past = sorted.filter(a => a.date < todayStr).reverse();

  const ApptCard = ({ a }) => (
    <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ width: 4, borderRadius: 4, background: TYPE_COLORS[a.type] || C.teal }} />
        <div>
          <div style={{ fontFamily: HELV, fontWeight: 700, fontSize: 12, color: TYPE_COLORS[a.type] || C.teal, textTransform: "uppercase", letterSpacing: 0.5 }}>{a.type}</div>
          <div style={{ fontFamily: HELV, fontSize: 16.5, fontWeight: 700, color: C.ink }}>
            {new Date(a.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            {a.time && ` · ${formatTime(a.time)}`}
          </div>
          {a.notes && <div style={{ fontFamily: HELV, fontSize: 13, color: C.inkSoft, marginTop: 3 }}>{a.notes}</div>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button onClick={() => startEdit(a)} style={iconBtnStyle}><Edit2 size={13} color={C.ink} /></button>
        <button onClick={() => remove(a.id)} style={iconBtnStyle}><Trash2 size={13} color={C.rust} /></button>
      </div>
    </Card>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionLabel>Appointment Calendar</SectionLabel>

      {showForm ? (
        <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontFamily: HELV, fontSize: 13, fontWeight: 700, color: C.ink }}>
            {editingId ? "Edit Appointment" : "New Appointment"}
          </div>
          <div>
            <div style={labelStyle}>TYPE</div>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle}>
              {APPT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>DATE</div>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>TIME (optional)</div>
              <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div>
            <div style={labelStyle}>NOTES (optional)</div>
            <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, resize: "none" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" onClick={save}><Check size={14} />Save</Button>
            <Button variant="ghost" onClick={cancelForm}><X size={14} />Cancel</Button>
          </div>
        </Card>
      ) : (
        <Button variant="gold" onClick={startAdd}><Plus size={15} />Add Appointment</Button>
      )}

      {loading && <div style={{ fontFamily: HELV, color: C.inkSoft, textAlign: "center" }}>Loading…</div>}

      {!loading && (
        <>
          <SectionLabel>Upcoming</SectionLabel>
          {upcoming.length === 0 && (
            <Card style={{ textAlign: "center", color: C.inkSoft, fontFamily: HELV, fontSize: 13.5 }}>No upcoming appointments yet.</Card>
          )}
          {upcoming.map(a => <ApptCard key={a.id} a={a} />)}

          {past.length > 0 && (
            <details>
              <summary style={{ fontFamily: HELV, fontSize: 13, color: C.inkSoft, cursor: "pointer", marginTop: 4 }}>
                Past appointments ({past.length})
              </summary>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                {past.map(a => <ApptCard key={a.id} a={a} />)}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

// ---------- App Shell ----------
export default function App() {
  const [tab, setTab] = useState("home");
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState({ name: "", soberDate: "", bio: "", phaseStart: 2, phaseStartMonth: "" });
  const [counters, setCounters] = useState({ aa: 0, oneOnOne: 0, aaWeek: 0 });
  const [fines, setFines] = useState({ paid: 0, totalOwed: 0, log: [] });

  useEffect(() => {
    (async () => {
      const [p, c, f] = await Promise.all([
        getJSON("profile:me", false, { name: "", soberDate: "", bio: "", phaseStart: 2, phaseStartMonth: "" }),
        getJSON("counters:me", false, { aa: 0, oneOnOne: 0, aaWeek: 0 }),
        getJSON("fines:me", false, { paid: 0, totalOwed: 0, log: [] }),
      ]);
      setProfile(p); setCounters(c); setFines(f);
      setReady(true);
    })();
  }, []);

  const tabs = [
    { id: "home", label: "Home", icon: Home },
    { id: "meetings", label: "Meetings", icon: Users },
    { id: "calendar", label: "Calendar", icon: Calendar },
    { id: "literature", label: "Literature", icon: BookOpen },
    { id: "handbook", label: "Handbook", icon: FileText },
    { id: "profile", label: "Profile", icon: User },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.paper, display: "flex", justifyContent: "center" }}>
      <FontLoader />
      <div style={{ width: "100%", maxWidth: 460, minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
        {/* Header */}
        <div style={{ padding: "22px 18px 14px", position: "sticky", top: 0, background: C.paper, zIndex: 5, borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: HELV, fontSize: 11, letterSpacing: 2, color: C.gold, fontWeight: 700 }}>ONE DAY AT A TIME</div>
          <div style={{ fontFamily: HELV, fontSize: 26, fontWeight: 700, color: C.ink }}>The Drug Court App</div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "18px 16px 100px" }}>
          {!ready ? (
            <div style={{ textAlign: "center", color: C.inkSoft, fontFamily: HELV, marginTop: 60 }}>Loading…</div>
          ) : (
            <>
              {tab === "home" && <HomeTab profile={profile} counters={counters} />}
              {tab === "meetings" && <MeetingsTab counters={counters} setCounters={setCounters} fines={fines} setFines={setFines} profile={profile} />}
              {tab === "calendar" && <CalendarTab />}
              {tab === "literature" && <LiteratureTab />}
              {tab === "handbook" && <HandbookTab />}
              {tab === "profile" && <ProfileTab profile={profile} setProfile={setProfile} />}
            </>
          )}
        </div>

        {/* Bottom Nav */}
        <div style={{
          position: "fixed", bottom: 0, width: "100%", maxWidth: 460,
          background: C.ink, display: "flex", justifyContent: "space-around",
          padding: "10px 6px calc(10px + env(safe-area-inset-bottom))", borderTop: `1px solid ${C.tealDeep}`
        }}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              color: tab === id ? C.gold : "#8A96A0", padding: "4px 8px"
            }}>
              <Icon size={20} strokeWidth={tab === id ? 2.4 : 2} />
              <span style={{ fontFamily: HELV, fontSize: 10, fontWeight: 600 }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
