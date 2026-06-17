/* HabitForge — client-side habit tracker with streaks + heatmap. localStorage only. */
const $ = (id) => document.getElementById(id);
const STORE = "habitforge.v1";
const COLORS = ["#00e5ff", "#ff2e97", "#00ffa3", "#9d4eff", "#ffb020", "#ff6b35", "#4ade80", "#60a5fa"];
const WEEKS = 53;

let habits = load();
let newColor = COLORS[0];

// ---- date helpers (local time) ----
function dstr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function today() { return dstr(new Date()); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

// ---- persistence ----
function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch (_) { return []; }
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(habits)); } catch (_) {} }

// ---- model ----
function addHabit(name, color) {
  habits.push({ id: "h" + Date.now() + Math.floor(performance.now()), name, color, done: {} });
  save(); render();
}
function deleteHabit(id) {
  const h = habits.find((x) => x.id === id);
  if (h && confirm(`Delete "${h.name}" and its history?`)) { habits = habits.filter((x) => x.id !== id); save(); render(); }
}
function toggle(id, day) {
  const h = habits.find((x) => x.id === id); if (!h) return;
  if (h.done[day]) delete h.done[day]; else h.done[day] = 1;
  save(); render();
}

// ---- streaks & stats ----
function currentStreak(h) {
  let n = 0, d = new Date();
  // allow today not-yet-done: start counting from today if done, else from yesterday
  if (!h.done[dstr(d)]) d = addDays(d, -1);
  while (h.done[dstr(d)]) { n++; d = addDays(d, -1); }
  return n;
}
function longestStreak(h) {
  const days = Object.keys(h.done).sort();
  let best = 0, run = 0, prev = null;
  for (const ds of days) {
    if (prev && dstr(addDays(new Date(prev), 1)) === ds) run++; else run = 1;
    best = Math.max(best, run); prev = ds;
  }
  return best;
}
function totalDone(h) { return Object.keys(h.done).length; }

// ---- rendering ----
function render() {
  renderStats();
  const box = $("habits");
  box.innerHTML = "";
  $("empty").hidden = habits.length > 0;
  habits.forEach((h) => box.appendChild(habitCard(h)));
}

function renderStats() {
  const total = habits.length;
  const doneToday = habits.filter((h) => h.done[today()]).length;
  const best = habits.reduce((m, h) => Math.max(m, currentStreak(h)), 0);
  const checks = habits.reduce((s, h) => s + totalDone(h), 0);
  const data = [
    { num: total, lbl: "Habits", c: "var(--cyan)" },
    { num: `${doneToday}/${total}`, lbl: "Today", c: "var(--green)" },
    { num: best + "🔥", lbl: "Best streak", c: "var(--amber)" },
    { num: checks, lbl: "Check-ins", c: "var(--magenta)" },
  ];
  $("stats").innerHTML = data.map((s) =>
    `<div class="stat"><div class="num" style="color:${s.c}">${s.num}</div><div class="lbl">${s.lbl}</div></div>`).join("");
}

function habitCard(h) {
  const el = document.createElement("div");
  el.className = "habit";
  const doneTodayFlag = !!h.done[today()];
  const cs = currentStreak(h), ls = longestStreak(h);
  el.innerHTML = `
    <div class="habit-top">
      <span class="dot" style="background:${h.color}"></span>
      <span class="habit-name">${escapeHtml(h.name)}</span>
      <span class="streak">🔥 <b>${cs}</b> day${cs === 1 ? "" : "s"} · best <b>${ls}</b> · ${totalDone(h)} total</span>
      <button class="today-btn ${doneTodayFlag ? "done" : ""}" data-toggle-today style="${doneTodayFlag ? `background:${h.color}` : ""}">
        ${doneTodayFlag ? "✓ Done today" : "Mark today"}
      </button>
      <button class="del-btn" data-del title="Delete">🗑</button>
    </div>
    <div class="heatmap-wrap"><div class="heatmap"></div></div>
    <div class="heat-legend">Less
      <span class="cell" style="background:var(--surface-2)"></span>
      <span class="cell" style="background:${h.color}"></span>More</div>`;

  el.querySelector("[data-toggle-today]").addEventListener("click", () => toggle(h.id, today()));
  el.querySelector("[data-del]").addEventListener("click", () => deleteHabit(h.id));
  el.querySelector(".heatmap").appendChild(buildHeatmap(h));
  return el;
}

function buildHeatmap(h) {
  const frag = document.createDocumentFragment();
  // grid ends on the current week's Saturday so today is always included
  const last = addDays(new Date(), 6 - new Date().getDay()); // Saturday this week
  const start = addDays(last, -(WEEKS * 7 - 1));              // Sunday, WEEKS ago
  const todayStr = today();
  let cur = new Date(start);
  const totalCells = WEEKS * 7;
  for (let i = 0; i < totalCells; i++) {
    const ds = dstr(cur);
    const cell = document.createElement("div");
    cell.className = "cell";
    const future = ds > todayStr;
    if (future) cell.classList.add("future");
    else if (h.done[ds]) { cell.classList.add("done"); cell.style.background = h.color; }
    cell.title = ds + (h.done[ds] ? " ✓" : "");
    if (!future) cell.addEventListener("click", () => toggle(h.id, ds));
    frag.appendChild(cell);
    cur = addDays(cur, 1);
  }
  return frag;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// ---- add form ----
function buildSwatches() {
  $("color-swatches").innerHTML = COLORS.map((c, i) =>
    `<span class="swatch ${i === 0 ? "active" : ""}" data-color="${c}" style="background:${c}"></span>`).join("");
  $("color-swatches").addEventListener("click", (e) => {
    const c = e.target.getAttribute("data-color"); if (!c) return;
    newColor = c;
    document.querySelectorAll(".swatch").forEach((s) => s.classList.toggle("active", s.getAttribute("data-color") === c));
  });
}
function openForm(open) {
  $("add-form").hidden = !open;
  if (open) { $("habit-name").value = ""; $("habit-name").focus(); }
}

// ---- export / import ----
function exportData() {
  const blob = new Blob([JSON.stringify(habits, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "habitforge-backup.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (Array.isArray(data)) { habits = data; save(); render(); }
      else alert("That doesn't look like a HabitForge backup.");
    } catch (_) { alert("Couldn't read that file."); }
  };
  r.readAsText(file);
}

// ---- socials ----
function renderSocials() {
  const SOCIALS = {
    github: "https://github.com/aashishbharti04",
    linkedin: "https://www.linkedin.com/in/aashana1012",
    instagram: "https://www.instagram.com/asurwave1012",
    youtube: "https://www.youtube.com/@CodeWithAsur",
    email: "corerankdigital@gmail.com",
  };
  const ICONS = {
    github: '<path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.75.4-1.27.73-1.56-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.2-3.1-.12-.3-.52-1.46.11-3.05 0 0 .98-.31 3.2 1.18a11.1 11.1 0 0 1 5.83 0c2.22-1.5 3.2-1.18 3.2-1.18.63 1.59.23 2.75.11 3.05.75.81 1.2 1.84 1.2 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z"/>',
    linkedin: '<path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.8 0 0 .77 0 1.73v20.54C0 23.23.8 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"/>',
    instagram: '<path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16ZM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.12 1.38C1.35 2.67.94 3.34.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.8.72 1.47 1.38 2.13.66.66 1.33 1.07 2.12 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.12A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.41-10.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88Z"/>',
    youtube: '<path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z"/>',
    email: '<path d="M22 4H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4.24-10 6.25L2 8.24V6l10 6.25L22 6v2.24Z"/>',
  };
  $("socials").innerHTML = Object.entries(SOCIALS).filter(([, u]) => u).map(([k, u]) => {
    const href = k === "email" ? `mailto:${u}` : u;
    return `<a class="social" href="${href}" target="_blank" rel="noopener" aria-label="${k}" title="${k}"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">${ICONS[k]}</svg></a>`;
  }).join("");
}

// ---- wiring ----
$("add-btn").addEventListener("click", () => openForm(true));
$("cancel-habit").addEventListener("click", () => openForm(false));
$("create-habit").addEventListener("click", () => {
  const name = $("habit-name").value.trim();
  if (!name) { $("habit-name").focus(); return; }
  addHabit(name, newColor); openForm(false);
});
$("habit-name").addEventListener("keydown", (e) => { if (e.key === "Enter") $("create-habit").click(); });
$("export-btn").addEventListener("click", (e) => { e.preventDefault(); exportData(); });
$("import-btn").addEventListener("click", (e) => { e.preventDefault(); $("import-file").click(); });
$("import-file").addEventListener("change", (e) => { if (e.target.files[0]) importData(e.target.files[0]); });

// init
buildSwatches();
renderSocials();
render();
$("year").textContent = "2026";
