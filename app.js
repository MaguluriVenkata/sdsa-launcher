// Posit Connect. `dev` is the GxP Development server this release publishes to.
// `rsc` is the other live Connect server. Switch `rscTarget` when a content
// item exists there. Each agent's `content` value is the path Connect assigns
// (`content/<guid>/` or a vanity path). A full https URL is also accepted.
const rscServers = {
  dev: "https://rsc-dev.pfizer.com/connect",
  rsc: "https://rsc.pfizer.com/connect",
};
const rscTarget = "dev";

const agents = [
  {
    name: "SpecIQ Assistant",
    stage: "Standards",
    purpose: "Answer questions from the CaPS SharePoint site.",
    status: "Starting",
    owner: "CaPS",
    version: "",
    content: {
      dev: "https://vertexaisearch.cloud.google/us/home/cid/7e7ce1fe-9739-4948-a94a-f06a933bbabb/r/agent/12145014859475878744/session/-?csesidx=1700431895",
      rsc: "https://vertexaisearch.cloud.google/us/home/cid/7e7ce1fe-9739-4948-a94a-f06a933bbabb/r/agent/12145014859475878744/session/-?csesidx=1700431895",
    },
  },
  {
    name: "genTDM",
    stage: "Standards",
    purpose: "Build the trial design model from the protocol, through USDM.",
    status: "Future",
    owner: "Standards",
    version: "0.0.9000",
    content: { dev: "", rsc: "" },
  },
  {
    name: "genCode",
    stage: "Standards",
    purpose: "Turn an SDTM mapping specification into deterministic programs.",
    status: "Future",
    owner: "Standards",
    version: "0.1.0",
    content: { dev: "", rsc: "" },
  },
];

const stages = ["All", "Design", "Plan", "Data", "Analyze", "Report", "Submit"];

const chips = [
  ["Ask SpecIQ Assistant", "Ask SpecIQ Assistant"],
  ["Build a trial design model", "Build the trial design model"],
  ["Generate SDTM programs", "Generate SDTM programs from the mapping spec"],
];

const rules = [
  ["gentdm", "genTDM"],
  ["gen tdm", "genTDM"],
  ["trial design", "genTDM"],
  ["usdm", "genTDM"],
  ["gencode", "genCode"],
  ["gen code", "genCode"],
  ["mapping spec", "genCode"],
  ["sdtm", "genCode"],
  ["program", "genCode"],
  ["protocol", "genTDM"],
  ["speciq", "SpecIQ Assistant"],
  ["spec iq", "SpecIQ Assistant"],
  ["caps", "SpecIQ Assistant"],
  ["vertex", "SpecIQ Assistant"],
];

const runs = [];

const typedExamples = [
  "Build the trial design model from the protocol",
  "Generate SDTM programs from the mapping spec",
  "Ask SpecIQ about an SDTM mapping",
];

const docs = [
  [
    "Validation pack",
    "Intended use, version, and validation status for each agent on the main list.",
  ],
  ["Training", "Short guides for the agents on this page."],
  [
    "AI use policy",
    "What may be sent to an agent, and what stays in the study record.",
  ],
];

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const byName = new Map(agents.map((agent) => [agent.name, agent]));

const $ = (selector) => document.querySelector(selector);
const askInput = $("#ask-input");
const matchEl = $("#match");
const gridEl = $("#agent-grid");
const stagesEl = $("#stages");
const betaInput = $("#beta");
const noteEl = $("#agents-note");
const sheet = $("#sheet");
const palette = $("#palette");
const paletteInput = $("#palette-input");
const paletteList = $("#palette-list");
const toast = $("#toast");

let stage = "All";
let pending = null;
let toastTimer = 0;
let paletteIndex = 0;
let paletteItems = [];
let rejectNext = false;

const arrow =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function agentByName(name) {
  const agent = byName.get(name);
  if (!agent) throw new Error(`Unknown agent: ${name}`);
  return agent;
}

function launchUrl(agent) {
  const path = (agent.content && agent.content[rscTarget]) || "";
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const base = rscServers[rscTarget].replace(/\/$/, "");
  return `${base}/${String(path).replace(/^\//, "")}`;
}

function launchHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function versionLabel(agent) {
  return agent.version ? `v${agent.version}` : "";
}

function opensOnLabel(url) {
  if (!url) return "This page, until the address is set";
  const host = launchHost(url);
  if (host.endsWith("rsc-dev.pfizer.com")) return "RSC development";
  if (host.endsWith("pfizer.com")) return "rsc.pfizer.com";
  if (host.includes("vertexaisearch")) return "Vertex AI Search";
  return host || "RSC development";
}

function initials(name) {
  const words = name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^A-Za-z ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function matchQuery(query) {
  const q = query.toLowerCase();
  for (const [key, name] of rules) {
    if (q.includes(key)) return agentByName(name);
  }
  return null;
}

function isFuture(agent) {
  return agent.status === "Future";
}

function statusClass(status) {
  if (status === "Validated") return "validated";
  if (status === "Beta") return "beta";
  if (status === "Future") return "future";
  return "gxp";
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function statusPill(agent) {
  return el("span", `status ${statusClass(agent.status)}`, agent.status);
}

function tile(agent, extra = "") {
  return el("span", `tile ${extra}`.trim(), initials(agent.name));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3400);
}

/* Confirm sheet */

function confirmLaunch(agent, mode, study) {
  const url = isFuture(agent) ? "" : launchUrl(agent);
  pending = { agent, mode, study, url };
  $("#sheet-confirm").hidden = isFuture(agent);
  $("#sheet-tile").textContent = initials(agent.name);
  $("#sheet-kicker").textContent = isFuture(agent)
    ? "Future release"
    : mode === "resume"
      ? `Resume on ${study}`
      : "Confirm launch";
  $("#sheet-title").textContent = agent.name;
  $("#sheet-body").textContent = agent.purpose;
  const onRsc = launchHost(url).endsWith("pfizer.com");
  $("#sheet-confirm").textContent = !url
    ? mode === "resume"
      ? "Resume"
      : "Open agent"
    : onRsc
      ? mode === "resume"
        ? "Resume on RSC"
        : "Open on RSC"
      : mode === "resume"
        ? "Resume"
        : "Open agent";

  const facts = $("#sheet-facts");
  facts.replaceChildren();
  for (const [label, value] of [
    ["Status", agent.status],
    ["Version", agent.version ? `v${agent.version}` : "Hosted"],
    ["Stage", agent.stage],
    ["Owner", agent.owner],
    ["Opens on", isFuture(agent) ? "A later release" : opensOnLabel(url)],
  ]) {
    const row = el("div");
    row.append(el("dt", null, label), el("dd", null, value));
    facts.append(row);
  }
  if (palette.open) palette.close();
  sheet.showModal();
}

sheet.addEventListener("close", () => {
  if (sheet.returnValue !== "confirm" || !pending) {
    pending = null;
    return;
  }
  const { agent, mode, study, url } = pending;
  pending = null;
  if (isFuture(agent)) return;
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
    const place = opensOnLabel(url);
    showToast(place.startsWith("RSC") || place.includes("pfizer") ? `Opening ${agent.name} on RSC` : `Opening ${agent.name}`);
    return;
  }
  const where = study ? ` on ${study}` : "";
  const verb = mode === "resume" ? "Resumed" : "Launch recorded";
  const version = versionLabel(agent);
  showToast(`${verb} · ${agent.name}${version ? ` ${version}` : ""}${where}`);
});

/* Hero */

function renderEyebrow() {
  $("#eyebrow-text").textContent = "SpecIQ Assistant is open. genTDM and genCode come later.";
}

function renderChips() {
  const root = $("#chips");
  for (const [label, query] of chips) {
    const button = el("button", "chip", label);
    button.type = "button";
    button.addEventListener("click", () => {
      askInput.value = query;
      stopTyping();
      renderMatch(query);
    });
    root.append(button);
  }
}

function renderMatch(query) {
  matchEl.replaceChildren();
  const trimmed = query.trim();
  if (!trimmed) return;

  const agent = rejectNext ? null : matchQuery(trimmed);
  rejectNext = false;
  const card = el("div", "match");

  if (!agent) {
    const copy = el("div", "m-copy");
    copy.append(el("p", "m-label", "No confident match"));
    copy.append(el("h3", null, "Pick it from the catalog"));
    copy.append(el("p", null, "Launcher won't guess. Choose the agent whose intended use fits the study."));
    const actions = el("div", "m-actions");
    const browse = el("button", "btn light", "Browse agents");
    browse.type = "button";
    browse.addEventListener("click", () => $("#agents").scrollIntoView({ block: "start" }));
    actions.append(browse);
    card.append(copy, actions);
    matchEl.append(card);
    return;
  }

  const copy = el("div", "m-copy");
  copy.append(el("p", "m-label", "Matched agent"));
  const title = el("h3", null, agent.name);
  title.append(statusPill(agent));
  copy.append(title);
  const version = versionLabel(agent);
  let line = `${agent.purpose}${version ? ` ${version}` : ""} · ${agent.owner}`;
  if (agent.status === "Beta") line += " · Beta, hidden from the main list";
  if (isFuture(agent)) line += " · Future release. It does not open from this page yet.";
  copy.append(el("p", null, line));

  const actions = el("div", "m-actions");
  const other = el("button", "btn glass", "Not this one");
  other.type = "button";
  other.addEventListener("click", () => {
    rejectNext = true;
    renderMatch(trimmed);
  });
  actions.append(other);
  if (!isFuture(agent)) {
    const open = el("button", "btn light", "Open");
    open.type = "button";
    open.addEventListener("click", () => confirmLaunch(agent, "open"));
    actions.append(open);
  }

  card.append(tile(agent, "alt"), copy, actions);
  matchEl.append(card);
}

let typingTimer = 0;
let typingStopped = false;

function stopTyping() {
  typingStopped = true;
  window.clearTimeout(typingTimer);
  askInput.placeholder = "Describe the task";
}

function startTyping() {
  if (reduceMotion) {
    askInput.placeholder = typedExamples[0];
    return;
  }
  let example = 0;
  let index = 0;
  let deleting = false;

  const step = () => {
    if (typingStopped) return;
    const text = typedExamples[example];
    if (!deleting) {
      index += 1;
      askInput.placeholder = text.slice(0, index);
      if (index === text.length) {
        deleting = true;
        typingTimer = window.setTimeout(step, 1800);
        return;
      }
      typingTimer = window.setTimeout(step, 45);
    } else {
      index -= 1;
      askInput.placeholder = text.slice(0, index) || " ";
      if (index === 0) {
        deleting = false;
        example = (example + 1) % typedExamples.length;
        typingTimer = window.setTimeout(step, 300);
        return;
      }
      typingTimer = window.setTimeout(step, 22);
    }
  };
  typingTimer = window.setTimeout(step, 700);
}

function setupHeroVideo() {
  const video = $("#hero-video");
  const fallback = $("#console");
  video.addEventListener("loadeddata", () => {
    video.hidden = false;
    fallback.hidden = true;
    if (reduceMotion) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  });
  video.load();
}

/* Continue */

function renderContinue() {
  const root = $("#continue-list");
  const section = $("#continue");
  const navLink = document.querySelector('a[href="#continue"]');
  const active = runs.filter((run) => !isFuture(agentByName(run.name)));
  section.hidden = active.length === 0;
  if (navLink) navLink.hidden = active.length === 0;
  root.replaceChildren();
  for (const run of active) {
    const agent = agentByName(run.name);
    const card = el("article", "run reveal");

    const top = el("div", "run-top");
    const names = el("div");
    names.append(el("div", "study", run.study), el("h3", null, run.name));
    top.append(tile(agent), names);
    card.append(top);
    card.append(el("p", "detail", run.detail));

    if (run.progress) {
      const bar = el("div", "run-bar");
      bar.setAttribute("role", "meter");
      bar.setAttribute("aria-label", `${run.name} progress`);
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", "100");
      bar.setAttribute("aria-valuenow", String(run.progress));
      const fill = el("span");
      fill.style.width = `${run.progress}%`;
      bar.append(fill);
      card.append(bar);
    }

    const foot = el("div", "run-foot");
    foot.append(el("span", "when", run.when));
    const button = el("button", run.current ? "btn primary" : "btn ghost", "Resume");
    button.type = "button";
    button.addEventListener("click", () => confirmLaunch(agent, "resume", run.study));
    foot.append(button);
    card.append(foot);
    root.append(card);
  }
}

/* Catalog */

function visible(stageName) {
  return agents.filter((agent) => {
    if (!betaInput.checked && agent.status === "Beta") return false;
    if (stageName !== "All" && agent.stage !== stageName) return false;
    return true;
  });
}

function renderStages() {
  stagesEl.replaceChildren();
  for (const name of stages) {
    const button = el("button", "stage");
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", name === stage ? "true" : "false");
    button.append(el("span", null, name), el("span", "count", String(visible(name).length)));
    button.addEventListener("click", () => {
      stage = name;
      renderStages();
      renderAgents();
    });
    stagesEl.append(button);
  }
}

function renderAgents() {
  const rows = visible(stage);
  noteEl.textContent = "SpecIQ Assistant is the agent you can open. genTDM and genCode are future releases.";

  gridEl.replaceChildren();
  if (rows.length === 0) {
    gridEl.append(el("p", "empty", "Nothing in this stage yet. Choose another stage."));
    return;
  }

  rows.forEach((agent, i) => {
    const card = el("article", isFuture(agent) ? "agent future" : agent.status === "Beta" ? "agent beta" : "agent");
    card.style.animationDelay = `${Math.min(i, 8) * 40}ms`;

    const top = el("div", "agent-top");
    top.append(tile(agent), statusPill(agent));
    card.append(top);

    const copy = el("div");
    copy.append(el("h3", null, agent.name), el("p", "purpose", agent.purpose));
    card.append(copy);

    const foot = el("div", "agent-foot");
    const meta = [agent.stage, versionLabel(agent), agent.owner].filter(Boolean).join(" · ");
    foot.append(el("span", "meta", meta));
    if (isFuture(agent)) {
      foot.append(el("span", "future-label", "Future release"));
    } else {
      const open = el("button", "open-link");
      open.type = "button";
      open.innerHTML = `Open ${arrow}`;
      open.setAttribute("aria-label", `Open ${agent.name}`);
      open.addEventListener("click", () => confirmLaunch(agent, "open"));
      foot.append(open);
    }
    card.append(foot);

    gridEl.append(card);
  });
}

/* Command palette */

function openPalette() {
  paletteInput.value = "";
  renderPalette();
  palette.showModal();
  paletteInput.focus();
}

function renderPalette() {
  const q = paletteInput.value.trim().toLowerCase();
  paletteItems = agents.filter(
    (agent) =>
      !q ||
      agent.name.toLowerCase().includes(q) ||
      agent.purpose.toLowerCase().includes(q) ||
      agent.stage.toLowerCase().includes(q),
  );
  const matched = q ? matchQuery(q) : null;
  if (matched) {
    paletteItems = [matched, ...paletteItems.filter((agent) => agent !== matched)];
  }
  paletteIndex = 0;
  paletteList.replaceChildren();

  if (paletteItems.length === 0) {
    paletteList.append(el("li", "p-empty", "No agent matches that. Try genTDM or genCode."));
    return;
  }

  paletteItems.forEach((agent, i) => {
    const item = el("li");
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", i === paletteIndex ? "true" : "false");
    const copy = el("div", "p-copy");
    copy.append(el("strong", null, agent.name), el("span", "p-sub", agent.purpose));
    item.append(tile(agent), copy, statusPill(agent));
    item.addEventListener("mouseenter", () => selectPalette(i));
    item.addEventListener("click", () => confirmLaunch(agent, "open"));
    paletteList.append(item);
  });
}

function selectPalette(i) {
  const items = paletteList.querySelectorAll("li[role=option]");
  if (!items.length) return;
  paletteIndex = (i + items.length) % items.length;
  items.forEach((item, n) => item.setAttribute("aria-selected", n === paletteIndex ? "true" : "false"));
  items[paletteIndex].scrollIntoView({ block: "nearest" });
}

paletteInput.addEventListener("input", renderPalette);
paletteInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    selectPalette(paletteIndex + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    selectPalette(paletteIndex - 1);
  } else if (event.key === "Enter" && paletteItems[paletteIndex]) {
    event.preventDefault();
    confirmLaunch(paletteItems[paletteIndex], "open");
  }
});
palette.addEventListener("click", (event) => {
  if (event.target === palette) palette.close();
});

/* Footer */

function renderFooter() {
  const nav = $("#foot-nav");
  const note = $("#foot-note");
  for (const [label, text] of docs) {
    const button = el("button", null, label);
    button.type = "button";
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      nav.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
      button.setAttribute("aria-pressed", "true");
      note.hidden = false;
      note.textContent = text;
    });
    nav.append(button);
  }
}

/* Page behavior */

function setupNav() {
  const nav = $("#nav");
  const hero = $(".hero");
  const update = () => {
    const pastHero = window.scrollY > hero.offsetHeight - 140;
    nav.classList.toggle("scrolled", pastHero);
    nav.classList.toggle("lifted", !pastHero && window.scrollY > 8);
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
}

function setupReveal() {
  const items = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("in"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.12 },
  );
  items.forEach((item, i) => {
    item.style.transitionDelay = `${Math.min(i, 6) * 60}ms`;
    observer.observe(item);
  });
}

$("#ask-form").addEventListener("submit", (event) => {
  event.preventDefault();
  stopTyping();
  renderMatch(askInput.value);
});

askInput.addEventListener("focus", stopTyping);
$("#open-palette").addEventListener("click", openPalette);

betaInput.addEventListener("change", () => {
  renderStages();
  renderAgents();
});

window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (palette.open) palette.close();
    else openPalette();
  }
});

renderEyebrow();
renderChips();
renderContinue();
renderStages();
renderAgents();
renderFooter();
setupHeroVideo();
setupNav();
setupReveal();
startTyping();

