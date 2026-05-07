import { ipcMain } from "electron";
import { BrowserWindow } from "electron";
import { loadResource } from "./resource";

async function createHostWindow(): Promise<string> {
  const win = new BrowserWindow({
    width: 460,
    height: 280,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.setMenuBarVisibility(false);
  await win.loadFile(loadResource("host.html"));
  const { promise, resolve } = Promise.withResolvers<string>();
  ipcMain.on("host-submitted", (_event, host: string) => {
    ipcMain.removeAllListeners("host-submitted");
    win.close();
    resolve(host);
  });
  return promise;
}

export { createHostWindow };
