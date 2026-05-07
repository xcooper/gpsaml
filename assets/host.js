const { ipcRenderer, clipboard } = require("electron");

const form = document.getElementById("hostForm");
const hostInput = document.getElementById("host");

// Cmd+V / Cmd+C / Cmd+X are sometimes not delivered by the OS to the
// elevated (sudo'd) Electron process via the Application Menu accelerator
// path. Wire the handlers explicitly through Electron's clipboard API
// so paste works regardless of menu/responder-chain quirks.
hostInput.addEventListener("keydown", (e) => {
  if (!e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return;
  const key = e.key.toLowerCase();
  if (key === "v") {
    e.preventDefault();
    const text = clipboard.readText();
    if (!text) return;
    const start = hostInput.selectionStart ?? hostInput.value.length;
    const end = hostInput.selectionEnd ?? hostInput.value.length;
    hostInput.value =
      hostInput.value.slice(0, start) + text + hostInput.value.slice(end);
    const caret = start + text.length;
    hostInput.setSelectionRange(caret, caret);
    hostInput.dispatchEvent(new Event("input", { bubbles: true }));
  } else if (key === "c") {
    e.preventDefault();
    const start = hostInput.selectionStart ?? 0;
    const end = hostInput.selectionEnd ?? 0;
    if (end > start) clipboard.writeText(hostInput.value.slice(start, end));
  } else if (key === "x") {
    e.preventDefault();
    const start = hostInput.selectionStart ?? 0;
    const end = hostInput.selectionEnd ?? 0;
    if (end > start) {
      clipboard.writeText(hostInput.value.slice(start, end));
      hostInput.value =
        hostInput.value.slice(0, start) + hostInput.value.slice(end);
      hostInput.setSelectionRange(start, start);
      hostInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  } else if (key === "a") {
    e.preventDefault();
    hostInput.select();
  }
});
const submitBtn = form.querySelector("button[type=submit]");
const errorBanner = document.getElementById("errorBanner");

function clearError() {
  errorBanner.hidden = true;
  errorBanner.textContent = "";
}

function showError(message) {
  errorBanner.hidden = false;
  errorBanner.textContent = message;
  hostInput.disabled = false;
  submitBtn.disabled = false;
  hostInput.focus();
  hostInput.select();
}

ipcRenderer.on("host-error", (_e, message) => {
  showError(message);
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const host = hostInput.value.trim();
  if (!host) return;
  clearError();
  ipcRenderer.send("host-submitted", host);
  hostInput.disabled = true;
  submitBtn.disabled = true;
});

hostInput.addEventListener("input", () => {
  if (!errorBanner.hidden) clearError();
});
