const { userAgent } = require('./consts')
const got = require('got')

class Portal {
  constructor(hostname) {
    this.hostname = hostname
  }

  function prelogin() {
    return new Promise((resolve, reject) => {
      got(`https://${this.hostname}/global-protect/prelogin.esp?tmp=tmp&kerberos-support=yes&ipv6-support=yes&clientVer=4100&clientos=Linux`, {
        method: 'POST',
        headers: {
          'User-Agent': userAgent
        },
        hooks: {
          afterResponse: [
            (resp, opts) => {
              this.fingerprint = resp.socket.getPeerCertificate().fingerprint.replaceAll(':', '')
              this.samlResponse = await this.#parseSamlRequest(resp.body)['prelogin-response']
              this.success = this.samlResponse['status'] === 'Success'
              this.authMethod = this.samlResponse['saml-auth-method']
              if (this.success) {
                resolve(this.samlResponse['saml-request'])
              } else {
                reject(this.samlResponse['msg'])
              }
            }
          ]
        }
      })
    })
  }

  async function #parseSamlRequest(rawResponse) {
    return parseStringPromise(rawResponse, {
      explicitArray: false
    })
  }
}

module.exports = Portal