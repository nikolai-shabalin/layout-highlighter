chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url.startsWith("chrome://")) {
    return;
  }

  // Проверяем, внедрен ли уже скрипт, отправив ему сообщение
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: "ping" });
    if (response && response.status === "ready") {
      // Скрипт на месте, просто просим его переключить панель
      await chrome.tabs.sendMessage(tab.id, { action: "toggle-panel" });
      return;
    }
  } catch (e) {
    // Ошибка означает, что content script еще не на странице.
    // Это нормально при первом клике. Мы его сейчас внедрим.
    console.log("Injecting content script for the first time.");
  }

  // Внедряем CSS и JS, если это первый клик
  await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["panel.css"] });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
}); 