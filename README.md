# Hubler Marketplace Listing Tool

GitHub Pages frontend + Google Apps Script backend.

## Frontend

The site is hosted from this repository with GitHub Pages.

## Google Apps Script backend

1. Go to https://script.google.com/ and create a new project.
2. Copy the contents of `gas/Code.gs` into the Apps Script editor.
3. In **Project Settings**, set the time zone to `America/Indiana/Indianapolis`.
4. Click **Deploy > New deployment**.
5. Choose **Web app**.
6. Execute as: **Me**.
7. Who has access: **Anyone**.
8. Deploy and authorize the script.
9. Copy the `/exec` Web App URL.
10. Open `app.js` in this repository and replace `PASTE_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE` with that URL.
11. Commit the change. GitHub Pages will then use the Apps Script backend.

The backend only accepts HTTPS DriveHubler Pre-Owned vehicle URLs under `www.drivehublerpreowned.com/used-...`.

## GitHub Pages

In GitHub, open **Settings > Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.

The site should become available at:

https://drivehubler10.github.io/DHCPOmarketplace/

## Important

The first version prepares the Marketplace listing but leaves the final Facebook submission manual. Do not put private API keys or credentials into the GitHub frontend.
