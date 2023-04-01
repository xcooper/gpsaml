const { userAgent } = require('./consts');
const https = require('node:https');
const parseStringPromise = require('xml2js').parseStringPromise;
const got = require('got');
const log = require('loglevel');

class Gateway {
	constructor() {
		// this.config = config;
	}

	doPrelogin(hostname) {
		return new Promise((resolve, reject) => {
			got(`https://${hostname}/ssl-vpn/prelogin.esp`, {
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
						(resp, opts) => {
							resolve({
								preloginResp: resp.body,
								fingerprint: resp.socket.getPeerCertificate().fingerprint.replaceAll(':', '')
							});
						}
					]
				}
			});
		});
	}

	doLogin(portalUserAuthCookie) {
		return new Promise((resolve, reject) => {
			got(`https://taipei-vpn.commscope.com/ssl-vpn/login.esp`, {
				method: 'POST',
				headers: {
					'User-Agent': userAgent
				},
				form: {
					'portal-userauthcookie': portalUserAuthCookie,
					'clientos': 'linux',
					'user': 'commscope\\chsiao',
					'ok': 'Login',
					'direct': 'yes',
					'jnlpReady': 'jnlpReady',
					'computer': 'Cooper-Surface',
					'clientVer': '4100'
				},
				hooks: {
					afterResponse: [
						async (resp, opts) => {
							var jnlp = await this._parseLoginResponse(resp.body);
							log.debug('login response - %s', JSON.stringify(jnlp, null, 2));
							resolve(jnlp);
							return resp;
						}
					]
				}
			});
		});
	}

  _parseLoginResponse(rawResponse) {
    return parseStringPromise(rawResponse, {
      explicitArray: false
    });
  }
}

module.exports = { Gateway };