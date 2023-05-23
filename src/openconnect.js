const {userAgent} = require("./consts");
const {URLSearchParams} = require("url");
const {exec} = require('child_process');
const log = require("loglevel");

function connectVpn(
  loginResp,
  samlUsername,
  fingerprint,
  hostname
) {
  let cookie = new URLSearchParams(loginResp);
  const proc = exec(
    // should handle differently on different OS, this is on Windows.
    `sudo --new openconnect --dump-http-traffic --protocol=gp -u ${loginResp.domain}\\${samlUsername} --os=linux --version-string="Ubuntu Linux" --useragent="${userAgent}" --cookie="${cookie.toString()}" --servercert ${fingerprint} ${hostname}`,
    (error, stdout, stderr) => {
      if (error) {
        throw error;
      }
      console.log('stdout: ' + stdout);
    }
  );
}

module.exports = {connectVpn};
