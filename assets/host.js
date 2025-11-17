const { ipcRenderer } = require("electron");

document.getElementById("hostForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const hostInput = document.getElementById("host");
  const host = hostInput.value.trim();
  if (!host) {
    return;
  }
  ipcRenderer.send("host-submitted", host);
  hostInput.disabled = true;
});
