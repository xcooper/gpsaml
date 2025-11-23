import { app, BrowserWindow, ipcMain } from "electron";
import { opts } from "./cli";
import { Gateway, Portal } from "./endpoints";
import { connectVpn } from "./openconnect";
import * as log from "loglevel";
import { createHostWindow } from "./vpn-host-window";

// Disable GPU to avoid crashes in headless/server environments
app.disableHardwareAcceleration();

log.setDefaultLevel("debug");

async function enterEntryPoint(): Promise<void> {
  try {
    const hostname = await createHostWindow();
    const portal = new Portal(hostname);
    await portal.doPrelogin();
    await portal.doSamlAuth();
    const policy = await portal.getConfig();
    const fingerprint = portal.fingerprint;
    const gateway = new Gateway(
      "taiwan-vpn.commscope.com",
      policy.portalUserAuthCookie,
      policy.userName,
    );
    const loginResp = await gateway.doLogin();
    connectVpn(loginResp, loginResp.user, fingerprint!, gateway.hostname);
  } catch (e) {
    console.error("login failed.", e);
  }
}

app.on("window-all-closed", () => {
  // just prevent the app terminated after the 1st window closed!
});

app.whenReady().then(async () => {
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await enterEntryPoint();
    }
  });
  await enterEntryPoint();
});
