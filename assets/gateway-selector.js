const { ipcRenderer } = require("electron");

const gatewaySelect = document.getElementById("gatewaySelect");
const connectBtn = document.getElementById("connectBtn");
const loading = document.getElementById("loading");
const selectionArea = document.getElementById("selectionArea");

ipcRenderer.on("set-gateways", (event, gateways) => {
  loading.style.display = "none";
  selectionArea.style.display = "block";

  gatewaySelect.innerHTML = "";

  if (!gateways || gateways.length === 0) {
    const option = document.createElement("option");
    option.text = "No gateways available";
    option.disabled = true;
    gatewaySelect.add(option);
    return;
  }

  gateways.forEach((gw) => {
    const option = document.createElement("option");
    // Handle if gw is object or string
    const value = typeof gw === "string" ? gw : gw.name || gw.hostname;
    const label =
      typeof gw === "string"
        ? gw
        : gw.description
          ? `${gw.name} - ${gw.description}`
          : gw.name;

    option.value = value;
    option.text = label;
    gatewaySelect.add(option);
  });

  // Select first one by default
  if (gatewaySelect.options.length > 0 && !gatewaySelect.options[0].disabled) {
    gatewaySelect.selectedIndex = 0;
    connectBtn.disabled = false;
  }
});

gatewaySelect.addEventListener("change", () => {
  connectBtn.disabled =
    gatewaySelect.selectedIndex === -1 ||
    gatewaySelect.selectedOptions[0].disabled;
});

document.getElementById("gatewayForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const selected = gatewaySelect.value;
  if (selected) {
    ipcRenderer.send("gateway-submitted", selected);
    connectBtn.disabled = true;
  }
});
