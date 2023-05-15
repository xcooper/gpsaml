const process = require("node:process");
const {create} = require("node-getopt");

const opts = create([
  ['', 'debug', 'Debug this command by providing more details.'],
  ['h', 'host=ARG', 'The hostname of VPN server.'],
  ['g', 'gateway=ARG', 'The prefered gateway name.'],
  ['k', 'key=ARG', 'The portal user key.'],
  ['u', 'user=ARG', 'The user name.']
]).bindHelp().parseSystem();

if (!opts.options.host) {
  console.error('The hostname is mandatory.');
  process.exit(1);
}

module.exports = {opts};
