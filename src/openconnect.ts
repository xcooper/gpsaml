import { userAgent } from "./consts";
import { URLSearchParams } from "url";
import { exec } from "@expo/sudo-prompt";

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
  exec(
    `openconnect --dump-http-traffic --protocol=gp -u ${loginResp.domain}\\${samlUsername} --os=linux --version-string="Ubuntu Linux" --useragent="${userAgent}" --cookie="${cookie.toString()}" --servercert ${fingerprint} ${hostname}`,
    {
      name: "openconnect",
    },
    (
      error?: Error | null,
      stdout?: string | Buffer,
      stderr?: string | Buffer,
    ) => {
      if (error) {
        throw error;
      }
      console.log("stdout: " + stdout);
    },
  );
}

export { connectVpn, LoginResponse };
