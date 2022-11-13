const { userAgent } = require('./consts')
const https = require('node:https')
const got = require('got')

function doPrelogin(hostname) {
  return new Promise((resolve, reject) => {
    got(`https://${hostname}/global-protect/prelogin.esp?tmp=tmp&kerberos-support=yes&ipv6-support=yes&clientVer=4100&clientos=Linux`, {
      method: 'POST',
      userAgent: {
        headers: {
          'User-Agent': userAgent
        }
      },
      hooks: {
        afterResponse: [
          (resp, opts) => {
            resolve({
              preloginResp: resp.body,
              fingerprint: resp.socket.getPeerCertificate().fingerprint.replaceAll(':', '')
            })
          }
        ]
      }
    })
  })
}

module.exports = { doPrelogin }