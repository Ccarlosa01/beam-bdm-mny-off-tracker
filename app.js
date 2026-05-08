/**
 * GitHub Pages Frontend for MNY BDM Tracker Off
 */

const APPS_SCRIPT_URL = "PASTE_YOUR_DEPLOYED_APPS_SCRIPT_WEB_APP_URL_HERE";
const UPLOAD_KEY = ""; // Must match Code.gs UPLOAD_KEY if you set one.

let trackerData = {
  podFlat: [],
  podBob: [],
  displayFlat: [],
  displayBob: [],
  coldboxFlat: [],
  coldboxBob: []
};

const state = {
  team: "",
  rep: "",
  accounts: ["", "", "", "", "", ""]
};

document.addEventListener("DOMContentLoaded", () => {
  buildAccountSelectors();
  bindEvents();
  loadTrackerData().catch(err => setStatus("Error loading data: " + err.message, true));
});

function bindEvents() {
  document.getElementById("uploadBtn").addEventListener("click", uploadExcel);
  document.getElementById("refreshBtn").addEventListener("click", () => {
    loadTrackerData().catch(err => setStatus("Error refreshing data: " + err.message, true));
  });
  document.getElementById("printBtn").addEventListener("click", () => window.print());

  document.getElementById("teamSelect").addEventListener("change", event => {
    state.team = event.target.value;
    state.rep = "";
    state.accounts = ["", "", "", "", "", ""];
    populateRepDropdown();
    populateAccountDropdowns();
    renderReport();
  });

  document.getElementById("repSelect").addEventListener("change", event => {
    state.rep = event.target.value;
    state.accounts = ["", "", "", "", "", ""];
    populateAccountDropdowns();
    renderReport();
  });
}

function buildAccountSelectors() {
  const container = document.getElementById("accountSelectors");
  container.innerHTML = "";

  for (let i = 0; i < 6; i++) {
    const label = document.createElement("label");
    label.innerHTML = `
      Account ${i + 1}
      <select id="accountSelect${i}">
        <option value="">Select Account</option>
      </select>
    `;
    container.appendChild(label);

    label.querySelector("select").addEventListener("change", event => {
      state.accounts[i] = event.target.value;
      renderReport();
    });
  }
}

async function uploadExcel() {
  const fileInput = document.getElementById("excelUpload");

  if (!fileInput.files.length) {
    setStatus("Please select an Excel file first.", true);
    return;
  }

  const file = fileInput.files[0];
  setStatus("Uploading and importing Excel file...");

  try {
    const base64File = await fileToBase64(file);

    const response = await postToAppsScript({
      action: "uploadExcel",
      uploadKey: UPLOAD_KEY,
      fileName: file.name,
      mimeType: file.type,
      fileData: base64File
    });

    if (!response.success) {
      throw new Error(response.message || "Import failed.");
    }

    setStatus("Excel file imported successfully.");
    await loadTrackerData();

  } catch (error) {
    console.error(error);
    setStatus("Error: " + error.message, true);
  }
}

async function loadTrackerData() {
  setStatus("Loading tracker data...");

  const result = await postToAppsScript({
    action: "getTrackerData",
    uploadKey: UPLOAD_KEY
  });

  if (!result.success) {
    throw new Error(result.message || "Could not load tracker data.");
  }

  trackerData = {
    podFlat: result.data.POD_Flat || [],
    podBob: result.data.POD_BOB_CLEAN?.length ? result.data.POD_BOB_CLEAN : (result.data.POD_BOB_MNY || []),
    displayFlat: result.data.Display_Flat || [],
    displayBob: result.data.Display_BOB || [],
    coldboxFlat: result.data.Coldbox_Flat || [],
    coldboxBob: result.data.Coldbox_BOB || []
  };

  document.getElementById("podRowCount").textContent = trackerData.podFlat.length.toLocaleString();
  document.getElementById("displayRowCount").textContent = trackerData.displayFlat.length.toLocaleString();
  document.getElementById("coldboxRowCount").textContent = trackerData.coldboxFlat.length.toLocaleString();

  populateTeamDropdown();
  populateRepDropdown();
  populateAccountDropdowns();
  renderReport();

  setStatus("Tracker data loaded.");
}

async function postToAppsScript(payload) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error("Apps Script did not return valid JSON. Check deployment permissions and URL.");
  }
}

function populateTeamDropdown() {
  const teams = uniqueSorted(
    trackerData.podFlat
      .filter(row => getField(row, ["Premise"]) === "OFF")
      .map(row => getField(row, ["Team"]))
      .filter(Boolean)
  );

  fillSelect("teamSelect", teams, "Select Team", state.team);
}

function populateRepDropdown() {
  const reps = uniqueSorted(
    trackerData.podFlat
      .filter(row =>
        getField(row, ["Premise"]) === "OFF" &&
        same(getField(row, ["Team"]), state.team)
      )
      .map(row => getField(row, ["Sales Person", "SalesPerson"]))
      .filter(Boolean)
  );

  fillSelect("repSelect", reps, "Select Sales Rep", state.rep);
}

function populateAccountDropdowns() {
  const accounts = getAccountsByRep(state.rep);

  for (let i = 0; i < 6; i++) {
    fillSelect(`accountSelect${i}`, accounts, "Select Account", state.accounts[i]);
  }
}

function getAccountsByRep(rep) {
  if (!rep) return [];

  const accountRows = trackerData.podBob.filter(row =>
    getField(row, ["Premise", "PREMISE"]) === "OFF" &&
    same(getField(row, ["Sales Person", "SalesPerson"]), rep)
  );

  let accounts = accountRows
    .map(row => getField(row, ["Customer", "Account", "Customer Name"]))
    .filter(Boolean);

  // Fallback if POD_BOB_CLEAN headers need adjustment: derive accounts from Display_BOB.
  if (!accounts.length) {
    accounts = trackerData.displayBob
      .filter(row =>
        getField(row, ["Premise", "PREMISE"]) === "OFF" &&
        same(getField(row, ["Sales Person", "SalesPerson"]), rep)
      )
      .map(row => getField(row, ["Customer", "Account", "Customer Name"]))
      .filter(Boolean);
  }

  return uniqueSorted(accounts);
}

function renderReport() {
  const subtitle = document.getElementById("reportSubTitle");
  subtitle.textContent = [
    state.team || "No team selected",
    state.rep || "No rep selected"
  ].join(" • ");

  renderPodBtg();
  renderDisplayBtg();
  renderColdbox();
  renderAccountBreakdowns();
}

function renderPodBtg() {
  const section = document.getElementById("podBtgSection");

  const brandGroups = uniqueSorted(
    trackerData.podFlat
      .filter(row => getField(row, ["Premise"]) === "OFF")
      .map(row => getField(row, ["Brand"]))
      .filter(Boolean)
  );

  if (!brandGroups.length) {
    section.innerHTML = emptySection("POD BTG", "No POD data loaded.");
    return;
  }

  const rows = brandGroups.map(brand => {
    const repRows = trackerData.podFlat.filter(row =>
      getField(row, ["Premise"]) === "OFF" &&
      same(getField(row, ["Sales Person", "SalesPerson"]), state.rep) &&
      same(getField(row, ["Brand"]), brand)
    );

    const teamRows = trackerData.podFlat.filter(row =>
      getField(row, ["Premise"]) === "OFF" &&
      same(getField(row, ["Team"]), state.team) &&
      same(getField(row, ["Brand"]), brand)
    );

    const repActual = sum(repRows, ["POD Act", "POD Actual"]);
    const repGoal = sum(repRows, ["POD Goal"]);
    const teamActual = sum(teamRows, ["POD Act", "POD Actual"]);
    const teamGoal = sum(teamRows, ["POD Goal"]);

    return {
      brand,
      repBtg: repActual - repGoal,
      repAch: percent(repActual, repGoal),
      teamBtg: teamActual - teamGoal,
      teamAch: percent(teamActual, teamGoal)
    };
  });

  const repName = state.rep ? beforeParen(state.rep) : "Rep";
  const teamName = state.team ? beforeParen(state.team) : "AM/Team";

  section.innerHTML = `
    <div class="report-section">
      <div class="section-title">POD BTG</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Brand</th>
              <th class="numeric">${escapeHtml(repName)} BTG</th>
              <th class="numeric">${escapeHtml(repName)} % Ach</th>
              <th class="numeric">${escapeHtml(teamName)} BTG</th>
              <th class="numeric">${escapeHtml(teamName)} % Ach</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td>${escapeHtml(row.brand)}</td>
                <td class="numeric ${row.repBtg < 0 ? "bad" : "good"}">${formatNumber(row.repBtg)}</td>
                <td class="numeric">${formatPercent(row.repAch)}</td>
                <td class="numeric ${row.teamBtg < 0 ? "bad" : "good"}">${formatNumber(row.teamBtg)}</td>
                <td class="numeric">${formatPercent(row.teamAch)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderDisplayBtg() {
  const section = document.getElementById("displayBtgSection");

  const brandGroups = uniqueSorted(
    trackerData.displayFlat
      .filter(row => getField(row, ["Premise"]) === "OFF")
      .map(row => getField(row, ["Brand"]))
      .filter(Boolean)
  );

  if (!brandGroups.length) {
    section.innerHTML = emptySection("Display BTG", "No Display data loaded.");
    return;
  }

  const rows = brandGroups.map(brand => {
    const repRows = trackerData.displayFlat.filter(row =>
      getField(row, ["Premise"]) === "OFF" &&
      same(getField(row, ["Sales Person", "SalesPerson"]), state.rep) &&
      same(getField(row, ["Brand"]), brand)
    );

    const teamRows = trackerData.displayFlat.filter(row =>
      getField(row, ["Premise"]) === "OFF" &&
      same(getField(row, ["Team"]), state.team) &&
      same(getField(row, ["Brand"]), brand)
    );

    const repActual = sum(repRows, ["Display Act"]);
    const repGoal = sum(repRows, ["Display Goal"]);
    const teamActual = sum(teamRows, ["Display Act"]);
    const teamGoal = sum(teamRows, ["Display Goal"]);

    return {
      brand,
      repBtg: repActual - repGoal,
      repAch: percent(repActual, repGoal),
      teamBtg: teamActual - teamGoal,
      teamAch: percent(teamActual, teamGoal)
    };
  });

  section.innerHTML = `
    <div class="report-section">
      <div class="section-title">Display BTG</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Brand</th>
              <th class="numeric">Rep BTG</th>
              <th class="numeric">Rep % Ach</th>
              <th class="numeric">Team BTG</th>
              <th class="numeric">Team % Ach</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td>${escapeHtml(row.brand)}</td>
                <td class="numeric ${row.repBtg < 0 ? "bad" : "good"}">${formatNumber(row.repBtg)}</td>
                <td class="numeric">${formatPercent(row.repAch)}</td>
                <td class="numeric ${row.teamBtg < 0 ? "bad" : "good"}">${formatNumber(row.teamBtg)}</td>
                <td class="numeric">${formatPercent(row.teamAch)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderColdbox() {
  const section = document.getElementById("coldboxSection");

  const brandGroups = uniqueSorted(
    trackerData.coldboxFlat
      .filter(row => getField(row, ["Premise"]) === "OFF")
      .map(row => getField(row, ["Brand"]))
      .filter(Boolean)
  );

  if (!brandGroups.length) {
    section.innerHTML = emptySection("Coldbox", "No Coldbox data loaded.");
    return;
  }

  const selectedAccounts = state.accounts.filter(Boolean);

  const rows = brandGroups.map(brand => {
    const accountStatuses = selectedAccounts.map(account => {
      const matchingRows = trackerData.coldboxBob.filter(row =>
        same(getField(row, ["Customer", "Account", "Customer Name"]), account) &&
        same(getField(row, ["Brand", "Brand Goal Group"]), brand)
      );

      const qualified = matchingRows.some(row =>
        Number(getField(row, ["Qualifier Met", "QualifierMet", "PODs"]) || 0) !== 0
      );

      return qualified ? "Yes" : "";
    });

    return { brand, accountStatuses };
  });

  section.innerHTML = `
    <div class="report-section">
      <div class="section-title">Coldbox Qualification</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Brand</th>
              ${selectedAccounts.map((account, i) => `<th>${escapeHtml(account || "Account " + (i + 1))}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td>${escapeHtml(row.brand)}</td>
                ${row.accountStatuses.map(status => `<td class="${status ? "good" : ""}">${status}</td>`).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAccountBreakdowns() {
  const section = document.getElementById("accountBreakdownSection");
  const accounts = state.accounts.filter(Boolean);

  if (!accounts.length) {
    section.innerHTML = emptySection("Account BOB", "Select at least one account to see account-level details.");
    return;
  }

  section.innerHTML = `
    <div class="report-section">
      <div class="section-title">Account POD Details</div>
      ${accounts.map(account => renderAccountCard(account)).join("")}
    </div>
  `;
}

function renderAccountCard(account) {
  const rows = trackerData.podBob.filter(row =>
    same(getField(row, ["Customer", "Account", "Customer Name"]), account)
  );

  const brandRows = uniqueBy(
    rows.map(row => ({
      brand: getField(row, ["Brand", "Item", "Description"]),
      pod: getField(row, ["PODs", "Counting as a POD", "Qualifier Met"])
    })).filter(row => row.brand),
    row => row.brand
  ).slice(0, 80);

  if (!brandRows.length) {
    return `
      <div class="account-card">
        <h3>${escapeHtml(account)}</h3>
        <p class="empty">No account-level POD detail found. The POD_BOB_MNY header mapping may need a small adjustment.</p>
      </div>
    `;
  }

  return `
    <div class="account-card">
      <h3>${escapeHtml(account)}</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Item / Brand</th>
              <th>Counting as a POD</th>
            </tr>
          </thead>
          <tbody>
            ${brandRows.map(row => `
              <tr>
                <td>${escapeHtml(row.brand)}</td>
                <td>${escapeHtml(row.pod)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function fillSelect(id, values, placeholder, selectedValue) {
  const select = document.getElementById(id);

  select.innerHTML = `<option value="">${placeholder}</option>` +
    values.map(value => `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`).join("");

  if (selectedValue && values.includes(selectedValue)) {
    select.value = selectedValue;
  }
}

function getField(row, candidates) {
  const keys = Object.keys(row || {});
  const normalizedMap = new Map(keys.map(key => [normalizeKey(key), key]));

  for (const candidate of candidates) {
    const exactKey = normalizedMap.get(normalizeKey(candidate));
    if (exactKey !== undefined) {
      const value = row[exactKey];
      return typeof value === "string" ? value.trim() : value;
    }
  }

  return "";
}

function sum(rows, candidates) {
  return rows.reduce((total, row) => {
    const value = Number(getField(row, candidates) || 0);
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function percent(actual, goal) {
  const a = Number(actual || 0);
  const g = Number(goal || 0);
  if (!g) return null;
  return a / g;
}

function uniqueSorted(values) {
  return [...new Set(values.map(v => String(v || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function same(a, b) {
  return String(a || "").trim().toUpperCase() === String(b || "").trim().toUpperCase();
}

function beforeParen(value) {
  return String(value || "").split("(")[0].trim();
}

function formatNumber(value) {
  const number = Number(value || 0);
  return number.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "";
  return Number(value).toLocaleString(undefined, {
    style: "percent",
    maximumFractionDigits: 1
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

function setStatus(message, isError = false) {
  const el = document.getElementById("uploadStatus");
  el.textContent = message;
  el.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function emptySection(title, message) {
  return `
    <div class="report-section">
      <div class="section-title">${escapeHtml(title)}</div>
      <p class="empty">${escapeHtml(message)}</p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
