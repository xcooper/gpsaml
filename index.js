const os = require('node:os')
const { app, session, BrowserWindow } = require('electron')
const parseStringPromise = require('xml2js').parseStringPromise
const Portal = require('./portal')
const { opts } = require('./config')
const { connectVpn } = require('./openconnect')
const log = require('loglevel')
log.setDefaultLevel('debug')

var serverCertFp = ""

async function showLoginPage(hostname) {
  var { preloginResp, fingerprint } = await doPrelogin(hostname)
  var portal = new Portal(hostname)
  var loginPage = await portal.prelogin()
  serverCertFp = portal.fingerprint
  return createWindow(loginPage)
}

async function main() {
  try {
    const hostname = opts.options.host
    const gateway = opts.options.gateway
    const win = await showLoginPage(hostname)
    const {preloginCookie, samlUsername} = await checkAuthOk(hostname)
    connectVpn({
      preloginCookie,
      gateway,
      samlUsername,
      serverCertFp,
      hostname
    })
    if (preloginCookie && !opts.options.debug) {
      win.close()
    }
  } catch (e) {
    console.error('login failed.', e)
  }
}

app.whenReady().then(() => {
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      main()
    }
  })
  main()
})

app.on('window-all-closed', () => {
  app.quit()
})
