const { app, session, BrowserWindow } = require('electron')
const parseStringPromise = require('xml2js').parseStringPromise
const { doPrelogin } = require('./portal')
const { userAgent } = require('./consts')
const { opts } = require('./config')

var serverCertFp = ""

function createWindow(htmlContent) {
  const win = new BrowserWindow({
    width: 800,
    height: 600
  })
  win.setMenuBarVisibility(false)
  win.loadURL('data:text/html;base64,' + htmlContent)
  return win
}

async function parseSamlRequest(rawSamlPrelogin) {
  const samlPrelogin = await parseStringPromise(rawSamlPrelogin, {
    explicitArray: false
  })
  return samlPrelogin['prelogin-response']['saml-request']
}

async function showLoginPage(hostname) {
  var { preloginResp, fingerprint } = await doPrelogin(hostname)
  serverCertFp = fingerprint
  var loginPage = await parseSamlRequest(preloginResp)
  return createWindow(loginPage)
}

function checkAuthOk(hostname) {
  return new Promise((resolve, reject) => {
    const filter = {
      urls: [`https://${hostname}/*`]
    }
    session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
      const headers = details.responseHeaders
      callback({responseHeaders: headers})
      if (headers['prelogin-cookie']) {
        resolve({
          preloginCookie: headers['prelogin-cookie'],
          samlUsername: headers['saml-username']
        })
      }
    })
  })
}

async function main() {
  try {
    const hostname = opts.options.host
    const gateway = opts.options.gateway
    const win = await showLoginPage(hostname)
    const {preloginCookie, samlUsername} = await checkAuthOk(hostname)
    const xmlconfigFile = "TODO"
    console.log(`echo '${preloginCookie}' | sudo openconnect --xmlconfig ${xmlconfigFile} --authgroup='${gateway}' --protocol=gp --user=${samlUsername} --os=linux --passwd-on-stdin --servercert ${serverCertFp} --usergroup=portal:prelogin-cookie --useragent='${userAgent}' ${hostname}`)
    if (preloginCookie) {
      //win.close()
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
