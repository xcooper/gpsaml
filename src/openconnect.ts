import { userAgent } from "./consts";
import { URLSearchParams } from "url";
import { exec } from "child_process";
import * as log from "loglevel";

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
): void {
  const cookie = new URLSearchParams(loginResp as Record<string, string>);
  const proc = exec(
    // should handle differently on different OS, this is on Windows.
    `sudo --new openconnect --dump-http-traffic --protocol=gp -u ${loginResp.domain}\\${samlUsername} --os=linux --version-string="Ubuntu Linux" --useragent="${userAgent}" --cookie="${cookie.toString()}" --servercert ${fingerprint} ${hostname}`,
    (error, stdout, stderr) => {
      if (error) {
        throw error;
      }
      console.log("stdout: " + stdout);
    },
  );
}

export { connectVpn, LoginResponse };
