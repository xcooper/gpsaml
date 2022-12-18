const { app, session, BrowserWindow } = require('electron');
const log = require('loglevel');

class LoginWindow {
  constructor(hostname, isRedirect) {
    this.hostname = hostname;
    this.winWidth = 800;
    this.winHeight = 600;
    this.isRedirect = isRedirect || false;
  }

  createWindow(url) {
    const win = new BrowserWindow({
      width: 800,
      height: 600
    });
    win.setMenuBarVisibility(false);
    if (this.isRedirect) {
      win.loadURL(url);
    } else {
      win.loadURL('data:text/html;base64,' + url);
    }
    this.win = win;
    this.preloginResponse = this._checkAuthOk();
    return win;
  }

  _checkAuthOk() {
    return new Promise((resolve, reject) => {
      const filter = {
        urls: [`https://${this.hostname}/*`]
      };
      this.win.session.webRequest.onHeadersReceived(filter, (details, callback) => {
        const headers = details.responseHeaders;
        callback({responseHeaders: headers});
        if (headers['prelogin-cookie']) {
          resolve({
            preloginCookie: headers['prelogin-cookie'],
            samlUsername: headers['saml-username']
          });
        }
      });
    });
  }

  close() {
    this.win.close();
  }
}

module.exports = { LoginWindow };