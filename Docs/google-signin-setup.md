# Google Sign-In — setup

The "Continue with Google" button is fully wired in code but **inert until you
create Google OAuth client IDs and paste them into env vars.** Until then the
button shows *"Google sign-in isn't configured yet."*

## 1. Create the OAuth clients (Google Cloud Console)

1. Go to <https://console.cloud.google.com/> → create/select a project.
2. **APIs & Services → OAuth consent screen** → configure (External, app name,
   support email). Add the scopes `email`, `profile`, `openid`. Add yourself as
   a test user while it's in "Testing".
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**, once
   per platform:

   | Type | What to enter |
   |------|----------------|
   | **Web application** | Authorized JavaScript origins: your web origins (e.g. `https://chingiringi.com`, `https://chingiringi-web-app.onrender.com`, `http://localhost:8090`). Authorized redirect URIs: same origins. |
   | **iOS** | Bundle ID: `com.vcrohithuta.chingiringapp` |
   | **Android** | Package: `com.vcrohithuta.chingiringapp` + SHA-1 fingerprint of your signing key (`eas credentials` or `keytool -list -v -keystore ...`). |

## 2. Paste the client IDs into env

**`chingiring-app/.env`** (public — these ship inside the app):
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web client id>.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ios client id>.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<android client id>.apps.googleusercontent.com
```

**`backend/.env`** (the backend verifies the id_token against these audiences):
```
GOOGLE_WEB_CLIENT_ID=<web client id>.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=<ios client id>.apps.googleusercontent.com
GOOGLE_ANDROID_CLIENT_ID=<android client id>.apps.googleusercontent.com
```

For production, set the same vars in **EAS** (app, via `eas.json`/EAS secrets) and
**Render** (backend, Environment tab).

## 3. Rebuild the native app

`app.json` gained `"scheme": "chingiring"` and the `expo-web-browser` plugin, and
new native modules were added — so a **fresh dev/prod build is required** (a JS
reload is not enough):

```bash
cd chingiring-app
npx expo prebuild --clean   # regenerates native projects with the new scheme
npx expo run:ios            # or: npx expo run:android
```

Web needs no rebuild — just restart the dev server after setting the env vars.

## How it works (already built)

- **App** — `src/hooks/useGoogleSignIn.ts` runs expo-auth-session's id_token flow,
  then `POST /auth/google { idToken }`. The axios interceptor stores the returned
  tokens and `hydrate()` flips the app into the authed stack — identical to the
  password path. Used by both `LoginScreen` (web) and `MobileLoginScreen` (native).
- **Backend** — `POST /auth/google` (`authController.googleAuth`) verifies the
  id_token with `google-auth-library`, then `findOrCreateGoogleUser` matches by
  `googleId` or `email` (linking Google to an existing email account on first
  login, else creating a new user + wallet), and issues our normal JWT tokens.
- **User model** — added a sparse-unique `googleId`. Google-only users have no
  password, which is already allowed.
