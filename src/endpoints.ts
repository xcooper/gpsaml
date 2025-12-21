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

interface GatewayEntry {
  $: {
    name: string;
  };
  description?: string;
  fqdn?: string;
  "priority-rule"?: {
    entry: {
      $: {
        name: string;
      };
      priority: string;
    };
  };
  manual: string;
}

interface Gateways {
  "cutoff-time": string;
  external: {
    list: {
      entry: GatewayEntry[];
    };
  };
}

interface AgentConfig {
  "save-user-credentials"?: string;
  "portal-2fa"?: string;
  "internal-gateway-2fa"?: string;
  "auto-discovery-external-gateway-2fa"?: string;
  "manual-only-gateway-2fa"?: string;
  "disconnect-reasons"?: string;
  uninstall?: string;
  "client-upgrade"?: string;
  "enable-signout"?: string;
  "allow-extend-session"?: string;
  "use-sso-pin"?: string;
  "use-sso-macos"?: string;
  "logout-remove-sso"?: string;
  "krb-auth-fail-fallback"?: string;
  "default-browser"?: string;
  "retry-tunnel"?: string;
  "retry-timeout"?: string;
  "traffic-enforcement"?: string;
  "enforce-globalprotect"?: string;
  "captive-portal-exception-timeout"?: string;
  "captive-portal-using-default-browser"?: string;
  "captive-portal-login-url"?: string;
  "traffic-blocking-notification-delay"?: string;
  "display-traffic-blocking-notification-msg"?: string;
  "traffic-blocking-notification-msg"?: string;
  "allow-traffic-blocking-notification-dismissal"?: string;
  "display-captive-portal-detection-msg"?: string;
  "captive-portal-detection-msg"?: string;
  "captive-portal-notification-delay"?: string;
  "certificate-store-lookup"?: string;
  "scep-certificate-renewal-period"?: string;
  "ext-key-usage-oid-for-client-cert"?: string;
  "full-chain-cert-verify"?: string;
  "retain-connection-smartcard-removal"?: string;
  "user-accept-terms-before-creating-tunnel"?: string;
  "rediscover-network"?: string;
  "wifi-to-wired-transition"?: string;
  "resubmit-host-info"?: string;
  "intelligent-portal"?: string;
  "can-continue-if-portal-cert-invalid"?: string;
  "access-gateway-from-agent-only"?: string;
  "user-switch-tunnel-rename-timeout"?: string;
  "pre-logon-tunnel-rename-timeout"?: string;
  "enable-cache-portal-config-absence-prelogon-tunnel"?: string;
  "preserve-tunnel-upon-user-logoff-timeout"?: string;
  "ipsec-failover-ssl"?: string;
  "display-tunnel-fallback-notification"?: string;
  "ssl-only-selection"?: string;
  "tunnel-mtu"?: string;
  "max-internal-gateway-connection-attempts"?: string;
  "adv-internal-host-detection"?: string;
  "delays-internal-host-detection"?: string;
  "unified-user-id-hybrid-deployment"?: string;
  "portal-timeout"?: string;
  "connect-timeout"?: string;
  "receive-timeout"?: string;
  "split-tunnel-option"?: string;
  "split-tunnel-option-mobile"?: string;
  "advanced-st-public-key"?: string;
  "enforce-dns"?: string;
  "append-local-search-domain"?: string;
  "flush-dns"?: string;
  "agent-proxy-port"?: string;
  "agent-proxy-mode"?: string;
  "auto-proxy-pac"?: string;
  "proxy-multiple-autodetect"?: string;
  "use-proxy"?: string;
  "enable-hip-remediation"?: string;
  "hip-remediation-retry"?: string;
  "hip-remediation-integrity-check"?: string;
  "wsc-autodetect"?: string;
  "mfa-enabled"?: string;
  "mfa-listening-port"?: string;
  "mfa-notification-msg"?: string;
  "mfa-prompt-suppress-time"?: string;
  "ipv6-preferred"?: string;
  "change-password-message"?: string;
  "measuring-egw-tcp-connection"?: string;
  "log-gateway"?: string;
  "cdl-log"?: string;
  "dem-notification"?: string;
  "dem-agent"?: string;
  "dem-agent-action"?: string;
  "quarantine-add-message"?: string;
  "quarantine-remove-message"?: string;
  "allow-disable-cbl"?: string;
  [key: string]: any;
}

interface AgentUi {
  "can-save-password"?: string;
  "agent-user-override-timeout"?: string;
  "max-agent-user-overrides"?: string;
  "welcome-page"?: {
    display: string;
    page: string;
  };
  "help-page"?: string;
  "help-page-2"?: string;
  "agent-user-override"?: string;
  "enable-advanced-view"?: string;
  "enable-do-not-display-this-welcome-page-again"?: string;
  "can-change-portal"?: string;
  "show-agent-icon"?: string;
  "password-expiry-message"?: string;
  "init-panel"?: string;
  "user-input-on-top"?: string;
  [key: string]: any;
}

interface HipCollection {
  "hip-report-interval"?: string;
  "max-wait-time"?: string;
  "collect-hip-data"?: string;
  default?: {
    category: {
      member: string[];
    };
  };
  "exclusion-v4"?: any;
  "custom-checks"?: any;
  [key: string]: any;
}

interface PortalConfig {
  policy: {
    "agent-user-override-key"?: string;
    "portal-name"?: string;
    "portal-config-version"?: string;
    version?: string;
    "client-role"?: string;
    gateways?: Gateways;
    "gateways-v6"?: Gateways;
    "agent-config"?: AgentConfig;
    "use-sso"?: string;
    "connect-method"?: string;
    "on-demand"?: string;
    "refresh-config"?: string;
    "refresh-config-interval"?: string;
    "agent-ui"?: AgentUi;
    "hip-collection"?: HipCollection;
    "portal-userauthcookie"?: string;
    "portal-prelogonuserauthcookie"?: string;
    "portal-preloginuserauthcookie"?: string;
    "config-digest"?: string;
    "user-email"?: string;
    [key: string]: any;
  };
}

interface PortalAuthResult {
  userName: string;
  portalUserAuthCookie: string;
  portalPreloginUserAuthCookie: string;
  userEmail: string;
  gateways: string[];
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
  private gateways?: string[] | null;

  constructor(hostname: string) {
    super();
    this.hostname = hostname;
    this.authMethod = "REDIRECT";
    this.samlUsername = null;
    this.preloginCookie = null;
    this.preloginSuccess = false;
    this.samlRequest = null;
    this.gateways = null;
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
                this.gateways =
                  this.policy?.gateways?.map((g: any) => g.hostname) ?? [];
                resolve({
                  userName: this.samlUsername as string,
                  portalUserAuthCookie: this.portalUserAuthCookie!,
                  portalPreloginUserAuthCookie:
                    this.portalPreloginUserAuthCookie!,
                  userEmail: this.userEmail!,
                  gateways: this.gateways!,
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
