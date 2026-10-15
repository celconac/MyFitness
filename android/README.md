# MyFitness Android Google session

This update keeps the existing Chrome Trusted Web Activity and the same website
origin, application ID and signing certificate. It does not migrate records into
a separate WebView or introduce a backend, hosting service or custom domain.

The Android activity calls Google Play services AuthorizationClient for
`drive.file`. After initial consent, Android can return access in later sessions
without another user prompt while the grant remains valid. Access tokens stay in
process memory and are sent only through a Chrome-validated message channel to
`https://celconac.github.io`. No token, refresh token, secret, authorization code,
or password is stored in app preferences, web storage, service-worker caches,
URLs, or source files. Google Play services manages its own token cache.

The app persists only a restore opt-in flag, account email and Drive permission
ID in private preferences. Each returned token is checked against Google's Drive
about endpoint before use. Silent authorization is pinned to that account;
switching accounts requires an explicit Connect Google action. Sign out clears
the native opt-in and writes a durable web logout marker so delayed responses or
offline/reopened sessions cannot silently sign back in.

## Required configuration before testing

1. In the existing Google Cloud project `myfitness-511607` (number
   `386983355308`), check for an Android OAuth client with:
   - Package: `io.github.celconac.twa`
   - SHA-1: `FB:EE:12:53:F9:9A:55:2F:B3:9D:B3:5F:CF:B5:F9:00:93:AE:B6:6D`
   Register that exact client if absent, with user approval. Keep it in the same
   project as the existing web client so the Drive app identity is consistent.
   No client secret or offline server access is needed in the app.
2. Add `delegate_permission/common.use_as_origin` alongside
   `delegate_permission/common.handle_all_urls` in the existing root site's
   `.well-known/assetlinks.json`, preserving package and original certificate:
   `4D:CE:42:32:70:D0:3C:00:26:50:B9:1F:33:AD:CE:FF:94:89:E1:9A:AE:F5:F7:36:44:28:F3:5A:F0:12:54:CE`.
3. Deploy the accompanying `native-google.js`, `googledrive.js`, `app.js`,
   `index.html` and `sw.js` to the existing MyFitness GitHub Pages site. Browser
   use and older APKs retain the browser OAuth flow. Close all app/site tabs once
   so the service worker can activate the coordinated client update.
4. Update the existing APK using the original signing key. Never uninstall or
   clear browser/app storage to get around an installation mismatch.
5. Connect Google once in the updated Android app to opt into native restoration.

Google branding verification is a separate process. Do not change the existing
web OAuth client, branding URLs, consent audience or Search Console verification
as part of this change. OAuth consent/client eligibility may require Google
action independently of app packaging.

## Build

Use JDK 21, Gradle 8.13 and Android SDK 36. Run `gradle assembleRelease
bundleRelease lintRelease` in this directory. Signing is read from these process
environment variables only: `MYFITNESS_KEYSTORE`, `MYFITNESS_STORE_PASSWORD`,
`MYFITNESS_KEY_ALIAS`, `MYFITNESS_KEY_PASSWORD`. Never commit the key or passwords.
The release is version code 4, version name 1.1.1. The build uses the existing
website icon copied to `app/src/main/res/drawable/app_icon.png`.

Run `npm test` at the repository root for mocked bridge/session tests. They do
not prove that live Google consent, Chrome messaging, OS lifecycle or phone
installation work; those require a physical device.

## Phone acceptance tests

- Export a JSON backup and confirm the existing account's records before update.
- Update in place and confirm records remain available before connecting Google.
- Connect Google; verify the email and records match and sync finishes.
- Refresh three times; verify connection restores without another account prompt.
- Close/reopen the app and restart the phone; verify restoration and records.
- Add an offline meal; reconnect and check that it reaches that account's Drive.
- Sign out; refresh/reopen/restart and confirm it stays signed out, with account
  records retained separately and no automatic Google prompt.
- Connect another account and confirm it cannot see or upload the first account's
  records; switch back and confirm the first account's records are intact.
- Let access expire or revoke it in Google Account settings; confirm renewed
  access or a clear Connect Google prompt, with no data loss.
- Open a food-chat link and confirm it returns to this app for review/save.

MyFitness explicitly chooses Google Chrome, independently of the default phone
browser. Samsung Internet does not provide the channel this implementation needs.
Local browser storage is separate: keep a JSON backup from the previous provider
and import unsynced records only after connecting the correct Google account.

The current implementation depends on a Chrome-compatible TWA message channel
(Chrome 115+), Google Play services and the app's live bound browser session.
If Android kills the native process while Chrome stays open, reopen from the
MyFitness app icon to establish a fresh channel. A user-revoked grant or changed
Google policy may still require consent; permanent unattended access is not
promised. Do not roll out to other internal testers until these tests pass.

References:
- https://developer.android.com/identity/authorization
- https://developer.chrome.com/docs/android/post-message-twa
