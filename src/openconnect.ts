import { userAgent } from "./consts";
import { URLSearchParams } from "url";
import { spawn, execFileSync, ChildProcess } from "child_process";
import { existsSync } from "fs";
import * as log from "loglevel";

// On macOS, sudo-prompt invokes the relaunched Electron via /usr/bin/security,
// inheriting only a minimal PATH that does not include Homebrew. Prepend the
// common Homebrew bin directories so plain `openconnect` resolves.
function spawnEnv(): NodeJS.ProcessEnv {
  if (process.platform !== "darwin") return process.env;
  const extra = ["/opt/homebrew/bin", "/usr/local/bin"];
  const current = (process.env.PATH ?? "").split(":").filter(Boolean);
  const merged = [...extra, ...current].filter((p, i, a) => a.indexOf(p) === i);
  return { ...process.env, PATH: merged.join(":") };
}

// Locate the HIP report wrapper script bundled with openconnect. GlobalProtect
// gateways with HIP enforcement require a HIP report on connect; openconnect
// delegates the report generation to this script via `--csd-wrapper`.
// Override with the HIP_SCRIPT env var.
function findHipScript(): string | undefined {
  if (process.env.HIP_SCRIPT) return process.env.HIP_SCRIPT;
  const candidates: string[] = [];
  if (process.platform === "darwin") {
    try {
      const prefix = execFileSync("/opt/homebrew/bin/brew", [
        "--prefix",
        "openconnect",
      ])
        .toString()
        .trim();
      if (prefix) candidates.push(`${prefix}/libexec/openconnect/hipreport.sh`);
    } catch {
      // brew not installed or openconnect not managed by brew
    }
  } else {
    candidates.push(
      "/usr/share/openconnect/hipreport.sh",
      "/usr/lib/openconnect/hipreport.sh",
    );
  }
  return candidates.find((p) => existsSync(p));
}

interface LoginResponse {
  domain: string;
  user: string;
  [key: string]: string;
}

function connectVpn(
  loginResp: LoginResponse,
  samlUsername: string,
  fingerprint: string,
  hostname: string,
): ChildProcess {
  const cookie = new URLSearchParams(loginResp as Record<string, string>);

  const isWin = process.platform === "win32";
  const args = [
    "--dump-http-traffic",
    "--protocol=gp",
    "-u",
    `${loginResp.domain}\\${samlUsername}`,
    "--os=linux",
    `--useragent=${userAgent}`,
    `--cookie=${cookie.toString()}`,
    "--version-string=Ubuntu Linux",
    "--servercert",
    fingerprint,
  ];

  const hipScript = findHipScript();
  if (hipScript) {
    args.push(`--csd-wrapper=${hipScript}`);
  } else {
    log.warn(
      "hipreport.sh not found; gateways enforcing HIP may reject the connection. " +
        "Set HIP_SCRIPT to override.",
    );
  }

  args.push(hostname);

  if (!isWin) {
    args.push();
  }

  console.log(`Spawning openconnect with args: ${args.join(" ")}`);

  const child = spawn("openconnect", args, { env: spawnEnv() });

  child.stdout.on("data", (data) => {
    console.log(`[VPN STDOUT]: ${data}`);
  });

  child.stderr.on("data", (data) => {
    console.error(`[VPN STDERR]: ${data}`);
  });

  child.on("close", (code) => {
    console.log(`openconnect exited with code ${code}`);
  });

  child.on("error", (err) => {
    console.error("Failed to start openconnect process:", err);
  });

  return child;
}

export { connectVpn, LoginResponse };
