# macOS Notarization Setup

This guide covers the GitHub secrets and Apple credentials required to sign and notarize Codelane for macOS distribution.

## GitHub Secrets

Add these in **Settings → Secrets and variables → Actions** on the repository.

### macOS Signing & Notarization

| Secret | Value |
|--------|-------|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` certificate export |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` file |
| `KEYCHAIN_PASSWORD` | Any strong password (used ephemerally in CI) |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_PASSWORD` | App-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | Your 10-character Team ID from developer.apple.com |

### Windows Updater Signing (optional)

| Secret | Value |
|--------|-------|
| `TAURI_PRIVATE_KEY` | Generated via `pnpm tauri signer generate` |
| `TAURI_KEY_PASSWORD` | Password for the above key |

## Step-by-Step Setup

### 1. Export your Developer ID certificate as base64

In Keychain Access, export your **Developer ID Application** certificate as a `.p12` file, then encode it:

```bash
base64 -i YourCert.p12 | pbcopy
```

Paste the result as `APPLE_CERTIFICATE`. Set `APPLE_CERTIFICATE_PASSWORD` to the password you chose when exporting.

### 2. Create an app-specific password

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in → **App-Specific Passwords** → **Generate**
3. Label it (e.g. `codelane-ci`) and copy the generated password
4. Set that as `APPLE_PASSWORD`

### 3. Find your Team ID

Go to [developer.apple.com/account](https://developer.apple.com/account) → **Membership details** → copy the 10-character Team ID.

Set that as `APPLE_TEAM_ID`.

### 4. Set KEYCHAIN_PASSWORD

Use any strong random string — it's only used to protect the ephemeral keychain created during the CI build. Example:

```bash
openssl rand -base64 32 | pbcopy
```

## Workflows

| Workflow | Notarization | Use when |
|----------|-------------|----------|
| `release.yml` | Yes — submits DMGs to Apple notary service and staples | Public releases |
| `release-no-notarize.yml` | No — code-signed only | Testing the build pipeline |

Both are triggered manually via **Actions → Run workflow**. You can optionally provide a custom tag name; otherwise the version from `src-tauri/tauri.conf.json` is used.

## Parallel Build Matrix

All platforms build simultaneously:

| Job | Runner | Artifacts |
|-----|--------|-----------|
| `build-macos` (Apple Silicon) | `macos-latest` | `.dmg` |
| `build-macos` (Intel) | `macos-latest` | `.dmg` |
| `build-linux` | `ubuntu-22.04` | `.AppImage`, `.deb` |
| `build-windows` | `windows-latest` | `.msi`, `.exe` |

The `create-release` job collects all artifacts, creates a git tag if needed, and publishes a GitHub Release.
