const opts = require('node-getopt').create([
  ['h', 'host=ARG', 'The hostname of VPN server.'],
  ['g', 'gateway=ARG', 'The prefered gateway.']
])
.bindHelp()
.parseSystem()

module.exports = { opts }
