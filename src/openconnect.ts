import { userAgent } from "./consts";
import { URLSearchParams } from "url";
import { spawn, ChildProcess } from "child_process";

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
    hostname,
  ];

  if (!isWin) {
    args.push();
  }

  console.log(`Spawning openconnect with args: ${args.join(" ")}`);

  const child = spawn("openconnect", args);

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
