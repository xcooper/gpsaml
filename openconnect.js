const { userAgent } = require('./consts')

async function connectVpn(params) {
  console.log(`echo '${preloginCookie}' | sudo openconnect --xmlconfig ${xmlconfigFile} --authgroup='${gateway}' --protocol=gp --user=${samlUsername} --os=linux --passwd-on-stdin --servercert ${serverCertFp} --usergroup=portal:prelogin-cookie --useragent='${userAgent}' ${hostname}`)
}

module.exports { connectVpn }