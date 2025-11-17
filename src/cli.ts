import * as process from "node:process";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

interface CliOptions {
  debug?: boolean;
  host?: string;
  gateway?: string;
  key?: string;
  user?: string;
}

const opts = yargs(hideBin(process.argv))
  .option("debug", {
    type: "boolean",
    description: "Debug this command by providing more details.",
  })
  .option("host", {
    type: "boolean",
    description: "The hostname of VPN server.",
  })
  .option("gateway", {
    type: "boolean",
    description: "The prefered gateway name.",
  })
  .option("key", {
    type: "boolean",
    description: "The portal user key.",
  })
  .option("user", {
    type: "string",
    description: "The user name.",
  })
  .parse() as CliOptions;

// Host becomes optional; if absent we fall back to GUI form.
if (!opts.host) {
  console.log("No host provided via CLI; launching host input window.");
}

export { opts, CliOptions };
