#!/usr/bin/env bash
# Build, sign, (notarize), zip and publish a macOS Apple Silicon release.
#
# Usage:   scripts/release.sh <version-tag>
# Example: scripts/release.sh v0.2.0
#
# Signing path is selected by environment variables:
#
#   APPLE_SIGN_ID      "Developer ID Application: Your Name (TEAMID)"
#                      When set, the build is signed with the Developer ID
#                      certificate, hardened runtime is enabled, and the
#                      bundle is submitted to Apple's notary service and
#                      stapled.
#
#                      When unset, the build is ad-hoc signed only.
#                      End users will need `xattr -cr` on first launch.
#
# When APPLE_SIGN_ID is set, ONE of the following auth blocks is required:
#
#   App-specific password:
#     APPLE_ID         "you@example.com"
#     APPLE_TEAM_ID    "TEAMID"
#     APPLE_APP_PWD    "xxxx-xxxx-xxxx-xxxx" from appleid.apple.com
#
#   API key:
#     APPLE_API_KEY    /path/to/AuthKey_KEYID.p8
#     APPLE_API_KEY_ID "KEYID"
#     APPLE_API_ISSUER "ISSUER-UUID"
#
# Optional overrides:
#   GPSAML_RELEASE_REPO     default: HerbertChu/gpsaml
#   GPSAML_RELEASE_BRANCH   default: current branch

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <version-tag>  (e.g. v0.2.0)" >&2
  exit 1
fi

TAG="$1"
if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]]; then
  echo "Tag must look like v<major>.<minor>.<patch> — got '$TAG'" >&2
  exit 1
fi

REPO="${GPSAML_RELEASE_REPO:-HerbertChu/gpsaml}"
TARGET_BRANCH="${GPSAML_RELEASE_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$PROJECT_ROOT/release/gpsaml-darwin-arm64/gpsaml.app"
ZIP="$PROJECT_ROOT/release/gpsaml-${TAG}-darwin-arm64.zip"

cd "$PROJECT_ROOT"

# Bail if working tree dirty — the zip wouldn't match the tag in git.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree has uncommitted changes — commit or stash first." >&2
  exit 1
fi

# Decide signing strategy.
SIGN_MODE="adhoc"
NOTARYTOOL_AUTH=()
if [[ -n "${APPLE_SIGN_ID:-}" ]]; then
  if [[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_ID:-}" && -n "${APPLE_API_ISSUER:-}" ]]; then
    SIGN_MODE="notarized"
    NOTARYTOOL_AUTH=(--key "$APPLE_API_KEY" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER")
  elif [[ -n "${APPLE_ID:-}" && -n "${APPLE_TEAM_ID:-}" && -n "${APPLE_APP_PWD:-}" ]]; then
    SIGN_MODE="notarized"
    NOTARYTOOL_AUTH=(--apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_APP_PWD")
  else
    echo "APPLE_SIGN_ID is set but no notary credentials are present." >&2
    echo "Set either APPLE_ID + APPLE_TEAM_ID + APPLE_APP_PWD," >&2
    echo "or APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER." >&2
    exit 1
  fi

  if ! security find-identity -v -p codesigning | grep -Fq "$APPLE_SIGN_ID"; then
    echo "Signing identity '$APPLE_SIGN_ID' is not in the keychain." >&2
    echo "Install it via Xcode > Settings > Accounts > Manage Certificates." >&2
    exit 1
  fi
fi

echo "==> Packaging gpsaml.app for darwin-arm64"
npm run package:mac

if [[ "$SIGN_MODE" == "notarized" ]]; then
  echo "==> Signing with Developer ID + hardened runtime"
  codesign --force --deep \
    --sign "$APPLE_SIGN_ID" \
    --options runtime \
    --timestamp \
    "$APP"
  codesign --verify --deep --strict --verbose=2 "$APP"

  echo "==> Creating zip for notary submission"
  rm -f "$ZIP"
  ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"

  echo "==> Submitting to Apple notary service (this can take several minutes)"
  xcrun notarytool submit "$ZIP" "${NOTARYTOOL_AUTH[@]}" --wait

  echo "==> Stapling notary ticket onto the bundle"
  xcrun stapler staple "$APP"
  xcrun stapler validate "$APP"

  echo "==> Re-zipping with stapled ticket"
  rm -f "$ZIP"
  ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"

  RELEASE_NOTES_INSTALL=$(cat <<'EOF'
1. Download the zip below.
2. Unzip and drag `gpsaml.app` into `/Applications`.
3. Double-click to launch — the bundle is signed with a Developer ID
   certificate and notarized by Apple, so no Gatekeeper workaround is
   needed.
EOF
)
  RELEASE_NOTES_BUILD="Signed with Developer ID and notarized."
else
  echo "==> Ad-hoc signing the bundle (no APPLE_SIGN_ID set)"
  codesign --force --deep --sign - "$APP"
  codesign -dv --verbose=2 "$APP" 2>&1 | grep -E "Signature|Identifier|Format" || true

  echo "==> Creating zip"
  rm -f "$ZIP"
  ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"

  RELEASE_NOTES_INSTALL=$(cat <<'EOF'
1. Download the zip below.
2. Unzip and drag `gpsaml.app` into `/Applications`.
3. If macOS shows _"gpsaml.app is damaged and can't be opened"_, strip
   the Gatekeeper quarantine flag (this build is ad-hoc signed but not
   notarized):
   ```
   xattr -cr /Applications/gpsaml.app
   ```
EOF
)
  RELEASE_NOTES_BUILD="Ad-hoc signed (not notarized). End users may need \`xattr -cr\` on first launch."
fi

ls -lh "$ZIP"

echo "==> Creating GitHub release $TAG on $REPO (target $TARGET_BRANCH)"
gh release create "$TAG" \
  --repo "$REPO" \
  --target "$TARGET_BRANCH" \
  --title "$TAG" \
  --notes-file - \
  "$ZIP" <<EOF
Pre-built macOS Apple Silicon build. ${RELEASE_NOTES_BUILD}

## Install

${RELEASE_NOTES_INSTALL}

## Requirements
- \`openconnect\` HEAD (mainline 9.12 has a HIP segfault):
  \`\`\`
  brew uninstall openconnect 2>/dev/null
  brew install --HEAD openconnect
  \`\`\`

See README on the branch for details.
EOF

echo "==> Done."
