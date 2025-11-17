import { BrowserWindow } from "electron";
import { loadResource } from "./resource";

function createHostWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 420,
    height: 220,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(loadResource("host.html"));
  return win;
}

export { createHostWindow };
