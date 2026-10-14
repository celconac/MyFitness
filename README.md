myFitness REPAIRED COMPLETE: based on the detailed-history and clean-overview build, with account-aware Drive sync, Settings order, and Android-ready assets. Replace ALL root files on GitHub with ZIP contents. Do not save blank data to Drive. Connect Google, load Drive data and check Overview, Workouts and Routine Library.


Offline persistence fix: the app now restores the last Google account's saved browser snapshot on launch, even before reconnecting Google. Drive sync stays paused until the account is verified. On shared devices, sign out before handing the app to another person. When first installing the fix, connect Google and load your data once.

Google OAuth: the public web client ID is configured in googledrive.js. Each user still grants consent with their own account. Ensure the Google Cloud OAuth application is in Production and its authorized JavaScript origins include https://celconac.github.io. Do not put a client secret in this web app.

Food Diary: Add food with ChatGPT now uses the same JavaScript ChatGPT launcher as Workout and Routine, carrying the selected date and food logging request. On Android, app-link behavior is controlled by Android/ChatGPT link preferences.
