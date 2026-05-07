import { BrowserWindow, ipcMain } from "electron";
import { loadResource } from "./resource";

interface StatusWindowHandle {
  win: BrowserWindow;
  /** Resolves when the user clicks Disconnect (NOT when window is closed/hidden). */
  awaitDisconnect: Promise<void>;
  /** Notify the renderer that the underlying process has exited. */
  notifyDisconnected: () => void;
  /** Bring the (possibly hidden) window back to the foreground. */
  show: () => void;
  /** Tear down the window for real (used during quit). */
  close: () => void;
}

async function createConnectionStatusWindow(
  gatewayLabel: string,
): Promise<StatusWindowHandle> {
  const win = new BrowserWindow({
    width: 380,
    height: 440,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "VPN Status",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.setMenuBarVisibility(false);
  await win.loadFile(loadResource("connection-status.html"));
  win.webContents.send("status-init", gatewayLabel);

  // Closing the window button hides it instead of destroying it; the VPN
  // tunnel keeps running in the background, accessible via the tray menu.
  // Setting `reallyClosing` to true (via the close() method) lets app quit.
  let reallyClosing = false;
  win.on("close", (event) => {
    if (!reallyClosing) {
      event.preventDefault();
      win.hide();
    }
  });

  const { promise, resolve } = Promise.withResolvers<void>();
  let resolved = false;
  const settle = () => {
    if (resolved) return;
    resolved = true;
    ipcMain.removeAllListeners("disconnect-requested");
    resolve();
  };

  ipcMain.on("disconnect-requested", settle);

  return {
    win,
    awaitDisconnect: promise,
    notifyDisconnected: () => {
      if (!win.isDestroyed()) {
        win.webContents.send("status-disconnected");
      }
    },
    show: () => {
      if (win.isDestroyed()) return;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    },
    close: () => {
      reallyClosing = true;
      if (!win.isDestroyed()) win.close();
    },
  };
}

export { createConnectionStatusWindow, StatusWindowHandle };
