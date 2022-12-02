const opts = require('node-getopt').create([
  ['', 'debug', 'Debug this command by providing more details.'],
  ['h', 'host=ARG', 'The hostname of VPN server.'],
  ['g', 'gateway=ARG', 'The prefered gateway name.']
])
.bindHelp()
.parseSystem()

module.exports = { opts }
