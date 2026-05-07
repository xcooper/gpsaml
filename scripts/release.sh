#!/usr/bin/env bash
# Build, ad-hoc sign, zip and publish a macOS Apple Silicon release.
#
# Usage:   scripts/release.sh <version-tag>
# Example: scripts/release.sh v0.2.0

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

# Bail early if the working tree is dirty — the release zip would not
# match the tag in git.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree has uncommitted changes — commit or stash first." >&2
  exit 1
fi

echo "==> Packaging gpsaml.app for darwin-arm64"
npm run package:mac

echo "==> Ad-hoc signing the bundle"
codesign --force --deep --sign - "$APP"
codesign -dv --verbose=2 "$APP" 2>&1 | grep -E "Signature|Identifier|Format" || true

echo "==> Creating zip"
rm -f "$ZIP"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"
ls -lh "$ZIP"

echo "==> Creating GitHub release $TAG on $REPO (target $TARGET_BRANCH)"
gh release create "$TAG" \
  --repo "$REPO" \
  --target "$TARGET_BRANCH" \
  --title "$TAG" \
  --notes-file - \
  "$ZIP" <<EOF
Pre-built macOS Apple Silicon build.

## Install
1. Download \`gpsaml-${TAG}-darwin-arm64.zip\`.
2. Unzip and drag \`gpsaml.app\` into \`/Applications\`.
3. If macOS shows _"gpsaml.app is damaged and can't be opened"_, strip
   the Gatekeeper quarantine flag (this build is ad-hoc signed but not
   notarized):
   \`\`\`
   xattr -cr /Applications/gpsaml.app
   \`\`\`

## Requirements
- \`openconnect\` HEAD (mainline 9.12 has a HIP segfault):
  \`\`\`
  brew uninstall openconnect 2>/dev/null
  brew install --HEAD openconnect
  \`\`\`

See README on the branch for details.
EOF

echo "==> Done."
