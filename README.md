# myFitness — routine planner and seven-day history

An installable web app hosted on GitHub Pages.

## Updates
- Neutral, cleaner dashboard branding: no personal name or technical sync notes in the header.
- Workouts page sections: **My routines → Exercise checklist → Workout log → Session editor**.
- Each routine has its own exercises, editable via the template editor. Create and rename custom categories.
- Choose a date and routine, load the checklist, enter actual sets/reps/weights, tick exercises, and save.
- Seven-day workout log shows *every day*, including blanks and rest days, with month selection and previous/next week buttons.
- Existing nutrition history and Google Drive auto-sync remain included.
- Removed explanatory ChatGPT/Google Drive text from Overview and Nutrition.

## Install
Upload all files in this ZIP **into the repository root**, overwriting matching files. GitHub Pages deploys from the `main` branch. Reload with Ctrl+Shift+R. Check your Google Drive account and existing data after deployment.

## Data
Personal entries are not bundled. They are kept in the user's existing local / Google Drive data file. Each Google account must authorize the Google Drive connection separately; users in OAuth Testing may need to be added as test users. ChatGPT saving a routine directly to Google Drive is separate from this app's exercise editor.

Routine Library is now a dedicated navigation tab; Workouts contains daily checklist, history, and session editor.

## Separate Google accounts (v11)

Connect Google in Settings before working with your saved data. The app first verifies the current Google Drive user and chooses a browser data store specific to that Google account; it does not share the previous user's data. Each Drive account uses its own `myFitness-data.json`. The previous single-browser data store is migrated only when its saved Google file ID matches the signed-in account's file. Disconnect hides the previous account's records without deleting them. Do not use a shared offline guest session for private entries. An authorized connection is required before the app loads or syncs your personal records. Changes to routines through ChatGPT still require a separate Google Drive authorization in ChatGPT.
