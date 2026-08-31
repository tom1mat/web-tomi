# Contact form setup — Google Sheet + Apps Script

The page's contact form POSTs to a Google Apps Script Web App that you own.
The script appends every submission to a Google Sheet and emails you a
notification. Your email address never appears in the page source — it lives
only inside the script, in your Google account.

Gmail's free `MailApp` quota is ~100 emails/day — far beyond portfolio volume.

## One-time setup (~5 minutes, only you can do this)

1. Go to [sheets.new](https://sheets.new) and create a spreadsheet.
   Name it e.g. `portfolio contact`.
2. In the sheet: **Extensions → Apps Script**. Delete the placeholder code.
3. Paste the whole contents of [`apps-script/contact-form.gs`](apps-script/contact-form.gs).
4. Replace `PUT-YOUR-EMAIL-HERE@example.com` with your real email. Save (⌘S).
5. Click **Deploy → New deployment**:
   - Type (gear icon): **Web app**
   - Description: anything
   - Execute as: **Me**
   - Who has access: **Anyone** ← required, this is what lets the page POST
6. Click **Deploy**, then **Authorize access** — pick your account. Google
   will warn the app is unverified (it's your own script): **Advanced →
   Go to … (unsafe) → Allow**.
7. Copy the **Web app URL** (ends in `/exec`).
8. In each candidate HTML file, find:

   ```js
   const CONTACT_ENDPOINT = "";
   ```

   and paste the URL between the quotes.

Until step 8 is done, the form shows a graceful "not wired up yet" note
instead of sending.

### Updating the script later

Edit the code, then **Deploy → Manage deployments → ✏️ Edit → Version: New
version → Deploy**. The URL stays the same. (Just saving the file does NOT
update the live web app.)

### Spam handling

The page already ships a honeypot field and a minimum-fill-time trap, so
casual bots are dropped client-side without ever reaching the script. If real
spam gets through later, the script is yours — filtering rules, keyword
blocks, or a captcha can be added without touching any third party.

## GitHub Pages + custom domain

1. Repo → **Settings → Pages** → Source: **Deploy from a branch** →
   Branch: `main`, folder `/ (root)` → Save. The site goes live at
   `https://tom1mat.github.io/web-tomi/` in ~a minute.
2. Custom domain: in the same Pages settings, enter your domain (e.g.
   `tomi.dev`) and save — this commits a `CNAME` file to the repo.
3. At your DNS provider:
   - **Apex domain** (`tomi.dev`): four `A` records →
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
     (plus optional `AAAA`: `2606:50c0:8000::153` … `8003::153`)
   - **`www` subdomain**: `CNAME` record → `tom1mat.github.io`
4. Back in Pages settings, wait for the DNS check, then tick
   **Enforce HTTPS**.

Note: the Apps Script endpoint doesn't care what domain the page is served
from, so the form works on localhost, github.io, and the custom domain alike.
