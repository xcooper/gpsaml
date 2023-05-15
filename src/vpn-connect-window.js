const {BrowserWindow} = require("electron");
const log = require("loglevel");

class LoginWindow {
  constructor(hostname) {
    this.hostname = hostname;
    this.winWidth = 800;
    this.winHeight = 600;
  }

  createWindow(url, isRedirect) {
    log.debug('the login URL - %s', url);
    const win = new BrowserWindow({
      width: this.winWidth,
      height: this.winHeight
    });
    win.setMenuBarVisibility(false);
    if (isRedirect) {
      win.loadURL(Buffer.from(url, 'base64').toString());
    } else {
      win.loadURL('data:text/html;base64,' + url);
    }
    this.win = win;
    this.samlResponse = this._checkAuthOk();
    return win;
  }

  _checkAuthOk() {
    return new Promise((resolve) => {
      const filter = {
        urls: [`https://${this.hostname}/*`]
      };
      this.win.webContents.session.webRequest.onHeadersReceived(filter, (details, callback) => {
        const headers = details.responseHeaders;
        log.debug('login process finished with headers - %s', headers);
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

module.exports = {LoginWindow};
