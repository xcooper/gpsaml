import { ipcMain } from "electron";
import { BrowserWindow } from "electron";
import { loadResource } from "./resource";

async function createHostWindow(): Promise<String> {
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
  await win.loadFile(loadResource("host.html"));
  const { promise, resolve } = Promise.withResolvers<String>();
  ipcMain.on("host-submitted", (_event, host: string) => {
    ipcMain.removeAllListeners("host-submitted");
    win.close();
    resolve(host);
  });
  return promise;
}

export { createHostWindow };
