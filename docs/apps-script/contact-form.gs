/**
 * Contact form backend — Google Apps Script, container-bound to a Google Sheet.
 *
 * Receives POSTs from the portfolio page, appends each submission to the
 * "Submissions" sheet, and emails you a notification. Your email address
 * lives ONLY here, inside your Google account — never in the page source.
 *
 * Setup steps: see docs/contact-form-setup.md
 */

const NOTIFY_EMAIL = "PUT-YOUR-EMAIL-HERE@example.com";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const email = String(data.email || "").trim().slice(0, 200);
    const message = String(data.message || "").trim().slice(0, 5000);

    if (!email || !message) {
      return respond({ ok: false, error: "missing fields" });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet =
      ss.getSheetByName("Submissions") || ss.insertSheet("Submissions");
    sheet.appendRow([new Date(), email, message]);

    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: "portfolio contact — " + email,
      body: message + "\n\n— reply to: " + email,
      replyTo: email,
    });

    return respond({ ok: true });
  } catch (err) {
    return respond({ ok: false, error: String(err) });
  }
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
