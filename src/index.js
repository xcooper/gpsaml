const { app } = require('electron');
const { opts } = require('./config');
const { Portal } = require('./portal');
const { Gateway } = require('./gateway');
const { LoginWindow } = require('./vpn-connect-window');
const { connectVpn } = require('./openconnect');
const log = require('loglevel');
log.setDefaultLevel('debug');

async function main() {
  try {
    const hostname = opts.options.host;
    const win = new LoginWindow(hostname);
    const gatewayName = opts.options.gateway;
    const portal = new Portal(hostname);
    const html = await portal.prelogin();
    await win.createWindow(html, portal.isRedirect());
    const {preloginCookie, samlUsername} = await win.preloginResponse;
    const policy = await portal.getConfig(preloginCookie, samlUsername);
    log.debug('policy', policy);
    const gateway = new Gateway();
    const loginResp = await gateway.doLogin(policy.userName, policy.portalUserAuthCookie);
    connectVpn(
      loginResp,
      gatewayName,
      loginResp.user,
      portal.fingerprint,
      'taiwan-vpn.commscope.com'
    );
    if (preloginCookie && !opts.options.debug) {
      win.close();
    }
  } catch (e) {
    console.error('login failed.', e);
  }
}

app.whenReady().then(() => {
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      main();
    }
  });
  main();
});

app.on('window-all-closed', () => {
  app.quit();
});
