const os = require('os');
const path = require("path");

const appName = '.gpsaml';
const userAgent = 'PAN GlobalProtect';
const configPath = path.join(os.homedir(), appName, 'config.json');
const portalCachePath = path.join(os.homedir(), appName, 'portal.json');
const gatewaysCachePath = path.join(os.homedir(), appName, 'gateways.json');

module.exports = {
  userAgent,
  configPath,
  portalCachePath,
  gatewaysCachePath
};
