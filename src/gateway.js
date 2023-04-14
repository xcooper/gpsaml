const { userAgent } = require('./consts');
const https = require('node:https');
const parseStringPromise = require('xml2js').parseStringPromise;
const os = require('os');
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

	doLogin(userName, portalUserAuthCookie) {
		return new Promise((resolve, reject) => {
			got(`https://taiwan-vpn.commscope.com/ssl-vpn/login.esp`, {
				method: 'POST',
				headers: {
					'User-Agent': userAgent
				},
				form: {
					'portal-userauthcookie': portalUserAuthCookie,
					'clientos': 'linux',
					'user': userName,
					'ok': 'Login',
					'direct': 'yes',
					'jnlpReady': 'jnlpReady',
					'computer': os.hostname(),
					'clientVer': '4100'
				},
				hooks: {
					afterResponse: [
						async (resp, opts) => {
							var jnlp = await this._parseLoginResponse(resp.body);
							this.loginResp = this.createLoginResp(jnlp);
							log.debug('login response - %s', JSON.stringify(this.loginResp, null, 2));
							resolve(this.loginResp);
							return resp;
						}
					]
				}
			});
		});
	}

	createLoginResp(jnlp) {
		var args = jnlp['jnlp']['application-desc']['argument'];
		return {
			authcookie: args[1],
			portal: args[3],
			user: args[4],
			domain: args[7],
			"preferred-ip": args[15],
			computer: os.hostname()
		};
	}

  _parseLoginResponse(rawResponse) {
    return parseStringPromise(rawResponse, {
      explicitArray: false
    });
  }
}

module.exports = { Gateway };
