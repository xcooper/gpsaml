import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  dialog,
  ipcMain,
  nativeImage,
} from "electron";
import { opts } from "./cli";
import isElevated from "is-elevated";
import sudo from "@expo/sudo-prompt";
import { Gateway, Portal } from "./endpoints";
import { connectVpn } from "./openconnect";
import * as log from "loglevel";
import { createHostWindow } from "./vpn-host-window";
import { createGatewaySelectionWindow } from "./gateway-selection-window";
import {
  createConnectionStatusWindow,
  StatusWindowHandle,
} from "./connection-status-window";
import { loadResource } from "./resource";
import { ChildProcess } from "child_process";
import { existsSync } from "fs";

// Disable GPU to avoid crashes in headless/server environments
app.disableHardwareAcceleration();

log.setDefaultLevel("debug");

let vpnProcess: ChildProcess | null = null;
let tray: Tray | null = null;
let statusWindow: StatusWindowHandle | null = null;
let trayAnimTimer: NodeJS.Timeout | null = null;

// 4-frame walking-dog silhouette for the menu-bar tray. Loaded as macOS
// template images so the OS recolors them for light/dark menu bars.
// Frames are pre-rendered to @2x PNGs at build time (assets/tray/) and
// cycle on a setInterval similar to apps like Runcat.
function loadDogFrames(): Electron.NativeImage[] {
  const out: Electron.NativeImage[] = [];
  for (let i = 0; i < 4; i++) {
    const file = loadResource(`tray/tray-dog-${i}@2x.png`);
    if (!existsSync(file)) return [];
    const img = nativeImage.createFromPath(file);
    if (img.isEmpty()) return [];
    img.setTemplateImage(true);
    out.push(img);
  }
  return out;
}

function startTrayAnimation(frames: Electron.NativeImage[]): void {
  if (!tray || frames.length === 0) return;
  let i = 0;
  tray.setImage(frames[0]);
  trayAnimTimer = setInterval(() => {
    if (!tray || tray.isDestroyed()) {
      stopTrayAnimation();
      return;
    }
    i = (i + 1) % frames.length;
    tray.setImage(frames[i]);
  }, 200);
}

function stopTrayAnimation(): void {
  if (trayAnimTimer) {
    clearInterval(trayAnimTimer);
    trayAnimTimer = null;
  }
}

function createTray(): void {
  // Try the animated walking-dog silhouette first (Runcat style). If SVG
  // rendering through nativeImage isn't supported on this Electron build
  // we fall back to a plain 🦮 emoji title (still cute, just static).
  const frames = loadDogFrames();
  if (frames.length > 0) {
    tray = new Tray(frames[0]);
    startTrayAnimation(frames);
  } else {
    tray = new Tray(nativeImage.createEmpty());
    tray.setTitle("🦮");
  }
  tray.setToolTip("gpsaml");

  const showWindow = () => {
    // Prefer the connection-status window when it exists (it stays around for
    // the lifetime of the tunnel and may be hidden). Fall back to whichever
    // BrowserWindow is currently open (host or gateway selector).
    if (statusWindow) {
      statusWindow.show();
      return;
    }
    const wins = BrowserWindow.getAllWindows();
    if (wins.length === 0) return;
    const target = wins[wins.length - 1];
    if (target.isMinimized()) target.restore();
    target.show();
    target.focus();
  };

  const menu = Menu.buildFromTemplate([
    { label: "gpsaml", enabled: false },
    { type: "separator" },
    { label: "Show window", click: showWindow },
    {
      label: "Disconnect",
      click: () => {
        if (vpnProcess && vpnProcess.exitCode === null) {
          vpnProcess.kill();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit gpsaml",
      accelerator: "Cmd+Q",
      click: () => {
        if (vpnProcess && vpnProcess.exitCode === null) vpnProcess.kill();
        vpnProcess = null;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);

  // Left-click the menu-bar icon: bring the window back. Right-click still
  // shows the context menu (Electron handles that automatically on macOS).
  tray.on("click", showWindow);
}

async function enterEntryPoint(): Promise<void> {
  try {
    const hostname = await createHostWindow();
    const portal = new Portal(hostname);
    await portal.doPrelogin();
    await portal.doSamlAuth();
    const policy = await portal.getConfig();
    const gateways = policy.gateways;
    const selGateway = await createGatewaySelectionWindow(gateways);
    const fingerprint = portal.fingerprint;
    const gateway = new Gateway(
      selGateway,
      policy.portalUserAuthCookie,
      policy.userName,
    );
    const loginResp = await gateway.doLogin();
    vpnProcess = connectVpn(
      loginResp,
      loginResp.user,
      fingerprint!,
      gateway.hostname,
    );

    statusWindow = await createConnectionStatusWindow(gateway.hostname);
    vpnProcess.on("close", () => {
      statusWindow?.notifyDisconnected();
    });
    await statusWindow.awaitDisconnect;
    if (vpnProcess && vpnProcess.exitCode === null) {
      vpnProcess.kill();
    }
    vpnProcess = null;
    statusWindow.close();
    statusWindow = null;
    app.quit();
  } catch (e) {
    console.error("login failed.", e);
    const detail = e instanceof Error ? e.stack || e.message : String(e);
    await dialog.showMessageBox({
      type: "error",
      title: "gpsaml",
      message: "Connection failed",
      detail,
      buttons: ["Quit"],
      defaultId: 0,
    });
    app.quit();
  }
}

function relaunchAsRoot() {
  console.log("Root privileges required. Relaunching with sudo...");
  const args = process.argv
    .slice(1)
    .map((arg) => `"${arg.replace(/"/g, '\\"')}"`)
    .join(" ");

  let command = "";
  if (process.platform === "win32") {
    command = `cmd /c start "" "${process.execPath}" ${args}`;
  } else {
    // sudo-prompt detaches the elevated process from our stdio, so without
    // redirection any console.log / console.error after relaunch is lost.
    // Tee everything to a log file so users can attach it when reporting bugs.
    const cwd = process.cwd();
    const logPath = (process.env.GPSAML_LOG || "/tmp/gpsaml.log").replace(
      /"/g,
      '\\"',
    );
    command = `cd "${cwd.replace(/"/g, '\\"')}" && "${process.execPath}" --disable-gpu --no-sandbox ${args} > "${logPath}" 2>&1 & disown`;
  }

  const options = {
    name: "GPSAML",
  };

  // We no longer log stdout/stderr.
  // Note: On POSIX this will still wait for the app to close.
  // On Windows 'start' allows it to return immediately.
  sudo.exec(command, options, (error) => {
    if (error) {
      console.error("Failed to acquire root privileges:", error);
    }
    app.quit();
  });
}

const bootstrap = async () => {
  const isAdmin = await isElevated();
  if (!isAdmin) {
    relaunchAsRoot();
    return;
  }

  app.on("window-all-closed", () => {
    // just prevent the app terminated after the 1st window closed!
  });

  app.on("will-quit", () => {
    stopTrayAnimation();
    if (vpnProcess) {
      console.log("Terminating VPN process...");
      vpnProcess.kill();
      vpnProcess = null;
    }
  });

  process.on("SIGTERM", () => {
    if (vpnProcess) {
      console.log("Terminating VPN process on SIGTERM...");
      vpnProcess.kill();
      vpnProcess = null;
    }
    process.exit(0);
  });

  await app.whenReady();

  // Install a minimal application menu so the system-standard editing
  // shortcuts (Cmd+C/V/X/A, Undo/Redo) work in our text inputs. Without
  // an explicit menu, Electron uses the default which enables the same
  // bindings — but BrowserWindow.setMenuBarVisibility(false) on each
  // window has been observed to suppress them on macOS, so we set the
  // template explicitly here.
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "pasteAndMatchStyle" },
          { role: "delete" },
          { role: "selectAll" },
        ],
      },
      {
        label: "Window",
        submenu: [{ role: "minimize" }, { role: "close" }],
      },
    ]),
  );

  createTray();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await enterEntryPoint();
    }
  });
  await enterEntryPoint();
};

bootstrap().catch((err) => {
  console.error("Failed to bootstrap application:", err);
  app.quit();
});
