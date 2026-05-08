# MNY BDM Tracker Off — GitHub Pages + Google Apps Script

## Files

### Frontend
- `index.html`
- `style.css`
- `app.js`

Upload these to your GitHub Pages repository.

### Backend
- `Code.gs`

Paste this into your Google Apps Script project attached to your Google Sheets database.

---

## Backend setup

1. Open the Google Sheet database.
2. Go to **Extensions → Apps Script**.
3. Paste `Code.gs`.
4. Replace:

```js
const DATABASE_SPREADSHEET_ID = "PASTE_YOUR_GOOGLE_SHEET_DATABASE_ID_HERE";
```

5. Enable **Services → Drive API** inside Apps Script.
6. Make sure **Google Drive API** is enabled in the linked Google Cloud Project.
7. Deploy as a Web App:
   - Execute as: **Me**
   - Who has access: **Anyone** or **Anyone with Google account**
8. Copy the Web App URL.

---

## Frontend setup

1. Open `app.js`.
2. Replace:

```js
const APPS_SCRIPT_URL = "PASTE_YOUR_DEPLOYED_APPS_SCRIPT_WEB_APP_URL_HERE";
```

3. Commit `index.html`, `style.css`, and `app.js` to GitHub.
4. Enable GitHub Pages.

---

## Workbook mapping

The uploaded Excel workbook should include these tabs:

- `POD_Flat`
- `POD_BOB_MNY`
- `Display_Flat`
- `Display_BOB`
- `Coldbox_Flat`
- `Coldbox_BOB`

The frontend dropdown behavior follows the Excel tracker:

- Team dropdown pulls OFF teams from `POD_Flat`.
- Sales Rep dropdown filters by selected Team and OFF premise.
- Account dropdowns filter by selected Sales Rep and OFF premise.
- POD BTG uses `POD_Flat`.
- Display BTG uses `Display_Flat`.
- Coldbox qualification uses `Coldbox_BOB`.
- Account POD breakdown uses `POD_BOB_MNY` / `POD_BOB_CLEAN`.

---

## Important note

If account-level POD details show blank, the imported `POD_BOB_MNY` header row needs a small mapping adjustment in `createCleanPodBobTable()` or `getField()` candidate names.
