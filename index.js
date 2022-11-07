const { app, session, BrowserWindow } = require('electron')
const https = require('node:https')
const parseStringPromise = require('xml2js').parseStringPromise

const userAgent = 'PAN GlobalProtect'
var serverCertFp = ""
var opts = require('node-getopt').create([
  ['h', 'host=ARG', 'The hostname of VPN server.'],
  ['g', 'gateway=ARG', 'The prefered gateway.']
])
.bindHelp()
.parseSystem()

function createWindow(htmlContent) {
  const win = new BrowserWindow({
    width: 800,
    height: 600
  })

  win.loadURL('data:text/html;base64,' + htmlContent)
  return win
}

function fetchSamlResponse(hostname) {
  return new Promise((resolve, reject) => {
    url = `https://${hostname}/global-protect/prelogin.esp`
    req = https.request(url, {
      headers: {
        'User-Agent': userAgent
      },
      method: 'POST'
    }, (resp) => {
      serverCertFp = resp.socket.getPeerCertificate().fingerprint.replaceAll(':', '')
      const chunks = []
      resp.on('data', (chunk) => chunks.push(chunk))
      resp.on('end', () => resolve(Buffer.concat(chunks).toString()))
    })
    req.end(Buffer.from('tmp=tmp&kerberos-support=yes&ipv6-support=yes&clientVer=4100&clientos=Linux'))
  })
}

async function parseSamlRequest(rawSamlPrelogin) {
  const samlPrelogin = await parseStringPromise(rawSamlPrelogin, {
    explicitArray: false
  })
  return samlPrelogin['prelogin-response']['saml-request']
}

async function showLoginPage(hostname) {
  var xml = await fetchSamlResponse(hostname)
  var loginPage = await parseSamlRequest(xml)
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
    console.log(`echo '${preloginCookie}' | sudo openconnect --authgroup='${gateway}' --protocol=gp --user=${samlUsername} --os=linux --passwd-on-stdin --servercert ${serverCertFp} --usergroup=portal:prelogin-cookie --useragent='${userAgent}' ${hostname}`)
    if (preloginCookie) {
      win.close()
    }
  } catch (e) {
    console.error('login failed.')
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
