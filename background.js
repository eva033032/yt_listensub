const PAGE = "web/index.html";
const tabs = new Map();
let selectedTabId = null;
let pagePort = null;

function sendPage(message) {
  if (pagePort) pagePort.postMessage({ protocol: "listensub/1", ...message });
}

function publish() {
  const entries = [...tabs.values()].filter((item) => item.videoId);
  if (!entries.some((item) => item.tabId === selectedTabId)) {
    selectedTabId = entries[0]?.tabId ?? null;
  }
  sendPage({ type: "TAB_LIST", tabs: entries, selectedTabId });
  const current = entries.find((item) => item.tabId === selectedTabId);
  sendPage({ type: "STATE", state: current ?? null });
}

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL(PAGE) });
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "listensub-page") return;
  pagePort = port;
  port.onMessage.addListener((message) => {
    if (message?.protocol !== "listensub/1") return;
    if (message.type === "SELECT_TAB" && Number.isInteger(message.tabId)) {
      selectedTabId = message.tabId;
      publish();
    }
    if (message.type === "REFRESH_TABS") discoverTabs();
    if (message.type === "CONTROL" && ["PLAY", "PAUSE"].includes(message.command)) {
      if (!Number.isInteger(selectedTabId)) {
        sendPage({ type: "CONTROL_RESULT", ok: false, error: "No YouTube tab is selected." });
        return;
      }
      chrome.tabs.sendMessage(selectedTabId, {
        protocol: "listensub/1", type: "PLAYER_CONTROL", command: message.command
      }, (result) => {
        const error = chrome.runtime.lastError;
        sendPage({
          type: "CONTROL_RESULT",
          ok: Boolean(result?.ok && !error),
          error: result?.error || (error ? "Could not reach the selected YouTube tab. Refresh it and reconnect." : "")
        });
      });
    }
  });
  port.onDisconnect.addListener(() => { if (pagePort === port) pagePort = null; });
  discoverTabs();
  publish();
});

function discoverTabs() {
  chrome.tabs.query({ url: "https://www.youtube.com/watch*" }, (found) => {
    for (const tab of found) {
      if (!Number.isInteger(tab.id)) continue;
      chrome.tabs.sendMessage(tab.id, { protocol: "listensub/1", type: "REQUEST_STATE" }, (response) => {
        if (chrome.runtime.lastError || !response?.state) return;
        tabs.set(tab.id, { ...response.state, tabId: tab.id, title: tab.title || response.state.title, url: tab.url || response.state.url });
        publish();
      });
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.protocol !== "listensub/1" || message.type !== "STATE" || !Number.isInteger(sender.tab?.id)) return;
  const tabId = sender.tab.id;
  const state = { ...message.state, tabId, title: sender.tab.title || message.state.title, url: sender.tab.url || message.state.url };
  tabs.set(tabId, state);
  if (selectedTabId == null) selectedTabId = tabId;
  publish();
});

chrome.tabs.onRemoved.addListener((tabId) => { tabs.delete(tabId); publish(); });
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status === "loading") {
    tabs.delete(tabId);
    publish();
    if (tab.url?.includes("youtube.com/watch")) discoverTabs();
  }
});
chrome.tabs.onActivated.addListener(({ tabId }) => {
  if (tabs.has(tabId)) { selectedTabId = tabId; publish(); }
});
