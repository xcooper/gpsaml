const { userAgent } = require('./consts');
const parseStringPromise = require('xml2js').parseStringPromise;
const got = require('got');

class Portal {
  constructor(hostname) {
    this.hostname = hostname;
  }

  prelogin() {
    return new Promise((resolve, reject) => {
      got(`https://${this.hostname}/global-protect/prelogin.esp?tmp=tmp&kerberos-support=yes&ipv6-support=yes&clientVer=4100&clientos=Linux`, {
        method: 'POST',
        headers: {
          'User-Agent': userAgent
        },
        hooks: {
          afterResponse: [
            async (resp, opts) => {
              this.fingerprint = resp.socket.getPeerCertificate().fingerprint.replaceAll(':', '');
              this.samlResponse = await this._parseSamlRequest(resp.body);
              const preloginResp = this.samlResponse['prelogin-response'];
              this.success = preloginResp.status === 'Success';
              this.authMethod = preloginResp['saml-auth-method'];
              if (this.success) {
                resolve(preloginResp['saml-request']);
              } else {
                reject(preloginResp.msg);
              }
              return resp;
            }
          ]
        }
      })
      .catch(reject);
    });
  }

  _parseSamlRequest(rawResponse) {
    return parseStringPromise(rawResponse, {
      explicitArray: false
    });
  }
}

module.exports = { Portal };