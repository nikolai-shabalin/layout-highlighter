chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url.startsWith("chrome://")) {
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: "ping" });
    if (response && response.status === "ready") {
      await chrome.tabs.sendMessage(tab.id, { action: "toggle-panel" });
      return;
    }
  } catch (e) {
    console.log("Injecting content script for the first time.");
  }

  await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["panel.css"] });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
});
