const { userAgent } = require('./consts');
const parseStringPromise = require('xml2js').parseStringPromise;
const got = require('got');
const log = require('loglevel');

class Portal {
  constructor(hostname) {
    this.hostname = hostname;
  }

  prelogin() {
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
            async (resp, opts) => {
              log.debug('the SAML response after prelogin - %s', resp);
              this.fingerprint = resp.socket.getPeerCertificate().fingerprint.replaceAll(':', '');
              this.samlResponse = await this._parseSamlRequest(resp.body);
              this.preloginResp = this.samlResponse['prelogin-response'];
              this.success = this.preloginResp.status === 'Success';
              this.authMethod = this.preloginResp['saml-auth-method'];
              if (this.success) {
                resolve(this.preloginResp['saml-request']);
              } else {
                reject(this.preloginResp.msg);
              }
              return resp;
            }
          ]
        }
      })
      .catch(reject);
    });
  }

  getConfig(
    preloginCookie,
    samlUsername
  ) {
    return new Promise((resolve, reject) => {
      got(`https://${this.hostname}/global-protect/getconfig.esp`, {
        method: 'POST',
        headers: {
          'User-Agent': userAgent
        },
        form: {
          'prelogin-cookie': preloginCookie,
          'user': samlUsername
        },
        hooks: {
          afterResponse: [
            async (resp, opts) => {
              log.debug('the Config response - %s', resp);
              this.config = await this._parseConfig(resp.body);
              resolve(this.config);
            }
          ]
        }
      })
      .catch(reject);
    });
  }

  isRedirect() {
    return this.authMethod === 'REDIRECT';
  }

  _parseSamlRequest(rawResponse) {
    return parseStringPromise(rawResponse, {
      explicitArray: false
    });
  }

  _parseConfig(rawResponse) {
    return parseStringPromise(rawResponse, {
      explicitArray: false
    });
  }
}

module.exports = { Portal };
