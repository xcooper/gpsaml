import * as os from 'os';
import * as path from 'path';

const appName = '.gpsaml';
const userAgent = 'PAN GlobalProtect';
const configPath = path.join(os.homedir(), appName, 'config.json');
const portalCachePath = path.join(os.homedir(), appName, 'portal.json');
const gatewaysCachePath = path.join(os.homedir(), appName, 'gateways.json');

export {
  userAgent,
  configPath,
  portalCachePath,
  gatewaysCachePath
};
