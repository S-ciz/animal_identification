async function isEndangered(animalName) {

   const names = {
    lion: "Panthera leo",
    leopard: "Panthera pardus",
    cheetah: "Acinonyx jubatus",
    giraffe: "Giraffa camelopardalis",
    zebra: "Equus quagga",
    "african elephant": "Loxodonta africana",
    hyena: "Crocuta crocuta",
    impala: "Aepyceros melampus"
  };

  const name = names[animalName.toLowerCase()] || animalName;

  try {
    const matchResponse = await fetch(
      `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(name)}`
    );

    if (!matchResponse.ok) return null;

    const match = await matchResponse.json();
    if (!match.usageKey || match.rank !== "SPECIES") return null;

    const response = await fetch(
      `https://api.gbif.org/v1/species/${match.usageKey}/iucnRedListCategory`
    );

    if (!response.ok) return null;

    const data = await response.json();
    const category = data.iucnRedListCategory ?? data.category;

    if (!category) return null;

    return ["CR", "EN", "VU"].includes(category);
  } catch(err) {
    console.log(err)
    return null;
  }
}

// Example:

// Returns true, false, or null if the status is unavailable.
const IUCN = {
  CR: { label: "Critically Endangered", level: "danger" },
  EN: { label: "Endangered",            level: "danger" },
  VU: { label: "Vulnerable",            level: "watch"  },
  NT: { label: "Near Threatened",       level: "watch"  },
  LC: { label: "Least Concern",         level: "safe"   },
  DD: { label: "Data Deficient",        level: "unknown"},
  NE: { label: "Not Evaluated",         level: "unknown"}
};

const SPECIES_STATUS = {
  "lion": "VU",
  "leopard": "VU",
  "cheetah": "VU",
  "african wild dog": "EN",
  "spotted hyena": "LC",
  "african elephant": "EN",
  "black rhino": "CR",
  "white rhino": "NT",
  "giraffe": "VU",
  "hippo": "VU",
  "plains zebra": "NT",
  "cape buffalo": "NT",
  "impala": "LC",
  "blue wildebeest": "LC",
  "warthog": "LC"
};

// ---------- Configuration ----------
// Change API_URL here if your Flask server runs on a different address or port.
const API_URL = "http://localhost:5000/predict";
const MAX_SIZE_MB = 10;
const TIMEOUT_MS = 30000;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const settings = { apiUrl: API_URL };

// ---------- Elements ----------
const $ = id => document.getElementById(id);
const dropZone = $("drop-zone"), fileInput = $("file-input"), form = $("upload-form");
const previewWrap = $("preview-wrap"), previewImg = $("preview");
const fileName = $("file-name"), fileSize = $("file-size");
const submitBtn = $("submit-btn"), formError = $("form-error");
const emptyState = $("empty-state"), loading = $("loading"), resultBox = $("result");
const apiError = $("api-error"), apiErrorText = $("api-error-text");
const historyCard = $("history-card"), historyList = $("history-list");

let currentFile = null;
let controller = null;
let previewUrl = null;
let history = [];

const show = el => el.classList.remove("hidden");
const hide = el => el.classList.add("hidden");

// ---------- Server status ----------
function setStatus(state, text) {
  $("status-dot").className = "dot " + state;
  $("status-text").textContent = text;
}

async function checkServer() {
  setStatus("", "Checking server...");
  try {
    const base = new URL(settings.apiUrl);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    // Any HTTP reply (even 405 for GET) proves the server is reachable.
    await fetch(base.origin + "/", { method: "GET", signal: ctrl.signal });
    clearTimeout(t);
    setStatus("online", "Server online");
  } catch (e) {
    setStatus("offline", "Server offline");
  }
}

// ---------- File handling ----------
function formatSize(bytes) {
  return bytes < 1048576 ? (bytes / 1024).toFixed(0) + " KB" : (bytes / 1048576).toFixed(1) + " MB";
}

function showFormError(msg) { formError.textContent = msg; show(formError); }

function validate(file) {
  if (!file) return "No file was selected.";
  if (!ALLOWED_TYPES.includes(file.type)) return "That file type is not supported. Please choose a JPG, PNG or WEBP image.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_SIZE_MB * 1048576) return "That image is too large (" + formatSize(file.size) + "). The limit is " + MAX_SIZE_MB + " MB.";
  return null;
}

function setFile(file) {
  hide(formError);
  hideOutputs();
  const problem = validate(file);
  if (problem) {
    clearFile(false);
    showFormError(problem);
    return;
  }
  currentFile = file;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  previewImg.src = previewUrl;
  fileName.textContent = file.name;
  fileSize.textContent = formatSize(file.size);
  show(previewWrap);
  submitBtn.disabled = false;
  show(emptyState);
}

function clearFile(resetInput = true) {
  currentFile = null;
  if (resetInput) fileInput.value = "";
  if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
  previewImg.removeAttribute("src");
  hide(previewWrap);
  submitBtn.disabled = true;
}

previewImg.addEventListener("error", () => {
  clearFile();
  showFormError("This image could not be opened. It may be damaged. Please try another file.");
});

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener("change", () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });
$("remove-btn").addEventListener("click", () => { clearFile(); hideOutputs(); show(emptyState); hide(formError); });

["dragenter", "dragover"].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add("dragging"); }));
["dragleave", "drop"].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.remove("dragging"); }));
dropZone.addEventListener("drop", e => {
  const files = e.dataTransfer.files;
  if (files.length > 1) { showFormError("Please drop one image at a time."); return; }
  if (files[0]) setFile(files[0]);
});

// Paste an image from the clipboard
document.addEventListener("paste", e => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) { setFile(item.getAsFile()); break; }
  }
});

// ---------- Output state helpers ----------
function hideOutputs() { hide(emptyState); hide(loading); hide(resultBox); hide(apiError); }

function showLoading() {
  hideOutputs();
  show(loading);
  submitBtn.disabled = true;
  submitBtn.textContent = "Analysing...";
}
function endLoading() {
  hide(loading);
  submitBtn.textContent = "Identify animal";
  submitBtn.disabled = !currentFile;
}

function showApiError(msg) {
  hideOutputs();
  apiErrorText.textContent = msg;
  show(apiError);
}

// ---------- Prediction ----------
form.addEventListener("submit", e => { e.preventDefault(); runPrediction(); });
$("retry-btn").addEventListener("click", runPrediction);
$("cancel-btn").addEventListener("click", () => { if (controller) controller.abort("cancelled"); });
$("again-btn").addEventListener("click", () => {
  clearFile(); hideOutputs(); show(emptyState); window.scrollTo({ top: 0, behavior: "smooth" });
});

async function runPrediction() {
  if (!currentFile) { showFormError("Please choose a photo first."); return; }
  const problem = validate(currentFile);
  if (problem) { showFormError(problem); return; }

  hide(formError);
  showLoading();
  controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), TIMEOUT_MS);

  try {
    const data = await callServer(controller.signal);
    const status = (await isEndangered(data.species)) == true ? "VU" : (await isEndangered(data.species)) == false ? "LC": "DD"



console.log("RAW API RESPONSE:", data);

const result = {...normalise(data), "status": status};

console.log("NORMALISED RESULT:", result);

renderResult(result);;
  } catch (err) {
    const reason = controller.signal.reason;
    if (reason === "cancelled") { hideOutputs(); show(emptyState); }
    else if (reason === "timeout") showApiError("The server took too long to answer. Please try again.");
    else showApiError(err.userMessage || "Could not reach the server. Check that it is running at " + settings.apiUrl + ".");
  } finally {
    clearTimeout(timer);
    endLoading();
  }
}

async function callServer(signal) {
  const body = new FormData();
  body.append("image", currentFile);
  let response;
  try {
    response = await fetch(settings.apiUrl, { method: "POST", body, signal });
  } catch (e) {
    if (signal.aborted) throw e;
    setStatus("offline", "Server offline");
    throw { userMessage: "Could not reach the server. Check that it is running at " + settings.apiUrl + "." };
  }
  setStatus("online", "Server online");

  if (!response.ok) {
    let detail = "";
    try { const j = await response.json(); detail = j.error || j.message || ""; } catch (e) { /* not JSON */ }
    const messages = {
      400: "The server could not read this image. " + detail,
      413: "The image is too large for the server.",
      415: "The server does not accept this file type.",
      500: "The server had a problem while analysing the photo. " + detail,
      503: "The model is not ready yet. Please wait a moment and try again."
    };
    throw { userMessage: (messages[response.status] || "The server returned an error (status " + response.status + "). " + detail).trim() };
  }
  try {
   
    return await response.json();
  } catch (e) {
    throw { userMessage: "The server sent a reply that could not be understood." };
  }
}

// Tolerant reading of the server reply
function normalise(d) {
  if (!d || typeof d !== "object") throw { userMessage: "The server sent an empty reply." };
  const species = d.species ? String(d.species) : null;
  const conf = typeof d.confidence === "number" ? Math.max(0, Math.min(1, d.confidence)) : null;
  return {
    identified: d.identified === true || d.status === "known",
    newIndividual: d.new_individual === true || d.status === "unknown" && !!species,
    species: species,
    individualId: d.individual_id || null,
    confidence: conf,
    status: d.iucn_status || null
  };
}

// ---------- Rendering ----------
function statusFor(r) {
  const code = (r.status || SPECIES_STATUS[(r.species || "").toLowerCase()] || "").toUpperCase();
  return IUCN[code] ? Object.assign({ code }, IUCN[code]) : null;
}

function titleCase(s) { return s.replace(/\b\w/g, c => c.toUpperCase()); }

function renderResult(r) {
  hideOutputs();
  const banner = $("identified-banner");
  banner.className = "banner";

  if (!r.species) {
    banner.classList.add("none");
    $("banner-icon").textContent = "?";
    $("banner-title").textContent = "Animal not recognised";
    $("banner-sub").textContent = "We could not find an animal we know in this photo. Try a clearer image where the whole animal is visible.";
  } else if (r.identified) {
    banner.classList.add("ok");
    $("banner-icon").textContent = "✔";
    $("banner-title").textContent = "Animal identified";
    $("banner-sub").textContent = "This animal matches an individual already in the database.";
  } else {
    banner.classList.add("new");
    $("banner-icon").textContent = "+";
    $("banner-title").textContent = "New animal";
    $("banner-sub").textContent = r.newIndividual
      ? "We have not seen this individual before. It has been added as a new record."
      : "We have not seen this individual before.";
  }

  $("r-species").textContent = r.species ? titleCase(r.species) : "Unknown";
  $("r-individual").textContent = r.individualId || (r.species ? "New individual" : "—");
  $("r-confidence").textContent = r.confidence === null ? "n/a" : (r.confidence * 100).toFixed(0) + "%";
  $("meter-fill").style.width = r.confidence === null ? "0%" : (r.confidence * 100) + "%";

  const st = statusFor(r);
  const badge = $("r-status"), note = $("endangered-note");
  if (!r.species) {
    badge.className = "badge unknown"; badge.textContent = "Not available";
    note.className = "endangered-note unknown"; note.textContent = "Conservation status needs a recognised animal.";
  } else if (!st) {
    badge.className = "badge unknown"; badge.textContent = "Not listed";
    note.className = "endangered-note unknown"; note.textContent = "No conservation status is stored for this species yet.";
  } else {
    badge.className = "badge " + st.level; badge.textContent = st.label + " (" + st.code + ")";
    note.className = "endangered-note " + st.level;
    if (st.code === "CR" || st.code === "EN") note.textContent = "Endangered: yes. This species faces a very high risk of extinction in the wild.";
    else if (st.code === "VU") note.textContent = "Endangered: not yet, but this species is Vulnerable and faces a high risk of extinction in the wild.";
    else if (st.code === "NT") note.textContent = "Endangered: no. This species is Near Threatened and could become threatened soon.";
    else if (st.code === "LC") note.textContent = "Endangered: no. This species is of Least Concern.";
    else note.textContent = "There is not enough data to judge the risk to this species.";
  }

  show(resultBox);
  addHistory(r, st);
}

// ---------- History (kept in memory for this visit) ----------
function addHistory(r, st) {
  history.unshift({ url: previewUrl, species: r.species ? titleCase(r.species) : "Not recognised",
    identified: r.identified, status: st ? st.label : "No status", time: new Date().toLocaleTimeString() });
  history = history.slice(0, 5);
  historyList.innerHTML = "";
  history.forEach(h => {
    const li = document.createElement("li");
    li.className = "history-item";
    const img = document.createElement("img"); img.src = h.url; img.alt = "";
    const main = document.createElement("div"); main.className = "h-main";
    const sp = document.createElement("div"); sp.className = "h-species"; sp.textContent = h.species;
    const sub = document.createElement("div"); sub.className = "h-sub";
    sub.textContent = (h.identified ? "Identified" : "Not identified") + " · " + h.status + " · " + h.time;
    main.append(sp, sub); li.append(img, main); historyList.append(li);
  });
  show(historyCard);
}
$("clear-history").addEventListener("click", () => { history = []; historyList.innerHTML = ""; hide(historyCard); });

checkServer();
