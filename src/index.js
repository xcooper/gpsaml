const { app } = require('electron');
const parseStringPromise = require('xml2js').parseStringPromise;
const { Portal } = require('./portal');
const { opts } = require('./config');
const { connectVpn } = require('./openconnect');
const log = require('loglevel');
log.setDefaultLevel('debug');

async function main() {
  try {
    const hostname = opts.options.host;
    const gateway = opts.options.gateway;
    const portal = new Portal(hostname);
    const html = await portal.prelogin();
    const win = await createWindow(html);
    const {preloginCookie, samlUsername} = await checkAuthOk(hostname);
    /*
    connectVpn({
      preloginCookie,
      gateway,
      samlUsername,
      portal.fingerprint,
      hostname
    });
    */
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
