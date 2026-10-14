# myFitness — Android-friendly fitness tracker with Google Drive

A free-to-host, customizable installable web app. Workouts (including exercises, sets, reps and weights), food/calories/protein, weight history, personal goals and optional Google Drive saving/loading.

## What's included
- Works locally offline after first installation; no account required for local data.
- Editable workout sessions, completed/rest/planned status, reorderable exercises.
- Calorie and protein diary, weigh-ins, custom goals, profile themes, units.
- Optional Google Drive save/load via Google OAuth **without an app server**.
- Android download/import JSON backups.
- Starts blank; sample historical profile can be loaded via Settings.

## Publish free using GitHub Pages
1. Create a public GitHub repo named `myFitness` (the code is public; personal fitness data is NOT in the repo).
2. Upload the contents of this folder (including index.html, app.js, googledrive.js, sw.js and manifest) into the repository root.
3. Repository > Settings > Pages > Deploy from branch > main / (root) > Save.
4. Wait for your published link `https://YOUR-USERNAME.github.io/myFitness/`.
5. On Android Chrome open this URL > menu > Add to Home screen / Install app.

## Set up Google Drive (one-time)
1. Visit https://console.cloud.google.com/ and create/select a project. Select a project with no billing enabled; do not enable paid APIs.
2. Configure Google Auth Platform / OAuth consent screen for external users (or internal if you're using an eligible Workspace organization). Add yourself as a test user if the project is in Testing mode. Only use the required Drive permission `https://www.googleapis.com/auth/drive.file`.
3. Enable **Google Drive API** for the project.
4. Create an OAuth client ID of type **Web application**; under **Authorized JavaScript origins** add `https://YOUR-USERNAME.github.io` (only the origin, not `/myFitness/`).
5. Paste that OAuth Client ID in myFitness > Settings > Google Drive sync > Connect Google. Approve the request.
6. Tap **Save to Google Drive** to create `myFitness-data.json`. Tap **Load from Google Drive** on another device after connecting.
7. The Drive file is accessible only with your Google account. No account password or client secret goes in GitHub. Users of a public commercial app would need an appropriately published and verified OAuth consent screen; Google's review/verification requirements may apply to the requested scope.

**Important limitation:** Google OAuth consent may be subject to testing-user restrictions, verification and scope policies. Free quotas and service policies can change. Browser pop-ups need to be allowed for sign-in. This app uses short-lived tokens held in memory; reconnect after reloading if needed.

## ChatGPT integration
**Not yet automatic.** ChatGPT can only directly update the Drive record if your ChatGPT Google Drive connection has permissions and support for reading/writing the same file. In particular, Drive JSON files might not be editable by ChatGPT's available Drive actions. The included browser app does not by itself expose a ChatGPT tool. A tested integration or a different editable data format could be needed. Do not assume changes discussed in ChatGPT were logged into this app.

## Safety and sync
- Do **not** place your JSON fitness data, Google tokens, or other private information in your GitHub repository.
- The Drive `drive.file` scope only allows this web app to access files it creates or files explicitly opened with it, not all Drive contents.
- Save and Load are **manual** and explicitly confirm before replacement. The file is not merged; loading from old devices or saving stale data can overwrite changes. Export an Android backup periodically.
- Public source code on GitHub Pages is normal; an OAuth web client ID is not secret. Never publish client secrets.
