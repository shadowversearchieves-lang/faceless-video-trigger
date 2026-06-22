"use strict";

const DEFAULTS = {
  owner: "shadowversearchieves-lang",
  repo: "faceless-video-pipeline",
  workflow: "auto-video.yml",
  ref: "master",
  token: "",
};
const KEY = "vt-config";

const $ = (id) => document.getElementById(id);
const cfg = () => ({ ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") });

function saveCfg(c) { localStorage.setItem(KEY, JSON.stringify(c)); }

function gh(path, opts = {}) {
  const c = cfg();
  return fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${c.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opts.headers || {}),
    },
  });
}

function setStatus(msg, kind = "") {
  const el = $("status");
  el.textContent = msg;
  el.className = "status " + kind;
}

let selectedFormat = "shorts";

async function trigger() {
  const c = cfg();
  if (!c.token) { openSettings(); return setStatus("Add a GitHub token first.", "err"); }
  const topic = $("topic").value.trim();
  const trending = $("trending").checked;
  const inputs = { format: selectedFormat, mode: trending ? "trending" : "evergreen" };
  if (topic) inputs.topic = topic;
  $("goBtn").disabled = true;
  setStatus(`Triggering ${selectedFormat}${trending && !topic ? " · trending" : ""}…`);
  try {
    const res = await gh(
      `/repos/${c.owner}/${c.repo}/actions/workflows/${c.workflow}/dispatches`,
      { method: "POST", body: JSON.stringify({ ref: c.ref, inputs }) }
    );
    if (res.status === 204) {
      setStatus("✓ Triggered! A new video is being built (~15 min).", "ok");
      $("topic").value = "";
      setTimeout(loadRuns, 2500);
    } else {
      const t = await res.text();
      setStatus(`Failed (${res.status}): ${t.slice(0, 160)}`, "err");
    }
  } catch (e) {
    setStatus("Network error: " + e.message, "err");
  } finally {
    $("goBtn").disabled = false;
  }
}

function ago(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

async function loadRuns() {
  const c = cfg();
  const ul = $("runs");
  if (!c.token) { ul.innerHTML = '<li class="muted">Add a token in ⚙️ settings.</li>'; return; }
  try {
    const res = await gh(`/repos/${c.owner}/${c.repo}/actions/runs?per_page=8`);
    if (!res.ok) { ul.innerHTML = `<li class="muted">Error ${res.status}</li>`; return; }
    const data = await res.json();
    const runs = (data.workflow_runs || []).filter((r) => r.name === "Auto faceless video");
    if (!runs.length) { ul.innerHTML = '<li class="muted">No runs yet.</li>'; return; }
    ul.innerHTML = runs.map((r) => {
      const state = r.status === "completed" ? r.conclusion : r.status;
      return `<li>
        <span class="dot ${state}"></span>
        <a href="${r.html_url}" target="_blank" rel="noopener">
          ${state}<div class="when">${r.event} · ${ago(r.created_at)}</div>
        </a></li>`;
    }).join("");
  } catch (e) {
    ul.innerHTML = `<li class="muted">${e.message}</li>`;
  }
}

async function loadCovers() {
  const c = cfg();
  const ul = $("covers");
  if (!c.token) { ul.innerHTML = '<li class="muted">Add a token in ⚙️ settings.</li>'; return; }
  try {
    const res = await gh(`/repos/${c.owner}/${c.repo}/contents/covers.json`,
                         { headers: { Accept: "application/vnd.github.raw" } });
    if (res.status === 404) { ul.innerHTML = '<li class="muted">No covers yet.</li>'; return; }
    if (!res.ok) { ul.innerHTML = `<li class="muted">Error ${res.status}</li>`; return; }
    const data = await res.json();
    const esc = (t) => (t || "").replace(/[&<>]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[x]));
    ul.innerHTML = data.slice().reverse().map((c2) =>
      `<li><span>${esc(c2.title.slice(0, 30))}</span>
        <a href="${c2.url}" target="_blank" rel="noopener" download class="dlbtn">⬇ 9:16</a></li>`
    ).join("") || '<li class="muted">No covers yet.</li>';
  } catch (e) {
    ul.innerHTML = `<li class="muted">${e.message}</li>`;
  }
}

function openSettings() {
  const c = cfg();
  $("cfgToken").value = c.token;
  $("cfgOwner").value = c.owner;
  $("cfgRepo").value = c.repo;
  $("cfgWorkflow").value = c.workflow;
  $("cfgRef").value = c.ref;
  $("settings").showModal();
}

document.querySelectorAll(".seg-btn").forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll(".seg-btn").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    selectedFormat = b.dataset.fmt;
  };
});

$("goBtn").onclick = trigger;
$("refreshBtn").onclick = loadRuns;
$("coversBtn").onclick = loadCovers;
$("settingsBtn").onclick = openSettings;
$("saveCfg").onclick = () => {
  saveCfg({
    token: $("cfgToken").value.trim(),
    owner: $("cfgOwner").value.trim() || DEFAULTS.owner,
    repo: $("cfgRepo").value.trim() || DEFAULTS.repo,
    workflow: $("cfgWorkflow").value.trim() || DEFAULTS.workflow,
    ref: $("cfgRef").value.trim() || DEFAULTS.ref,
  });
  setTimeout(loadRuns, 200);
};

loadRuns();
loadCovers();
setInterval(loadRuns, 20000); // auto-refresh status
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
