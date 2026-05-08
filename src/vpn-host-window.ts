import { ipcMain, BrowserWindow } from "electron";
import { loadResource } from "./resource";

interface HostWindowHandle {
  /** Wait for the user to submit the form. May be called repeatedly. */
  awaitSubmit(): Promise<string>;
  /** Display an inline error message and re-enable the input for retry. */
  showError(message: string): void;
  /** Close the window and detach the IPC listener. */
  close(): void;
}

async function createHostWindow(): Promise<HostWindowHandle> {
  const win = new BrowserWindow({
    width: 460,
    height: 320,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.setMenuBarVisibility(false);
  await win.loadFile(loadResource("host.html"));

  let pendingResolve: ((host: string) => void) | null = null;
  const submitListener = (_event: unknown, host: string) => {
    const resolve = pendingResolve;
    pendingResolve = null;
    if (resolve) resolve(host);
  };
  ipcMain.on("host-submitted", submitListener);

  return {
    awaitSubmit: () =>
      new Promise<string>((resolve) => {
        pendingResolve = resolve;
      }),
    showError: (message: string) => {
      if (!win.isDestroyed()) {
        win.webContents.send("host-error", message);
      }
    },
    close: () => {
      ipcMain.removeListener("host-submitted", submitListener);
      if (!win.isDestroyed()) win.close();
    },
  };
}

export { createHostWindow, HostWindowHandle };
