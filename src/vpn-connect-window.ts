import { BrowserWindow } from "electron";
import * as log from "loglevel";

interface SamlResponse {
  preloginCookie: string | string[];
  samlUsername: string | string[];
}

class LoginWindow {
  private hostname: string;
  private winWidth: number;
  private winHeight: number;
  private win!: BrowserWindow;
  public samlResponse!: Promise<SamlResponse>;

  constructor(hostname: string) {
    this.hostname = hostname;
    this.winWidth = 800;
    this.winHeight = 600;
  }

  createWindow(url: string, isRedirect: boolean): BrowserWindow {
    log.debug("the login URL - %s", url);
    const win = new BrowserWindow({
      width: this.winWidth,
      height: this.winHeight,
    });
    win.setMenuBarVisibility(false);
    if (isRedirect) {
      win.loadURL(Buffer.from(url, "base64").toString());
    } else {
      win.loadURL("data:text/html;base64," + url);
    }
    this.win = win;
    this.samlResponse = this._checkAuthOk();
    return win;
  }

  private _checkAuthOk(): Promise<SamlResponse> {
    return new Promise((resolve) => {
      const filter = {
        urls: [`https://${this.hostname}/*`],
      };
      this.win.webContents.session.webRequest.onHeadersReceived(
        filter,
        (details, callback) => {
          const headers = details.responseHeaders;
          log.debug("login process finished with headers - %s", headers);
          callback({ responseHeaders: headers });
          if (headers && headers["Prelogin-Cookie"]) {
            const response = {
              preloginCookie: headers["Prelogin-Cookie"],
              samlUsername: headers["Saml-Username"],
            };
            this.close();
            resolve(response);
          }
        },
      );
    });
  }

  close(): void {
    this.win.close();
  }
}

export { LoginWindow, SamlResponse };
