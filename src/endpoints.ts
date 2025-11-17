import { parseStringPromise } from "xml2js";
import * as os from "os";
import got, { Response } from "got";
import * as log from "loglevel";
import { userAgent } from "./consts";
import { LoginWindow } from "./vpn-connect-window";
import { TLSSocket } from "tls";
import * as https from "https";

// HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

interface PreloginResponse {
  status: string;
  msg?: string;
  "saml-auth-method"?: string;
  "saml-request"?: string;
}

interface PortalConfig {
  policy?: {
    "portal-userauthcookie"?: string;
    "user-email"?: string;
    "portal-preloginuserauthcookie"?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface PortalAuthResult {
  userName: string;
  portalUserAuthCookie: string;
  portalPreloginUserAuthCookie: string;
  userEmail: string;
}

interface GatewayLoginResponse {
  authcookie: string;
  portal: string;
  user: string;
  domain: string;
  "preferred-ip": string;
  computer: string;
  [key: string]: string;
}

const unmarshall = async (rawResponse: string): Promise<any> => {
  return parseStringPromise(rawResponse, {
    explicitArray: false,
  });
};

class NetworkEndpoint {
  public fingerprint: string | null;

  constructor() {
    this.fingerprint = null;
  }

  protected updateFingerprint(resp: Response): void {
    const socket = resp.socket as TLSSocket;
    this.fingerprint = socket
      .getPeerCertificate()
      .fingerprint.replaceAll(":", "");
    log.debug("Fingerprint updated - %s", this.fingerprint);
  }
}

class Portal extends NetworkEndpoint {
  private hostname: string;
  private authMethod: string;
  private samlUsername: string | string[] | null;
  private preloginCookie: string | string[] | null;
  private preloginSuccess: boolean;
  private samlRequest: string | null;
  private config?: PortalConfig;
  private policy?: any;
  private portalUserAuthCookie?: string;
  private userEmail?: string;
  private portalPreloginUserAuthCookie?: string;

  constructor(hostname: string) {
    super();
    this.hostname = hostname;
    this.authMethod = "REDIRECT";
    this.samlUsername = null;
    this.preloginCookie = null;
    this.preloginSuccess = false;
    this.samlRequest = null;
  }

  doPrelogin(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      got(`https://${this.hostname}/global-protect/prelogin.esp`, {
        method: "POST",
        headers: {
          "User-Agent": userAgent,
        },
        searchParams: {
          tmp: "tmp",
          "kerberos-support": "yes",
          "ipv6-support": "yes",
          clientVer: "4100",
          clientos: "Linux",
        },
        agent: {
          https: httpsAgent,
        },
        hooks: {
          afterResponse: [
            async (resp) => {
              this.updateFingerprint(resp);
              log.debug("[Portal] The SAML response after prelogin - %s", resp);
              const samlResponse = await unmarshall(resp.body as string);
              const preloginResponse: PreloginResponse =
                samlResponse["prelogin-response"];
              this.preloginSuccess = preloginResponse.status === "Success";
              if (this.preloginSuccess) {
                this.authMethod =
                  preloginResponse["saml-auth-method"] || "REDIRECT";
                this.samlRequest = preloginResponse["saml-request"] || null;
                resolve(this.preloginSuccess);
              } else {
                reject(preloginResponse.msg);
              }
              return resp;
            },
          ],
        },
      }).catch(reject);
    });
  }

  async doSamlAuth(): Promise<void> {
    if (!this.preloginSuccess) {
      throw new Error(
        "[Portal] Do prelogin first or the last prelogin has failure.",
      );
    }
    const win = new LoginWindow(this.hostname);
    win.createWindow(this.samlRequest!, this.isRedirect());
    const { preloginCookie, samlUsername } = await win.samlResponse;
    this.preloginCookie = preloginCookie;
    this.samlUsername = samlUsername;
    // Wait for window to close
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  getConfig(): Promise<PortalAuthResult> {
    if (!this.preloginCookie) {
      throw new Error(
        "[Portal] Do SAML auth first or the last SAML auth has failure.",
      );
    }
    return new Promise((resolve, reject) => {
      got(`https://${this.hostname}/global-protect/getconfig.esp`, {
        method: "POST",
        headers: {
          "User-Agent": userAgent,
        },
        form: {
          "prelogin-cookie": this.preloginCookie,
          user: this.samlUsername,
        },
        agent: {
          https: httpsAgent,
        },
        hooks: {
          afterResponse: [
            async (resp) => {
              this.updateFingerprint(resp);
              if (resp.statusCode === 200) {
                this.config = (await unmarshall(
                  resp.body as string,
                )) as PortalConfig;
                log.debug(
                  "[Portal] Portal config - %s",
                  JSON.stringify(this.config, null, 2),
                );
                // pass [username, password, portalUserAuthCookie] to gateway
                this.policy = this.config.policy;
                this.portalUserAuthCookie =
                  this.policy?.["portal-userauthcookie"];
                this.userEmail = this.policy?.["user-email"];
                this.portalPreloginUserAuthCookie =
                  this.policy?.["portal-preloginuserauthcookie"];
                resolve({
                  userName: this.samlUsername as string,
                  portalUserAuthCookie: this.portalUserAuthCookie!,
                  portalPreloginUserAuthCookie:
                    this.portalPreloginUserAuthCookie!,
                  userEmail: this.userEmail!,
                });
              } else {
                reject(resp.statusMessage);
              }
              return resp;
            },
          ],
        },
      }).catch(reject);
    });
  }

  isRedirect(): boolean {
    return this.authMethod === "REDIRECT";
  }
}

class Gateway extends NetworkEndpoint {
  public hostname: string;
  private portalUserAuthCookie: string;
  private samlUsername: string;
  private preloginSuccess?: boolean;
  private authMethod?: string;
  private samlRequest?: string;

  constructor(
    hostname: string,
    portalUserAuthCookie: string,
    samlUsername: string,
  ) {
    super();
    this.hostname = hostname;
    this.portalUserAuthCookie = portalUserAuthCookie;
    this.samlUsername = samlUsername;
  }

  doPrelogin(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      got(`https://${this.hostname}/ssl-vpn/prelogin.esp`, {
        method: "POST",
        headers: {
          "User-Agent": userAgent,
        },
        searchParams: {
          tmp: "tmp",
          "kerberos-support": "yes",
          "ipv6-support": "yes",
          clientVer: "4100",
          clientos: "Linux",
        },
        agent: {
          https: httpsAgent,
        },
        hooks: {
          afterResponse: [
            async (resp) => {
              this.updateFingerprint(resp);
              log.debug(
                "[Gateway] The SAML response after prelogin - %s",
                resp,
              );
              const samlResponse = await unmarshall(resp.body as string);
              const preloginResponse: PreloginResponse =
                samlResponse["prelogin-response"];
              this.preloginSuccess = preloginResponse.status === "Success";
              if (this.preloginSuccess) {
                this.authMethod = preloginResponse["saml-auth-method"];
                this.samlRequest = preloginResponse["saml-request"];
                resolve(this.preloginSuccess);
              } else {
                reject(preloginResponse.msg);
              }
              return resp;
            },
          ],
        },
      }).catch(reject);
    });
  }

  doLogin(): Promise<GatewayLoginResponse> {
    if (!this.portalUserAuthCookie || !this.samlUsername) {
      throw new Error(
        "[Gateway] Do prelogin first or the last prelogin has failure.",
      );
    }
    return new Promise((resolve, reject) => {
      got(`https://${this.hostname}/ssl-vpn/login.esp`, {
        method: "POST",
        headers: {
          "User-Agent": userAgent,
        },
        form: {
          "portal-userauthcookie": this.portalUserAuthCookie,
          clientos: "linux",
          user: this.samlUsername,
          ok: "Login",
          direct: "yes",
          jnlpReady: "jnlpReady",
          computer: os.hostname(),
          clientVer: "4100",
        },
        agent: {
          https: httpsAgent,
        },
        hooks: {
          afterResponse: [
            async (resp) => {
              const rawLoginResp = await unmarshall(resp.body as string);
              const loginResp = this.__createLoginResp(rawLoginResp);
              log.debug(
                "[Gateway] The login response - %s",
                JSON.stringify(loginResp, null, 2),
              );
              resolve(loginResp);
              return resp;
            },
          ],
        },
      }).catch(reject);
    });
  }

  private __createLoginResp(rawLoginResp: any): GatewayLoginResponse {
    const args = rawLoginResp.jnlp["application-desc"].argument;
    return {
      authcookie: args[1],
      portal: args[3],
      user: args[4],
      domain: args[7],
      "preferred-ip": args[15],
      computer: os.hostname(),
    };
  }
}

export { Gateway, Portal, PortalAuthResult, GatewayLoginResponse };
