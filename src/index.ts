import { app, BrowserWindow, ipcMain } from "electron";
import { opts } from "./cli";
import isElevated from "is-elevated";
import sudo from "@expo/sudo-prompt";
import { Gateway, Portal } from "./endpoints";
import { connectVpn } from "./openconnect";
import * as log from "loglevel";
import { createHostWindow } from "./vpn-host-window";
import { createGatewaySelectionWindow } from "./gateway-selection-window";
import { ChildProcess } from "child_process";

// Disable GPU to avoid crashes in headless/server environments
app.disableHardwareAcceleration();

log.setDefaultLevel("debug");

let vpnProcess: ChildProcess | null = null;

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
  } catch (e) {
    console.error("login failed.", e);
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
    const cwd = process.cwd();
    command = `cd "${cwd.replace(/"/g, '\\"')}" && "${process.execPath}" --no-sandbox ${args} & disown`;
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
