const {parseStringPromise} = require("xml2js");
const os = require("os");
const got = require("got");
const log = require("loglevel");
const {userAgent} = require("./consts");
const {LoginWindow} = require("./vpn-connect-window");

const unmarshall = (rawResponse) => {
  return parseStringPromise(rawResponse, {
    explicitArray: false
  });
};

class NetworkEndpoint {
  constructor() {
    this.fingerprint = null;
  }

  updateFingerprint(resp) {
    this.fingerprint = resp.socket.getPeerCertificate().fingerprint.replaceAll(':', '');
    log.debug("Fingerprint updated - %s", this.fingerprint);
  }
}

class Portal extends NetworkEndpoint {
  constructor(hostname) {
    super();
    this.hostname = hostname;
    this.authMethod = 'REDIRECT';
    this.samlUsername = null;
    this.preloginCookie = null;
    this.preloginSuccess = false;
    this.samlRequest = null;
  }

  doPrelogin() {
    return new Promise((resolve, reject) => {
      got(`https://${this.hostname}/global-protect/prelogin.esp`, {
        method: 'POST',
        headers: {
          'User-Agent': userAgent
        },
        searchParams: {
          'tmp': 'tmp',
          'kerberos-support': 'yes',
          'ipv6-support': 'yes',
          'clientVer': '4100',
          'clientos': 'Linux'
        },
        hooks: {
          afterResponse: [
            async (resp) => {
              this.updateFingerprint(resp);
              log.debug('[Portal] The SAML response after prelogin - %s', resp);
              const samlResponse = await unmarshall(resp.body);
              const preloginResponse = samlResponse['prelogin-response'];
              this.preloginSuccess = preloginResponse.status === 'Success';
              if (this.preloginSuccess) {
                this.authMethod = preloginResponse['saml-auth-method'];
                this.samlRequest = preloginResponse['saml-request'];
                resolve(this.preloginSuccess);
              } else {
                reject(preloginResponse.msg);
              }
              return resp;
            }
          ]
        }
      }).catch(reject);
    });
  }

  async doSamlAuth() {
    if (!this.preloginSuccess) {
      throw new Error('[Portal] Do prelogin first or the last prelogin has failure.');
    }
    const win = new LoginWindow(this.hostname);
    win.createWindow(this.samlRequest, this.isRedirect());
    const {preloginCookie, samlUsername} = await win.samlResponse;
    this.preloginCookie = preloginCookie;
    this.samlUsername = samlUsername;
  }

  getConfig() {
    if (!this.preloginCookie) {
      throw new Error('[Portal] Do SAML auth first or the last SAML auth has failure.');
    }
    return new Promise((resolve, reject) => {
      got(`https://${this.hostname}/global-protect/getconfig.esp`, {
        method: 'POST',
        headers: {
          'User-Agent': userAgent
        },
        form: {
          'prelogin-cookie': this.preloginCookie,
          'user': this.samlUsername
        },
        hooks: {
          afterResponse: [
            async (resp) => {
              this.updateFingerprint(resp);
              if (resp.statusCode === 200) {
                this.config = await unmarshall(resp.body);
                log.debug('[Portal] Portal config - %s', JSON.stringify(this.config, null, 2));
                // pass [username, password, portalUserAuthCookie] to gateway
                this.policy = this.config.policy;
                this.portalUserAuthCookie = this.policy['portal-userauthcookie'];
                this.userEmail = this.policy['user-email'];
                this.portalPreloginUserAuthCookie = this.policy['portal-preloginuserauthcookie'];
                resolve({
                  userName: this.samlUsername,
                  portalUserAuthCookie: this.portalUserAuthCookie,
                  portalPreloginUserAuthCookie: this.portalPreloginUserAuthCookie,
                  userEmail: this.userEmail
                });
              } else {
                reject(resp.statusMessage);
              }
              return resp;
            }
          ]
        }
      }).catch(reject);
    });
  }

  isRedirect() {
    return this.authMethod === 'REDIRECT';
  }
}

class Gateway extends NetworkEndpoint {
  constructor(hostname, portalUserAuthCookie, samlUsername) {
    super();
    this.hostname = hostname;
    this.portalUserAuthCookie = portalUserAuthCookie;
    this.samlUsername = samlUsername;
  }

  doPrelogin() {
    return new Promise((resolve, reject) => {
      got(`https://${this.hostname}/ssl-vpn/prelogin.esp`, {
        method: 'POST',
        headers: {
          'User-Agent': userAgent
        },
        searchParams: {
          'tmp': 'tmp',
          'kerberos-support': 'yes',
          'ipv6-support': 'yes',
          'clientVer': '4100',
          'clientos': 'Linux'
        },
        hooks: {
          afterResponse: [
            async (resp) => {
              this.updateFingerprint(resp);
              log.debug('[Gateway] The SAML response after prelogin - %s', resp);
              const samlResponse = await unmarshall(resp.body);
              const preloginResponse = samlResponse['prelogin-response'];
              this.preloginSuccess = preloginResponse.status === 'Success';
              if (this.preloginSuccess) {
                this.authMethod = preloginResponse['saml-auth-method'];
                this.samlRequest = preloginResponse['saml-request'];
                resolve(this.preloginSuccess);
              } else {
                reject(preloginResponse.msg);
              }
              return resp;
            }
          ]
        }
      }).catch(reject);
    });
  }

  doLogin() {
    if (!this.portalUserAuthCookie || !this.samlUsername) {
      throw new Error('[Gateway] Do prelogin first or the last prelogin has failure.');
    }
    return new Promise((resolve, reject) => {
      got(`https://${this.hostname}/ssl-vpn/login.esp`, {
        method: 'POST',
        headers: {
          'User-Agent': userAgent
        },
        form: {
          'portal-userauthcookie': this.portalUserAuthCookie,
          'clientos': 'linux',
          'user': this.samlUsername,
          'ok': 'Login',
          'direct': 'yes',
          'jnlpReady': 'jnlpReady',
          'computer': os.hostname(),
          'clientVer': '4100'
        },
        hooks: {
          afterResponse: [
            async (resp) => {
              const rawLoginResp = await unmarshall(resp.body);
              const loginResp = this.__createLoginResp(rawLoginResp);
              log.debug('[Gateway] The login response - %s', JSON.stringify(loginResp, null, 2));
              resolve(loginResp);
              return resp;
            }
          ]
        }
      }).catch(reject);
    });
  }

  __createLoginResp(rawLoginResp) {
    const args = rawLoginResp.jnlp['application-desc'].argument;
    return {
      authcookie: args[1],
      portal: args[3],
      user: args[4],
      domain: args[7],
      'preferred-ip': args[15],
      computer: os.hostname()
    };
  }
}


module.exports = {Gateway, Portal};
