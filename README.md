# gpsaml — SAML add-on for the GlobalProtect protocol

A small Electron utility that authenticates against a GlobalProtect
portal via SAML, then brings up the tunnel through `openconnect`.
The flow is a guided three-window sequence (portal → gateway → live
tunnel) with a menu-bar tray on macOS so the connection stays
reachable when the window is closed.

## Prerequisites

### `openconnect`

GlobalProtect HIP enforcement currently crashes the 9.12 stable
release of openconnect. Build the master branch via Homebrew until a
patched release lands:

```sh
brew uninstall openconnect 2>/dev/null
brew install --HEAD openconnect
```

On Linux, install `openconnect` from your distribution's package
manager. The bundled `hipreport.sh` is auto-detected from
`/usr/share/openconnect` or `/usr/lib/openconnect`.

On Windows, install via the [official GUI installer](https://openconnect.github.io/openconnect-gui/),
plus `gsudo` (`winget install gsudo`) for the elevated tunnel.

### sudo / admin

The tunnel device needs root. On macOS / Linux, `sudo` is fine. On
Windows, `gsudo` provides the equivalent.

## Run from source

```sh
npm install
npm start
```

You'll be prompted for sudo, then the portal-input window opens.
Enter the host (e.g. `vpn.example.com`), authenticate via SAML in the
popup, pick a gateway, and the connection-status window appears.
Closing it minimizes to the menu bar; the tunnel keeps running until
you click Disconnect from the window or the tray menu.

## Pre-built macOS app

Pre-built Apple Silicon builds are attached to releases under the
**Releases** tab. Download `gpsaml-vX.X.X-darwin-arm64.zip`, unzip,
and drag `gpsaml.app` into `/Applications`.

The bundle is ad-hoc signed but not notarized. On recent macOS
(Sonoma and later), Gatekeeper may still display:

> "gpsaml.app" is damaged and can't be opened. You should move it to
> the Trash.

This is the quarantine attribute, not real damage. Strip it with:

```sh
xattr -cr /Applications/gpsaml.app
```

Then double-click as usual.

## Configuration

Override behavior with these environment variables (set before
launching):

| Variable     | Purpose                                           | Default                                    |
| ------------ | ------------------------------------------------- | ------------------------------------------ |
| `HIP_SCRIPT` | Absolute path to a HIP report wrapper script      | Auto-detected from the openconnect install |
| `GPSAML_LOG` | Path for the elevated process's stdout/stderr log | `/tmp/gpsaml.log`                          |

## Protocol reference

[PAN GlobalProtect protocol notes](https://github.com/dlenski/openconnect/blob/master/PAN_GlobalProtect_protocol_doc.md)
in the openconnect / dlenski tree.
