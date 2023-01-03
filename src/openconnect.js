const { userAgent } = require('./consts');

function connectVpn(
  preloginCookie,
  gateway,
  samlUsername,
  fingerprint,
  hostname
) {
  console.log(`echo ${preloginCookie}|sudo openconnect --authgroup="${gateway}" --protocol=gp --user=${samlUsername} --os=linux --passwd-on-stdin --servercert ${fingerprint} --usergroup=portal:prelogin-cookie --useragent="${userAgent}" ${hostname}`);
}

module.exports = { connectVpn };