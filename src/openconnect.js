const { userAgent } = require('./consts');
const { URLSearchParams } = require('url');

function connectVpn(
  loginResp,
  gateway,
  samlUsername,
  fingerprint,
  hostname
) {
  var params = new URLSearchParams(loginResp);
  console.log(`echo ${params.toString()} | sudo openconnect --dump-http-traffic --protocol=gp -u ${loginResp.domain}\\${samlUsername} --os=linux --version-string="Ubuntu Linux" --useragent="${userAgent}" --cookie-on-stdin --servercert ${fingerprint} ${hostname}`);
}

module.exports = { connectVpn };