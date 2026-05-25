const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const GOOGLE_SCRIPT_URL = "";
const MATERIAL_PERCENT = 0.25;
const STORAGE_KEY = "d2EstimateStudio";
const ESTIMATE_SEQUENCE_KEY = "d2EstimateSequence";
const COMPANY_DEFAULTS = {
  name: "D2 Carpentry & Design",
  phone: "239-469-8555",
  email: "D2carpentryanddesign@gmail.com",
  address: "2710 Del Prado Blvd S #2-184 Cape Coral, FL 33904",
};

const PROJECT_PREFIXES = {
  "Other": "A",
  "Reach-in closet": "R",
  "Walk-in closet": "W",
  "Pantry storage": "P",
  "Garage storage": "G",
  "Built-in cabinetry": "B",
  "Custom carpentry": "C",
};

const presets = {
  shelves: { name: "Adjustable shelves", qty: 8, price: 42 },
  drawers: { name: "Soft-close drawer boxes", qty: 4, price: 185 },
  rods: { name: "Hanging rods", qty: 3, price: 58 },
  doors: { name: "Shaker cabinet doors", qty: 4, price: 145 },
  install: { name: "Installation labor", qty: 1, price: 650 },
};

const fields = [
  "companyName",
  "estimateTitle",
  "companyPhone",
  "companyEmail",
  "companyAddress",
  "estimateNumber",
  "showEstimateNumber",
  "estimateDate",
  "validUntil",
  "clientName",
  "clientPhone",
  "clientEmail",
  "projectAddress",
  "projectType",
  "finishLevel",
  "widthFeet",
  "heightFeet",
  "flatTotal",
  "discount",
  "discountType",
  "taxRate",
  "depositRate",
  "notes",
];

const state = {
  lineItems: [],
  photos: [],
  autoEstimateNumber: false,
  estimateNumberCommitted: false,
  estimateSequence: {},
};

const $ = (id) => document.getElementById(id);

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function numberValue(id) {
  return Number.parseFloat($(id).value) || 0;
}

function createId() {
  return globalThis.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readEstimateSequence() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ESTIMATE_SEQUENCE_KEY) || "{}");
    state.estimateSequence = parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    state.estimateSequence = state.estimateSequence || {};
  }
  return state.estimateSequence;
}

function writeEstimateSequence(sequence) {
  state.estimateSequence = sequence;
  try {
    localStorage.setItem(ESTIMATE_SEQUENCE_KEY, JSON.stringify(sequence));
  } catch (error) {
    // Direct file previews can block storage; keep the sequence in memory for this session.
  }
}

function formatPercent(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatPhoneInput(input) {
  input.value = formatPhone(input.value);
}

function getFinishLabel() {
  const select = $("finishLevel");
  return select.options[select.selectedIndex].text;
}

function formatCompanyAddress(value) {
  const address = value.trim();
  if (!address) return "";
  const cityMatch = address.match(/\s(Cape Coral,\s*FL\s*\d{5})$/i);
  if (cityMatch) {
    return `${address.slice(0, cityMatch.index).trim()}<br>${cityMatch[1].trim()}`;
  }
  return address;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString().slice(0, 10);
}

function getEstimateNumberParts() {
  const date = new Date();
  const stamp = date.toISOString().slice(2, 10).replaceAll("-", "");
  const prefix = PROJECT_PREFIXES[$("projectType").value] || "A";
  return { prefix, stamp, sequenceKey: `${prefix}-${stamp}` };
}

function makeEstimateNumber(commit = false) {
  const { prefix, stamp, sequenceKey } = getEstimateNumberParts();
  const sequence = readEstimateSequence();
  const nextNumber = (sequence[sequenceKey] || 0) + 1;
  if (commit) {
    sequence[sequenceKey] = nextNumber;
    writeEstimateSequence(sequence);
    state.estimateNumberCommitted = true;
  }
  return `${prefix}-${stamp}-${String(nextNumber).padStart(3, "0")}`;
}

function ensureEstimateNumber() {
  if (!$("estimateNumber").value.trim()) {
    $("estimateNumber").value = makeEstimateNumber(true);
    state.autoEstimateNumber = true;
    updatePreview();
    return;
  }
  if (state.autoEstimateNumber && !state.estimateNumberCommitted) {
    commitEstimateNumber($("estimateNumber").value.trim());
  }
}

function commitEstimateNumber(value) {
  const match = value.match(/^([A-Z])-([0-9]{6})-([0-9]{3})$/);
  if (!match) return;
  const [, prefix, stamp, number] = match;
  const sequenceKey = `${prefix}-${stamp}`;
  const sequence = readEstimateSequence();
  sequence[sequenceKey] = Math.max(sequence[sequenceKey] || 0, Number(number));
  writeEstimateSequence(sequence);
  state.estimateNumberCommitted = true;
}

function refreshAutoEstimateNumber() {
  if (!state.autoEstimateNumber || state.estimateNumberCommitted) return;
  $("estimateNumber").value = makeEstimateNumber(false);
  updatePreview();
}

function addLineItem(item = { name: "", qty: "", price: "" }) {
  state.lineItems.push({
    id: createId(),
    type: "item",
    name: item.name,
    qty: item.qty,
    price: item.price,
  });
  renderLineItems();
  updatePreview();
}

function addSubLine(parentId) {
  const parentIndex = state.lineItems.findIndex((item) => item.id === parentId);
  if (parentIndex === -1) return;
  let insertAt = parentIndex + 1;
  while (insertAt < state.lineItems.length && state.lineItems[insertAt].parentId === parentId) {
    insertAt += 1;
  }
  const subline = {
    id: createId(),
    parentId,
    type: "subline",
    name: "",
    qty: 0,
    price: 0,
  };

  state.lineItems.splice(insertAt, 0, subline);
  renderLineItems();
  updatePreview();
}

function removeLineItem(id) {
  state.lineItems = state.lineItems.filter((item) => item.id !== id && item.parentId !== id);
  renderLineItems();
  updatePreview();
}

function addPhotos(files) {
  Array.from(files)
    .filter((file) => file.type.startsWith("image/"))
    .forEach((file) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        state.photos.push({
          id: createId(),
          name: file.name,
          label: "",
          dataUrl: reader.result,
        });
        renderPhotos();
        updatePreview();
      });
      reader.readAsDataURL(file);
    });
}

function removePhoto(id) {
  state.photos = state.photos.filter((photo) => photo.id !== id);
  renderPhotos();
  updatePreview();
}

function renderPhotos() {
  const container = $("photoEditorList");
  container.innerHTML = "";

  state.photos.forEach((photo) => {
    const card = document.createElement("div");
    card.className = "photo-editor-card";
    card.dataset.id = photo.id;
    card.innerHTML = `
      <img src="${photo.dataUrl}" alt="${escapeHtml(photo.label || photo.name)}">
      <label>
        Image Label
        <input data-field="label" value="${escapeHtml(photo.label)}" placeholder="Example: Existing closet">
      </label>
      <button type="button" data-action="remove" title="Remove photo" aria-label="Remove photo">x</button>
    `;

    card.addEventListener("input", (event) => {
      if (event.target.dataset.field !== "label") return;
      const entry = state.photos.find((item) => item.id === photo.id);
      if (entry) entry.label = event.target.value;
      updatePreview();
    });

    card.addEventListener("click", (event) => {
      if (event.target.dataset.action === "remove") removePhoto(photo.id);
    });

    container.appendChild(card);
  });
}

function autoGrowTextArea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function renderLineItems() {
  const container = $("lineItems");
  container.innerHTML = "";

  state.lineItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = item.type === "subline" ? "line-row subline-editor-row" : "line-row";
    row.dataset.id = item.id;
    row.innerHTML = item.type === "subline"
      ? `
        <label>
          Subline
          <textarea data-field="name" rows="1">${escapeHtml(item.name)}</textarea>
        </label>
        <button type="button" data-action="remove" title="Remove subline" aria-label="Remove subline">x</button>
      `
      : `
        <label>
          Description
          <textarea data-field="name" rows="1">${escapeHtml(item.name)}</textarea>
        </label>
        <label>
          Qty
          <input data-field="qty" type="number" min="0" step="0.01" value="${item.qty}">
        </label>
        <label>
          Unit Price
          <input data-field="price" type="number" min="0" step="0.01" value="${item.price}">
        </label>
        <div class="line-actions">
          <button type="button" data-action="subline" title="Add subline" aria-label="Add subline">+</button>
          <button type="button" data-action="remove" title="Remove item" aria-label="Remove item">x</button>
        </div>
      `;

    row.addEventListener("input", (event) => {
      const target = event.target;
      const field = target.dataset.field;
      if (!field) return;

      const lineItem = state.lineItems.find((entry) => entry.id === item.id);
      lineItem[field] = field === "name" ? target.value : Number.parseFloat(target.value) || 0;
      if (field === "price" && Number.parseFloat(target.value) > 0 && !(Number.parseFloat(lineItem.qty) > 0)) {
        lineItem.qty = 1;
        const qtyInput = row.querySelector('[data-field="qty"]');
        if (qtyInput) qtyInput.value = 1;
      }
      if (target.tagName === "TEXTAREA") autoGrowTextArea(target);
      updatePreview();
    });

    row.addEventListener("click", (event) => {
      const action = event.target.dataset.action;
      if (action === "remove") removeLineItem(item.id);
      if (action === "subline") addSubLine(item.id);
    });
    container.appendChild(row);
    row.querySelectorAll("textarea").forEach(autoGrowTextArea);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function calculateTotals() {
  const finishMultiplier = $("projectType").value === "Other" ? 1 : numberValue("finishLevel") || 1;
  const subtotal = state.lineItems.reduce((sum, item) => {
    if (item.type === "subline") return sum;
    return sum + (Number.parseFloat(item.qty) || 0) * (Number.parseFloat(item.price) || 0) * finishMultiplier;
  }, 0);
  const discountInput = $("discount").value.trim();
  const taxInput = $("taxRate").value.trim();
  const depositInput = $("depositRate").value.trim();
  const flatTotalInput = $("flatTotal").value.trim();
  const flatTotal = flatTotalInput ? numberValue("flatTotal") : 0;
  const hasFlatTotal = flatTotal > 0;
  const discountValue = numberValue("discount");
  const discountType = $("discountType").value;
  const rawDiscount = discountType === "percent" ? subtotal * (discountValue / 100) : discountValue;
  const discount = !hasFlatTotal && discountInput ? Math.min(rawDiscount, subtotal) : 0;
  const taxable = Math.max(subtotal - discount, 0);
  const tax = !hasFlatTotal && taxInput ? taxable * (numberValue("taxRate") / 100) : 0;
  const total = hasFlatTotal ? flatTotal : taxable + tax;
  const depositRate = numberValue("depositRate");
  const deposit = depositInput ? total * (depositRate / 100) : 0;

  return {
    subtotal,
    discount,
    tax,
    total,
    deposit,
    finishMultiplier,
    hasFlatTotal,
    discountType,
    discountValue,
    depositRate,
    showDiscount: !hasFlatTotal && discount > 0,
    showTax: !hasFlatTotal && tax > 0,
    showDeposit: deposit > 0,
    showSubtotal: !hasFlatTotal && (discount > 0 || tax > 0),
  };
}

function updatePreview() {
  const totals = calculateTotals();
  if ($("showEstimateNumber").checked && !$("estimateNumber").value.trim()) {
    $("estimateNumber").value = makeEstimateNumber(false);
    state.autoEstimateNumber = true;
  }
  const estimateNumber = $("estimateNumber").value.trim();
  $("estimateSheet").classList.toggle("flat-total-mode", totals.hasFlatTotal);
  $("previewCompany").textContent = $("companyName").value || COMPANY_DEFAULTS.name;
  $("previewEstimateTitle").textContent = $("estimateTitle").value || "Estimate";
  $("previewEstimateNumber").textContent = estimateNumber;
  $("previewEstimateNumber").hidden = !$("showEstimateNumber").checked || !estimateNumber;
  $("previewCompanyPhone").textContent = formatPhone($("companyPhone").value || COMPANY_DEFAULTS.phone);
  $("previewCompanyEmail").textContent = $("companyEmail").value || COMPANY_DEFAULTS.email;
  $("previewCompanyAddress").innerHTML = formatCompanyAddress($("companyAddress").value);
  $("previewFooterPhone").textContent = formatPhone($("companyPhone").value || COMPANY_DEFAULTS.phone);
  $("previewFooterEmail").textContent = $("companyEmail").value || COMPANY_DEFAULTS.email;
  $("previewFooterAddress").innerHTML = formatCompanyAddress($("companyAddress").value);
  $("previewDate").textContent = $("estimateDate").value ? formatDate($("estimateDate").value) : "";
  $("previewClient").textContent = $("clientName").value || "Client name";
  $("previewPhone").textContent = formatPhone($("clientPhone").value);
  $("previewClientEmail").textContent = $("clientEmail").value;
  $("previewAddress").textContent = $("projectAddress").value;
  $("previewNotes").textContent = $("notes").value;

  const tbody = $("previewRows");
  tbody.innerHTML = "";
  state.lineItems.forEach((item) => {
    const tr = document.createElement("tr");
    if (item.type === "subline") {
      tr.className = "subline-preview-row";
      tr.innerHTML = `
        <td><span>${escapeHtml(item.name)}</span></td>
        <td></td>
        <td></td>
      `;
      tbody.appendChild(tr);
      return;
    }

    const qty = Number.parseFloat(item.qty);
    const price = Number.parseFloat(item.price);
    const hasQty = Number.isFinite(qty) && qty > 0;
    const hasPrice = Number.isFinite(price) && price > 0;
    const total = hasQty && hasPrice ? qty * price * totals.finishMultiplier : 0;
    tr.innerHTML = `
      <td>${escapeHtml(item.name)}</td>
      <td>${!totals.hasFlatTotal && hasQty ? qty : ""}</td>
      <td>${!totals.hasFlatTotal && hasQty && hasPrice ? currency.format(total) : ""}</td>
    `;
    tbody.appendChild(tr);
  });

  $("subtotal").textContent = currency.format(totals.subtotal);
  $("subtotalRow").hidden = !totals.showSubtotal;
  $("discountRow").hidden = !totals.showDiscount;
  $("taxRow").hidden = !totals.showTax;
  $("depositRow").hidden = !totals.showDeposit;
  $("discountTotal").textContent = `-${currency.format(totals.discount)}`;
  $("taxTotal").textContent = currency.format(totals.tax);
  $("grandTotal").textContent = currency.format(totals.total);
  $("depositLabel").textContent = totals.showDeposit
    ? `Deposit Due (${formatPercent(totals.depositRate)}%)`
    : "Deposit Due";
  $("depositDue").textContent = currency.format(totals.deposit);

  $("previewPhotosSection").hidden = state.photos.length === 0;
  $("previewPhotos").innerHTML = state.photos.map((photo) => `
    <figure>
      <img src="${photo.dataUrl}" alt="${escapeHtml(photo.label || photo.name)}">
      <figcaption>${escapeHtml(photo.label || photo.name)}</figcaption>
    </figure>
  `).join("");
}

function serializeEstimate() {
  const totals = calculateTotals();
  const data = {
    lineItems: state.lineItems,
    photos: state.photos,
    totals,
    backend: {
      estimatedMaterialCost: totals.total * MATERIAL_PERCENT,
      estimatedGrossProfit: totals.total - totals.total * MATERIAL_PERCENT,
      materialPercent: MATERIAL_PERCENT * 100,
    },
    submittedAt: new Date().toISOString(),
  };
  fields.forEach((field) => {
    data[field] = $(field).value;
  });
  data.showEstimateNumber = $("showEstimateNumber").checked;
  return data;
}

function getEstimateFileName(extension = "json") {
  const estimateNumber = $("estimateNumber").value.trim() || "estimate";
  const clientName = $("clientName").value.trim() || "draft";
  const safeName = `${estimateNumber}-${clientName}`
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${safeName || "estimate-draft"}.${extension}`;
}

async function saveDraftFile(data) {
  const fileName = getEstimateFileName("json");
  const contents = JSON.stringify(data, null, 2);

  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName: fileName,
      types: [{
        description: "D2 Estimate Draft",
        accept: { "application/json": [".json"] },
      }],
    });
    const writable = await handle.createWritable();
    await writable.write(contents);
    await writable.close();
    return;
  }

  const blob = new Blob([contents], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

async function saveEstimate(options = {}) {
  ensureEstimateNumber();
  const estimate = serializeEstimate();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estimate));
  } catch (error) {
    // Some direct file previews block storage; the downloadable draft still works.
  }

  try {
    await saveDraftFile(estimate);
    if (!options.silent) {
      $("saveEstimate").textContent = "Saved";
      setTimeout(() => {
        $("saveEstimate").textContent = "Save";
      }, 1000);
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      window.alert("The browser could not save the draft file. The draft is still saved in this browser.");
    }
    throw error;
  }
}

function hasWorkInProgress() {
  const changedFields = [
    "clientName",
    "clientPhone",
    "clientEmail",
    "projectAddress",
    "flatTotal",
    "discount",
    "depositRate",
    "notes",
  ];
  const hasFieldContent = changedFields.some((field) => $(field).value.trim());
  const hasLineContent = state.lineItems.some((item) => {
    return item.name.trim() || Number.parseFloat(item.qty) > 0 || Number.parseFloat(item.price) > 0;
  });
  return hasFieldContent || hasLineContent || state.photos.length > 0;
}

function openFreshEstimateWindow() {
  const url = new URL(window.location.href);
  url.searchParams.set("new", Date.now());
  window.open(url.toString(), "_blank", "noopener");
}

async function startNewEstimate() {
  if (!hasWorkInProgress()) {
    resetEstimate();
    return;
  }

  const clearCurrent = window.confirm("Clear this estimate and start a fresh blank copy?");
  if (clearCurrent) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Keep clearing the visible estimate even if browser storage is unavailable.
    }
    resetEstimate();
    return;
  }

  const saveFirst = window.confirm("Save this estimate as a draft file before opening a fresh estimate?");
  if (!saveFirst) return;

  try {
    await saveEstimate({ silent: true });
    openFreshEstimateWindow();
  } catch (error) {
    // Save was cancelled or failed; keep the current estimate untouched.
  }
}

async function submitEstimateToGoogle() {
  const status = $("submitStatus");
  if (!GOOGLE_SCRIPT_URL) {
    status.textContent = "Email submit is not connected yet. Use PDF for now.";
    window.alert("Submit/email is not connected yet. For now, use PDF to create the customer copy.");
    return;
  }

  await saveEstimate({ silent: true });
  status.textContent = "Submitting estimate...";

  const iframeName = "googleSubmitFrame";
  let iframe = document.querySelector(`iframe[name="${iframeName}"]`);
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.hidden = true;
    document.body.appendChild(iframe);
  }

  const form = document.createElement("form");
  form.method = "POST";
  form.action = GOOGLE_SCRIPT_URL;
  form.target = iframeName;
  form.hidden = true;

  const payload = document.createElement("input");
  payload.type = "hidden";
  payload.name = "payload";
  payload.value = JSON.stringify(serializeEstimate());
  form.appendChild(payload);

  document.body.appendChild(form);
  iframe.addEventListener("load", () => {
    status.textContent = "Estimate submitted to Google Drive.";
    form.remove();
  }, { once: true });
  form.submit();
}

function loadEstimate() {
  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    return false;
  }
  if (!saved) return false;

  let data = {};
  try {
    data = JSON.parse(saved);
  } catch (error) {
    return false;
  }
  fields.forEach((field) => {
    if (data[field] !== undefined) $(field).value = data[field];
  });
  applyCompanyDefaults();
  state.lineItems = Array.isArray(data.lineItems)
    ? data.lineItems.map((item) => ({ type: "item", ...item }))
    : [];
  state.photos = Array.isArray(data.photos) ? data.photos : [];
  renderLineItems();
  renderPhotos();
  syncProjectMode();
  updatePreview();
  return true;
}

function applyCompanyDefaults() {
  if (!$("companyName").value.trim()) $("companyName").value = COMPANY_DEFAULTS.name;
  if (!$("companyPhone").value.trim()) $("companyPhone").value = COMPANY_DEFAULTS.phone;
  if (!$("companyEmail").value.trim()) $("companyEmail").value = COMPANY_DEFAULTS.email;
  if (!$("companyAddress").value.trim()) $("companyAddress").value = COMPANY_DEFAULTS.address;
}

function syncProjectMode() {
  const isOther = $("projectType").value === "Other";
  document.querySelectorAll("[data-project-pricing]").forEach((element) => {
    element.hidden = isOther;
  });
}

function clearManualEstimate() {
  state.lineItems = [{ id: createId(), type: "item", name: "", qty: "", price: "" }];
  $("finishLevel").value = "";
  $("widthFeet").value = "";
  $("heightFeet").value = "";
  renderLineItems();
  updatePreview();
}

function resetEstimate() {
  const today = new Date();
  $("estimateNumber").value = "";
  $("showEstimateNumber").checked = true;
  state.autoEstimateNumber = true;
  state.estimateNumberCommitted = false;
  $("estimateDate").value = today.toISOString().slice(0, 10);
  $("validUntil").value = addDays(today, 15);
  $("companyName").value = COMPANY_DEFAULTS.name;
  $("estimateTitle").value = "Estimate";
  $("companyPhone").value = COMPANY_DEFAULTS.phone;
  $("companyEmail").value = COMPANY_DEFAULTS.email;
  $("companyAddress").value = COMPANY_DEFAULTS.address;
  $("clientName").value = "";
  $("clientPhone").value = "";
  $("clientEmail").value = "";
  $("projectAddress").value = "";
  $("projectType").value = "Other";
  $("estimateNumber").value = makeEstimateNumber(false);
  $("finishLevel").value = "";
  $("widthFeet").value = "";
  $("heightFeet").value = "";
  $("flatTotal").value = "";
  $("discount").value = "";
  $("discountType").value = "dollar";
  $("taxRate").value = "6.5";
  $("depositRate").value = "";
  $("notes").value = "";
  state.lineItems = [{ id: createId(), type: "item", name: "", qty: "", price: "" }];
  state.photos = [];
  renderLineItems();
  renderPhotos();
  syncProjectMode();
  updatePreview();
}

fields.forEach((field) => {
  $(field).addEventListener("input", updatePreview);
  $(field).addEventListener("change", updatePreview);
});

$("estimateNumber").addEventListener("input", () => {
  state.autoEstimateNumber = false;
  state.estimateNumberCommitted = false;
});

["companyPhone", "clientPhone"].forEach((field) => {
  $(field).addEventListener("input", (event) => {
    formatPhoneInput(event.target);
    updatePreview();
  });
  $(field).addEventListener("blur", (event) => formatPhoneInput(event.target));
});

$("addLineItem").addEventListener("click", () => addLineItem());
$("photoUpload").addEventListener("change", (event) => {
  addPhotos(event.target.files);
  event.target.value = "";
});
$("photoDropzone").addEventListener("click", () => $("photoUpload").click());
$("photoDropzone").addEventListener("dragover", (event) => {
  event.preventDefault();
  $("photoDropzone").classList.add("drag-over");
});
$("photoDropzone").addEventListener("dragleave", () => {
  $("photoDropzone").classList.remove("drag-over");
});
$("photoDropzone").addEventListener("drop", (event) => {
  event.preventDefault();
  $("photoDropzone").classList.remove("drag-over");
  addPhotos(event.dataTransfer.files);
});
$("projectType").addEventListener("change", () => {
  if ($("projectType").value === "Other") {
    clearManualEstimate();
  }
  refreshAutoEstimateNumber();
  syncProjectMode();
});
$("newEstimate").addEventListener("click", () => startNewEstimate().catch(() => {}));
$("saveEstimate").addEventListener("click", () => saveEstimate().catch(() => {}));
$("submitEstimate").addEventListener("click", () => submitEstimateToGoogle().catch(() => {}));
$("printEstimate").addEventListener("click", () => window.print());

if (new URLSearchParams(window.location.search).has("new")) {
  resetEstimate();
} else if (!loadEstimate()) {
  resetEstimate();
}

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("service-worker.js");
}
