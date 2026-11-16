# Setting up Google sign-in and the development build

Guest mode works in Expo Go with no setup. Google sign-in needs three things: a Google
Cloud OAuth setup, the core API running with that configuration, and the Repwise
development build on your phone (Expo Go cannot load Google's native sign-in).

Everything below is free. Allow about 30 minutes the first time.

## 1. Create the development build (once)

The development build is your own version of Expo Go with Repwise's native libraries
included. Expo builds it in the cloud; you install the APK on your phone.

```bash
cd apps/mobile
npm install -g eas-cli          # or prefix each command with npx
eas login                       # free Expo account
eas init                        # links the project to your account, adds a project ID
eas build --profile development --platform android
```

When the build finishes, open the link it prints on your phone and install the APK
(allow installs from your browser when Android asks). Rebuild only when native libraries
change; JavaScript changes load over Wi-Fi as before.

Get the signing certificate fingerprint for step 2:

```bash
eas credentials --platform android    # choose "development", note the SHA-1 fingerprint
```

## 2. Google Cloud OAuth clients

In the [Google Cloud console](https://console.cloud.google.com/), in a project of your choice:

1. **APIs & Services → OAuth consent screen:** external, app name "Repwise", your email.
   While in testing, add your Google account under test users.
2. **Credentials → Create credentials → OAuth client ID → Web application.** Name it
   "Repwise server". Copy its client ID. This is the *web client ID*: the app asks Google
   for ID tokens addressed to it, and the core API only accepts tokens addressed to it.
3. **Credentials → Create credentials → OAuth client ID → Android.** Package name
   `app.repwise.mobile`, SHA-1 from step 1. Nothing to copy; Google uses it to recognise
   the app.

## 3. Configure and run

Core API (repo root `.env`, or your shell):

```bash
CORE_API_GOOGLE_CLIENT_IDS=<web client ID>
CORE_API_JWT_SECRET=$(openssl rand -base64 48)
```

```bash
cd services/core-api
uv run alembic upgrade head        # creates the local SQLite database (core-api.db)
uv run uvicorn app.main:app --host 0.0.0.0 --port 8001
```

App: put the web client ID in `apps/mobile/app.json` under `expo.extra.googleWebClientId`
(it is not a secret), then:

```bash
cd apps/mobile
npx expo start --dev-client
```

Open the Repwise development build on your phone; it finds the dev server on your Wi-Fi.
In development the app reaches the core API on port 8001 and the AI service on port 8002
of the same computer, so keep both running. Allow Python through the macOS firewall if
asked.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| "Google sign-in needs the Repwise development build" | You opened the app in Expo Go. Use the development build. |
| Google shows `DEVELOPER_ERROR` | The Android client's package name or SHA-1 does not match the build. |
| "Google sign-in could not be verified" | `CORE_API_GOOGLE_CLIENT_IDS` does not contain the web client ID the app used. |
| "Could not reach the Repwise server" | The core API is not running on port 8001, or the firewall blocks it. |
