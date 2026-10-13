const port = chrome.runtime.connect({ name: "listensub-page" });
const $ = (id) => document.getElementById(id);
const select = $("video-select");
let state = null;
let tabs = [];
let follow = true;
let stateReceivedAt = 0;
let renderedCaption = "";
let controlStatus = "";
let manualCues = [];
let manualVideoId = localStorage.getItem("listensub-manual-video") || null;
$("transcript-input").value = localStorage.getItem("listensub-transcript") || "";

port.onDisconnect.addListener(() => setTimeout(() => location.reload(), 800));

function fmt(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function parseTime(value) {
  const parts = value.trim().replace(",", ".").split(":");
  if (parts.length < 2 || parts.length > 3) return NaN;
  const seconds = Number(parts.pop());
  const minutes = Number(parts.pop());
  const hours = parts.length ? Number(parts.pop()) : 0;
  if (![seconds, minutes, hours].every(Number.isFinite)) return NaN;
  return hours * 3600 + minutes * 60 + seconds;
}

function parseTranscript(source) {
  const cues = [];
  const blocks = source.replace(/\r/g, "").split(/\n\s*\n/);
  const stamp = String.raw`(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?`;
  const arrow = new RegExp(`^\\s*(${stamp})\\s*-->\\s*(${stamp})`, "i");
  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim().replace(/^\*+|\*+$/g, "")).filter(Boolean);
    if (!lines.length || /^(WEBVTT|NOTE|\d+)$/i.test(lines[0])) continue;
    const arrowIndex = lines.findIndex((line) => arrow.test(line));
    if (arrowIndex >= 0) {
      const match = lines[arrowIndex].match(arrow);
      const text = lines.slice(arrowIndex + 1).join(" ").replace(/<[^>]*>/g, "").trim();
      const start = parseTime(match[1]), end = parseTime(match[2]);
      if (text && Number.isFinite(start)) cues.push({ start, end: Number.isFinite(end) ? end : null, text });
      continue;
    }
    for (const line of lines) {
      // Accept both plain timestamps and the common [HH:MM:SS] transcript style.
      const match = line.match(new RegExp(`^\\s*\\[?(${stamp})\\]?\\s*(.*)$`));
      if (!match) continue;
      const text = match[2].replace(/^[-–—]\s*/, "").replace(/<[^>]*>/g, "").trim();
      const start = parseTime(match[1]);
      if (text && Number.isFinite(start)) cues.push({ start, end: null, text });
    }
  }
  cues.sort((a, b) => a.start - b.start);
  return cues.filter((cue, index) => index === 0 || cue.start !== cues[index - 1].start);
}

manualCues = parseTranscript($("transcript-input").value);

function manualIndexAt(time) {
  let lo = 0, hi = manualCues.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (manualCues[mid].start <= time) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
}

function manualAt(time) {
  const found = manualIndexAt(time);
  if (found < 0) return null;
  const cue = manualCues[found];
  const next = manualCues[found + 1];
  if (cue.end != null && time > cue.end || next && time >= next.start) return null;
  return { caption: cue.text, previous: manualCues[found - 1]?.text || "", next: next?.text || "" };
}

function captionMessage(connected) {
  if (!connected) return tabs.length ? "Waiting for the selected YouTube tab to reconnect." : "Open a YouTube video in a tab, then connect ListenSub.";
  if (manualCues.length && manualVideoId === state.videoId) return manualAt(displayTime())?.caption || "No pasted caption at this timestamp.";
  if (manualCues.length && manualVideoId && manualVideoId !== state.videoId) return "The pasted transcript is saved for a different video.";
  return "Paste a timestamped transcript below. ListenSub will follow the current YouTube playback time.";
}

function displayTime() {
  if (!state) return 0;
  const elapsed = !state.paused ? (performance.now() - stateReceivedAt) / 1000 * (state.playbackRate || 1) : 0;
  return state.currentTime + elapsed;
}

function render() {
  const connected = Boolean(state && Date.now() - state.updatedAt < 5000);
  document.body.classList.toggle("connected", connected);
  $("connection").textContent = connected ? "YouTube tab connected" : tabs.length ? "Waiting for selected YouTube tab…" : "No YouTube watch tab connected";
  $("title").textContent = connected ? state.title : "No video selected";
  $("playback").textContent = connected ? state.ended ? "Ended" : state.paused ? "Paused" : "Playing" : "—";
  $("play-toggle").disabled = !connected;
  $("play-toggle").textContent = connected && !state.paused ? "Pause" : "Play";
  $("control-status").textContent = controlStatus;
  const time = displayTime();
  $("time").textContent = connected ? fmt(time) : "0:00";
  const manualActive = connected && manualCues.length && manualVideoId === state.videoId;
  const pasted = manualActive ? manualAt(time) : null;
  const caption = captionMessage(connected);
  $("current").textContent = caption;
  $("current").classList.toggle("empty", !state?.caption && !pasted);
  $("previous").textContent = connected ? pasted?.previous ?? state?.previous ?? "" : "";
  $("next").textContent = connected ? pasted?.next ?? state?.next ?? "" : "";
  if (follow && caption !== renderedCaption) $("current").scrollIntoView({ block: "nearest", behavior: "smooth" });
  renderedCaption = caption;
  select.hidden = tabs.length < 2;
  select.replaceChildren(...tabs.map((item) => {
    const option = document.createElement("option");
    option.value = item.tabId;
    option.textContent = item.title || item.videoId;
    option.selected = item.tabId === state?.tabId;
    return option;
  }));
  $("paste-status").textContent = manualCues.length
    ? `${manualCues.length} cues loaded${manualVideoId ? ` for ${manualVideoId}` : ""}.`
    : "";
}

port.onMessage.addListener((message) => {
  if (message?.protocol !== "listensub/1") return;
  if (message.type === "TAB_LIST") { tabs = message.tabs || []; render(); }
  if (message.type === "STATE") {
    state = message.state;
    stateReceivedAt = performance.now();
    if (manualCues.length && !manualVideoId && state?.videoId) {
      manualVideoId = state.videoId;
      localStorage.setItem("listensub-manual-video", manualVideoId);
    }
    render();
  }
  if (message.type === "CONTROL_RESULT") {
    controlStatus = message.ok ? "" : message.error || "Could not control the YouTube player.";
    render();
  }
});

$("play-toggle").addEventListener("click", () => {
  if (!state) return;
  controlStatus = "";
  port.postMessage({ protocol: "listensub/1", type: "CONTROL", command: state.paused ? "PLAY" : "PAUSE" });
});
select.addEventListener("change", () => port.postMessage({ protocol: "listensub/1", type: "SELECT_TAB", tabId: Number(select.value) }));
$("reconnect").addEventListener("click", () => port.postMessage({ protocol: "listensub/1", type: "REFRESH_TABS" }));
$("font-size").addEventListener("input", (event) => document.documentElement.style.setProperty("--caption-size", `${event.target.value}px`));
$("follow").addEventListener("click", () => {
  follow = !follow;
  $("follow").textContent = `Follow: ${follow ? "on" : "off"}`;
  $("follow").setAttribute("aria-pressed", String(follow));
});
$("use-transcript").addEventListener("click", () => {
  const text = $("transcript-input").value;
  const parsed = parseTranscript(text);
  if (!parsed.length) {
    $("paste-status").textContent = "No timestamped caption lines found. Use 00:01:32 caption text, SRT or VTT.";
    return;
  }
  manualCues = parsed;
  manualVideoId = state?.videoId || null;
  localStorage.setItem("listensub-transcript", text);
  if (manualVideoId) localStorage.setItem("listensub-manual-video", manualVideoId);
  else localStorage.removeItem("listensub-manual-video");
  render();
});
$("clear-transcript").addEventListener("click", () => {
  manualCues = [];
  manualVideoId = null;
  $("transcript-input").value = "";
  localStorage.removeItem("listensub-transcript");
  localStorage.removeItem("listensub-manual-video");
  render();
});
$("transcript-input").addEventListener("input", (event) => localStorage.setItem("listensub-transcript", event.target.value));
setInterval(render, 250);
