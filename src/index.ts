import { app, BrowserWindow } from "electron";
import { opts } from "./cli";
import { Gateway, Portal } from "./endpoints";
import { connectVpn } from "./openconnect";
import * as log from "loglevel";

// Disable GPU to avoid crashes in headless/server environments
app.disableHardwareAcceleration();

log.setDefaultLevel("debug");

async function main(): Promise<void> {
  try {
    const hostname = opts.options.host!;
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
  app.quit();
}

app.whenReady().then(() => {
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      main();
    }
  });
  main();
});
