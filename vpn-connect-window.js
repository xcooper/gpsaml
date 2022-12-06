const { app, session, BrowserWindow } = require('electron')

class LoginWindow {
  constructor(isRedirect) {
    this.winWidth = 800
    this.winHeight = 600
    this.isRedirect = isRedirect || false
  }

  function createWindow(url) {
    const win = new BrowserWindow({
      width: 800,
      height: 600
    })
    win.setMenuBarVisibility(false)
    if (this.isRedirect) {
      win.loadURL(url)
    } else {
      win.loadURL('data:text/html;base64,' + url)
    }
    this.win = win
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

  function close() {
    this.win.close()
  }
}

module.exports = LoginWindow