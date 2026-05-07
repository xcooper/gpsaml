const { ipcRenderer } = require("electron");

const pulse = document.getElementById("pulse");
const bar = document.getElementById("bar");
const label = document.getElementById("label");
const headline = document.getElementById("headline");
const gatewayEl = document.getElementById("gateway");
const uptimeEl = document.getElementById("uptime");
const indicatorText = document.getElementById("indicatorText");
const button = document.getElementById("disconnect");

let startedAt = Date.now();
let timer = setInterval(updateUptime, 1000);
updateUptime();

function pad(n) {
  return String(n).padStart(2, "0");
}
function updateUptime() {
  const ms = Date.now() - startedAt;
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  uptimeEl.textContent = `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

ipcRenderer.on("status-init", (_e, gateway) => {
  gatewayEl.textContent = gateway || "—";
  startedAt = Date.now();
});

ipcRenderer.on("status-disconnected", () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  pulse.classList.remove("disconnecting");
  pulse.classList.add("disconnected");
  bar.classList.add("disconnected");
  label.classList.remove("disconnecting");
  label.classList.add("disconnected");
  label.textContent = "tunnel terminated";
  headline.textContent = "disconnected";
  indicatorText.textContent = "down";
  button.disabled = true;
  button.textContent = "closing";
});

button.addEventListener("click", () => {
  if (button.disabled) return;
  button.disabled = true;
  button.textContent = "disconnecting";
  pulse.classList.add("disconnecting");
  label.classList.add("disconnecting");
  label.textContent = "tearing down tunnel";
  indicatorText.textContent = "...";
  ipcRenderer.send("disconnect-requested");
});
