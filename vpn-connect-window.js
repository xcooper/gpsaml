
function createWindow(htmlContent) {
  const win = new BrowserWindow({
    width: 800,
    height: 600
  })
  win.setMenuBarVisibility(false)
  win.loadURL('data:text/html;base64,' + htmlContent)
  return win
}

function checkAuthOk(hostname) {
  return new Promise((resolve, reject) => {
    const filter = {
      urls: [`https://${hostname}/*`]
    }
    session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
      log.debug(details)
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
