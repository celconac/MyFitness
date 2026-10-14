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
