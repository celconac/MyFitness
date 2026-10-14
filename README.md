myFitness REPAIRED COMPLETE: based on the detailed-history and clean-overview build, with account-aware Drive sync, Settings order, and Android-ready assets. Replace ALL root files on GitHub with ZIP contents. Do not save blank data to Drive. Connect Google, load Drive data and check Overview, Workouts and Routine Library.


Offline persistence fix: the app now restores the last Google account's saved browser snapshot on launch, even before reconnecting Google. Drive sync stays paused until the account is verified. On shared devices, sign out before handing the app to another person. When first installing the fix, connect Google and load your data once.

Google OAuth: the public web client ID is configured in googledrive.js. Each user still grants consent with their own account. Ensure the Google Cloud OAuth application is in Production and its authorized JavaScript origins include https://celconac.github.io. Do not put a client secret in this web app.

Food Diary: Add food with ChatGPT now uses the same JavaScript ChatGPT launcher as Workout and Routine, carrying the selected date and food logging request. On Android, app-link behavior is controlled by Android/ChatGPT link preferences.

## One-tap food logging
Tap Add food with ChatGPT, describe a meal, then tap the generated myFitness link. The app previews the entry and saves after confirmation.
Link format: `https://celconac.github.io/MyFitness/?addFood=1&date=2026-10-14&name=Medium%20banana&calories=105&protein=1.3&entryId=example-unique-20261014`
The logged-in Google account's local profile is required; Drive sync follows normal app behavior. A user must confirm the import.


## One-tap workout and routine links
- Workouts: `https://celconac.github.io/MyFitness/?addWorkout=1&payload=ENCODED_JSON` where `ENCODED_JSON` is `encodeURIComponent(JSON.stringify({date:"2026-10-14",name:"Chest + Biceps",status:"Done",exercises:[{name:"Incline press",sets:3,reps:"10",weight:20,done:true}]}))`.
- Routines: `https://celconac.github.io/MyFitness/?addRoutine=1&payload=ENCODED_JSON` with an object `{name:"Full Body",exercises:[{name:"Leg press",sets:3,reps:"10-12"}]}`.
- Both links present a review confirmation, require an active account profile and do not overwrite unrelated data. A routine with the same name replaces that template only.
- Long workout links may exceed messaging/app-link URL limits. Keep exercise descriptions short and split extensive plans if necessary.

## Personalized food suggestions
Nutrition now includes a “What should I eat?” meal selector and ChatGPT button. It passes the selected date, current user's food diary totals, daily targets and the remaining calorie/protein balance to ChatGPT. It only suggests meals; no data is saved unless the user confirms a separate one-tap Add Food link.


## Nutrition layout + weekly calorie overview
- Nutrition tab opens with selected day calories, protein, remaining goals, and food entries, followed by Food Coach and weekly/monthly navigation.
- Overview now shows Monday-Sunday daily calorie totals alongside the existing weekly workout overview.
- Existing account separation, one-tap imports, and Drive synchronization retained.


## Compact Overview update
On mobile, calories, protein, and weight stay side by side in a three-column row. The seven-day calorie and workout grids are both more compact and readable. No change to stored fitness data or authentication.


## Exercise Library (new)
Routine Library now includes a searchable exercise list sourced from built-in templates, custom templates and completed sessions. Workouts, Training History and template editors have ▶ Demo buttons. Demonstrations attempt an exact exercise-name match in the public wger exercise media API; when no trustworthy media match exists, the app shows video/image search links rather than incorrectly showing a different movement. Media requires internet and is not saved in personal fitness JSON. New one-tap ChatGPT routines automatically appear in the library. No API keys required. Media from wger has its own creator/licensing terms.
