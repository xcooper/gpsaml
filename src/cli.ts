import * as process from "node:process";
import nodeGetopt from "node-getopt";

interface CliOptions {
  debug?: boolean;
  host?: string;
  gateway?: string;
  key?: string;
  user?: string;
}

const opts = nodeGetopt
  .create([
    ["", "debug", "Debug this command by providing more details."],
    ["h", "host=ARG", "The hostname of VPN server."],
    ["g", "gateway=ARG", "The prefered gateway name."],
    ["k", "key=ARG", "The portal user key."],
    ["u", "user=ARG", "The user name."],
  ])
  .bindHelp()
  .parseSystem() as { options: CliOptions; argv: string[] };

if (!opts.options.host) {
  console.error("The hostname is mandatory.");
  process.exit(1);
}

export { opts, CliOptions };
