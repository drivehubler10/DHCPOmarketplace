# Cloudflare Worker Backend

This Worker is the server-side scraper for the Hubler Marketplace Listing Tool.

## Easiest deployment

1. Create a free Cloudflare account at https://dash.cloudflare.com/.
2. Open **Workers & Pages**.
3. Choose **Create application** / **Create Worker**.
4. Name it `hubler-marketplace-importer`.
5. Open the Worker code editor.
6. Replace the starter code with the contents of `worker.js` from this folder.
7. Deploy.
8. Cloudflare will give you a URL similar to:
   `https://hubler-marketplace-importer.<your-subdomain>.workers.dev`
9. Copy that URL into the `API_URL` constant in the root `app.js` file in GitHub.
10. Commit the change.

## Test

Open the Worker URL in a browser. It should return JSON similar to:

`{"ok":true,"service":"Hubler Marketplace Importer"}`

The Worker only accepts HTTPS vehicle URLs on `www.drivehubler.com` whose path contains `/used-`.

The Worker does not contain any Facebook login credentials or Google credentials. Final Marketplace publishing remains manual.
