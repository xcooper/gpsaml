const { ipcRenderer } = require("electron");

const list = document.getElementById("gatewayList");
const listMeta = document.getElementById("listMeta");
const countNum = document.getElementById("countNum");
const loading = document.getElementById("loading");
const connectBtn = document.getElementById("connectBtn");
const form = document.getElementById("gatewayForm");

let items = [];
let selectedIndex = -1;

function gatewayValue(gw) {
  if (typeof gw === "string") return gw;
  return gw.name || gw.hostname || "";
}
function gatewayPrimary(gw) {
  if (typeof gw === "string") return gw;
  return gw.name || gw.hostname || "(unnamed)";
}
function gatewaySecondary(gw) {
  if (typeof gw === "string") return "";
  if (gw.description) return gw.description;
  if (gw.hostname && gw.name && gw.name !== gw.hostname) return gw.hostname;
  return "";
}

function render(gateways) {
  list.innerHTML = "";
  items = [];

  if (!gateways || gateways.length === 0) {
    const li = document.createElement("li");
    li.className = "gateway-item empty";
    li.textContent = "no gateways available";
    list.appendChild(li);
    return;
  }

  gateways.forEach((gw, i) => {
    const li = document.createElement("li");
    li.className = "gateway-item";
    li.dataset.value = gatewayValue(gw);
    li.dataset.index = String(i);

    const marker = document.createElement("span");
    marker.className = "marker";
    marker.textContent = "▸";

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = gatewayPrimary(gw);

    li.appendChild(marker);
    li.appendChild(name);

    const desc = gatewaySecondary(gw);
    if (desc) {
      const d = document.createElement("span");
      d.className = "desc";
      d.textContent = desc;
      li.appendChild(d);
    }

    li.addEventListener("click", () => select(i));
    li.addEventListener("dblclick", () => {
      select(i);
      form.requestSubmit();
    });

    list.appendChild(li);
    items.push(li);
  });
}

function select(i) {
  if (i < 0 || i >= items.length) return;
  if (selectedIndex >= 0 && items[selectedIndex]) {
    items[selectedIndex].classList.remove("selected");
  }
  selectedIndex = i;
  items[i].classList.add("selected");
  items[i].scrollIntoView({ block: "nearest" });
  connectBtn.disabled = false;
}

ipcRenderer.on("set-gateways", (_e, gateways) => {
  loading.hidden = true;
  list.hidden = false;
  listMeta.hidden = false;
  countNum.textContent = String(gateways ? gateways.length : 0);
  render(gateways);
  if (items.length > 0 && !items[0].classList.contains("empty")) select(0);
});

document.addEventListener("keydown", (e) => {
  if (items.length === 0) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    select(Math.min(selectedIndex + 1, items.length - 1));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    select(Math.max(selectedIndex - 1, 0));
  }
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (selectedIndex < 0) return;
  const value = items[selectedIndex].dataset.value;
  if (!value) return;
  ipcRenderer.send("gateway-submitted", value);
  connectBtn.disabled = true;
});
