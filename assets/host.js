const { ipcRenderer } = require("electron");

const form = document.getElementById("hostForm");
const hostInput = document.getElementById("host");
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
