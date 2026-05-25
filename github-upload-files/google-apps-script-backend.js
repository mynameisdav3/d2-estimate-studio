const DRIVE_FOLDER_NAME = "Alchemyist Estimates";
const SHEET_NAME = "Estimate Log";

function doPost(e) {
  const payload = JSON.parse(e.parameter.payload || "{}");
  const folder = getOrCreateFolder_(DRIVE_FOLDER_NAME);
  const sheet = getOrCreateSheet_(folder);
  const estimateNumber = payload.estimateNumber || `EST-${Date.now()}`;
  const clientName = payload.clientName || "Unnamed Client";
  const total = Number(payload.totals && payload.totals.total) || 0;
  const materialCost = Number(payload.backend && payload.backend.estimatedMaterialCost) || 0;
  const grossProfit = Number(payload.backend && payload.backend.estimatedGrossProfit) || 0;
  const fileName = `${estimateNumber} - ${clientName}`;
  const estimateHtml = buildCustomerEstimateHtml_(payload);

  sheet.appendRow([
    new Date(),
    estimateNumber,
    clientName,
    payload.clientPhone || "",
    payload.projectAddress || "",
    payload.projectType || "",
    payload.widthFeet || "",
    payload.heightFeet || "",
    payload.finishLevel || "",
    total,
    materialCost,
    grossProfit,
    payload.backend ? payload.backend.materialPercent : "",
    payload.notes || "",
    payload.sendClientEmail ? "Yes" : "No",
    payload.clientEmail || "",
  ]);

  folder.createFile(
    `${fileName}.json`,
    JSON.stringify(payload, null, 2),
    MimeType.PLAIN_TEXT
  );

  const estimateFile = folder.createFile(
    `${fileName}.html`,
    estimateHtml,
    MimeType.HTML
  );

  if (payload.sendClientEmail && payload.clientEmail) {
    sendCustomerEstimateEmail_(payload, estimateHtml, estimateFile, fileName);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, estimateNumber }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateFolder_(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

function getOrCreateSheet_(folder) {
  const files = folder.getFilesByName(SHEET_NAME);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next()).getSheets()[0];
  }

  const spreadsheet = SpreadsheetApp.create(SHEET_NAME);
  const file = DriveApp.getFileById(spreadsheet.getId());
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  const sheet = spreadsheet.getSheets()[0];
  sheet.appendRow([
    "Submitted At",
    "Estimate No.",
    "Client",
    "Phone",
    "Address",
    "Project Type",
    "Width",
    "Height",
    "Finish Multiplier",
    "Estimate Total",
    "Estimated Materials",
    "Estimated Gross Profit",
    "Material %",
    "Notes",
    "Email Sent",
    "Client Email",
  ]);
  return sheet;
}

function sendCustomerEstimateEmail_(payload, estimateHtml, estimateFile, fileName) {
  const subject = fillEmailTemplate_(
    payload.emailSubject || "Your D2 Carpentry & Design Estimate",
    payload
  );
  const plainMessage = fillEmailTemplate_(payload.emailMessage || "", payload);
  const htmlMessage = `<div style="font-family:Arial,sans-serif;color:#202124;line-height:1.5;">${escapeHtml_(plainMessage).replace(/\n/g, "<br>")}</div>`;
  const attachment = estimateFile.getBlob().setName(`${fileName}.html`);
  const emailOptions = {
    to: payload.clientEmail,
    subject,
    body: plainMessage,
    htmlBody: `${htmlMessage}<hr>${estimateHtml}`,
    name: payload.companyName || "D2 Carpentry & Design",
    attachments: [attachment],
  };
  if (payload.companyEmail) emailOptions.replyTo = payload.companyEmail;

  MailApp.sendEmail(emailOptions);
}

function fillEmailTemplate_(template, payload) {
  const clientName = payload.clientName || "";
  const firstName = clientName.trim().split(/\s+/)[0] || "there";
  const total = Number(payload.totals && payload.totals.total || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  return String(template || "")
    .replace(/\{firstName\}/g, firstName)
    .replace(/\{clientName\}/g, clientName)
    .replace(/\{estimateNumber\}/g, payload.estimateNumber || "")
    .replace(/\{total\}/g, total)
    .replace(/\{companyName\}/g, payload.companyName || "D2 Carpentry & Design");
}

function buildCustomerEstimateHtml_(payload) {
  const hasFlatTotal = Boolean(payload.totals && payload.totals.hasFlatTotal);
  const money = (value) => {
    return Number(value || 0).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
  };
  const rows = (payload.lineItems || []).map((item) => {
    if (item.type === "subline") {
      const colspan = hasFlatTotal ? 1 : 3;
      return `<tr><td colspan="${colspan}" style="padding-left:24px;color:#4f5d6f;">&bull; ${escapeHtml_(item.name)}</td></tr>`;
    }
    if (hasFlatTotal) {
      return `<tr><td>${escapeHtml_(item.name)}</td></tr>`;
    }
    const total = Number(item.qty || 0) * Number(item.price || 0);
    return `<tr><td>${escapeHtml_(item.name)}</td><td>${item.qty}</td><td>${money(total)}</td></tr>`;
  }).join("");
  const tableHead = hasFlatTotal
    ? "<thead><tr><th>Description</th></tr></thead>"
    : "<thead><tr><th>Description</th><th>Qty</th><th>Total</th></tr></thead>";
  const photos = (payload.photos || []).map((photo) => `
    <figure>
      <img src="${photo.dataUrl}" alt="${escapeHtml_(photo.label || photo.name)}">
      <figcaption>${escapeHtml_(photo.label || photo.name)}</figcaption>
    </figure>
  `).join("");
  const photoSection = photos
    ? `<section class="photos"><h2>Project Images</h2><div class="photo-grid">${photos}</div></section>`
    : "";

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml_(payload.estimateNumber || "Estimate")}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #202124; padding: 32px; }
      h1 { color: #24514a; margin-bottom: 4px; }
      table { border-collapse: collapse; width: 100%; margin-top: 24px; }
      th, td { border-bottom: 1px solid #ddd; padding: 10px; text-align: left; }
      th:not(:first-child), td:not(:first-child) { text-align: right; }
      .total { font-size: 22px; color: #24514a; font-weight: 700; text-align: right; }
      .photos { margin-top: 24px; }
      .photo-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
      figure { margin: 0; }
      figure img { width: 100%; border: 1px solid #ddd; border-radius: 8px; }
      figcaption { margin-top: 5px; color: #666; font-size: 12px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml_(payload.companyName || "The Alchemyist")}</h1>
    <p><strong>Estimate:</strong> ${escapeHtml_(payload.estimateNumber || "")}</p>
    <p><strong>Client:</strong> ${escapeHtml_(payload.clientName || "")}</p>
    <p><strong>Project:</strong> ${escapeHtml_(payload.projectType || "")}</p>
    <p><strong>Address:</strong> ${escapeHtml_(payload.projectAddress || "")}</p>
    <table>
      ${tableHead}
      <tbody>${rows}</tbody>
    </table>
    <p class="total">Total: ${money(payload.totals && payload.totals.total)}</p>
    <p>${escapeHtml_(payload.notes || "")}</p>
    ${photoSection}
  </body>
</html>`;
}

function escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
