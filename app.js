const state = {
  user: null,
  profile: null,
  municipality: null,
  surveyResponses: [],
  lodgingInventory: [],
  charts: {},
  filters: {
    startDate: "",
    endDate: "",
    origin: "",
    purpose: "",
  },
};

const el = {
  authScreen: document.getElementById("authScreen"),
  appContent: document.getElementById("appContent"),
  toast: document.getElementById("toast"),
  municipalityName: document.getElementById("municipalityName"),
  viewTitle: document.getElementById("viewTitle"),
  viewSubtitle: document.getElementById("viewSubtitle"),
  surveyTableBody: document.getElementById("surveyTableBody"),
  lodgingTableBody: document.getElementById("lodgingTableBody"),
  insightsList: document.getElementById("insightsList"),
  reportSummary: document.getElementById("reportSummary"),
  profileMunicipalityInput: document.getElementById("profileMunicipalityInput"),
  profileProvinceInput: document.getElementById("profileProvinceInput"),
  profileDepartmentInput: document.getElementById("profileDepartmentInput"),
  profileEmailInput: document.getElementById("profileEmailInput"),
  filterStartDate: document.getElementById("filterStartDate"),
  filterEndDate: document.getElementById("filterEndDate"),
  filterOrigin: document.getElementById("filterOrigin"),
  filterPurpose: document.getElementById("filterPurpose"),
};

const viewMeta = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Indicadores en tiempo real del destino",
  },
  survey: {
    title: "Encuestas",
    subtitle: "Carga y revisión de relevamientos turísticos",
  },
  lodging: {
    title: "Alojamientos",
    subtitle: "Inventario local de oferta y plazas",
  },
  reports: {
    title: "Reportes",
    subtitle: "Síntesis ejecutiva y exportables",
  },
  settings: {
    title: "Configuración",
    subtitle: "Datos institucionales del municipio",
  },
};

let supabaseClient = null;

function initSupabase() {
  if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY ||
      window.SUPABASE_URL.includes("TU-PROYECTO") || window.SUPABASE_ANON_KEY.includes("TU_ANON")) {
    showToast("Configurá Supabase en supabase.js antes de usar la app.");
    return false;
  }
  supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  return true;
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => el.toast.classList.add("hidden"), 2600);
}

function money(value) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function number(value, digits = 0) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Number(value || 0));
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("es-AR");
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function setActiveView(viewName) {
  document.querySelectorAll(".nav-link").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });
  document.querySelectorAll(".view").forEach(view => view.classList.add("hidden"));
  const target = document.getElementById(`${viewName}View`);
  if (target) target.classList.remove("hidden");

  el.viewTitle.textContent = viewMeta[viewName].title;
  el.viewSubtitle.textContent = viewMeta[viewName].subtitle;
}

function populateFilterOptions() {
  const origins = [...new Set(state.surveyResponses.map(r => r.origin_place).filter(Boolean))].sort();
  const purposes = [...new Set(state.surveyResponses.map(r => r.purpose).filter(Boolean))].sort();

  el.filterOrigin.innerHTML = `<option value="">Todos</option>` + origins.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  el.filterPurpose.innerHTML = `<option value="">Todos</option>` + purposes.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFilteredSurveyResponses() {
  return state.surveyResponses.filter(row => {
    if (state.filters.startDate && row.visit_date < state.filters.startDate) return false;
    if (state.filters.endDate && row.visit_date > state.filters.endDate) return false;
    if (state.filters.origin && row.origin_place !== state.filters.origin) return false;
    if (state.filters.purpose && row.purpose !== state.filters.purpose) return false;
    return true;
  });
}

function renderSurveyTable() {
  const rows = [...state.surveyResponses]
    .sort((a, b) => (a.visit_date < b.visit_date ? 1 : -1))
    .slice(0, 15);

  el.surveyTableBody.innerHTML = rows.map(row => `
    <tr>
      <td>${formatDate(row.visit_date)}</td>
      <td>${escapeHtml(row.origin_place)}</td>
      <td>${number(row.group_size)}</td>
      <td>${escapeHtml(row.purpose)}</td>
      <td>${number(row.nights)}</td>
      <td>${money(row.estimated_spend_ars)}</td>
    </tr>
  `).join("") || `<tr><td colspan="6">Todavía no hay encuestas cargadas.</td></tr>`;
}

function renderLodgingTable() {
  const rows = [...state.lodgingInventory].sort((a, b) => a.name.localeCompare(b.name));
  el.lodgingTableBody.innerHTML = rows.map(row => `
    <tr>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.category)}</td>
      <td>${number(row.units)}</td>
      <td>${number(row.beds)}</td>
      <td>${row.is_active ? "Activo" : "Inactivo"}</td>
    </tr>
  `).join("") || `<tr><td colspan="5">Todavía no hay alojamientos cargados.</td></tr>`;
}

function destroyChart(name) {
  if (state.charts[name]) {
    state.charts[name].destroy();
    delete state.charts[name];
  }
}

function buildCountMap(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "Sin dato";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function buildMonthlyTrend(rows) {
  const map = {};
  rows.forEach(row => {
    const month = (row.visit_date || "").slice(0, 7);
    if (!month) return;
    map[month] = (map[month] || 0) + Number(row.group_size || 0);
  });
  const entries = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  return {
    labels: entries.map(([m]) => {
      const [y, mo] = m.split("-");
      return `${mo}/${y.slice(-2)}`;
    }),
    values: entries.map(([, v]) => v),
  };
}

function renderCharts() {
  const rows = getFilteredSurveyResponses();
  const originMap = buildCountMap(rows, "origin_place");
  const purposeMap = buildCountMap(rows, "purpose");
  const lodgingMap = buildCountMap(rows, "lodging_type");
  const trend = buildMonthlyTrend(rows);

  destroyChart("origin");
  destroyChart("purpose");
  destroyChart("trend");
  destroyChart("lodging");

  state.charts.origin = new Chart(document.getElementById("originChart"), {
    type: "doughnut",
    data: {
      labels: Object.keys(originMap),
      datasets: [{ data: Object.values(originMap) }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  state.charts.purpose = new Chart(document.getElementById("purposeChart"), {
    type: "bar",
    data: {
      labels: Object.keys(purposeMap),
      datasets: [{ data: Object.values(purposeMap) }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  state.charts.trend = new Chart(document.getElementById("trendChart"), {
    type: "line",
    data: {
      labels: trend.labels,
      datasets: [{ data: trend.values, fill: false, tension: .25 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  state.charts.lodging = new Chart(document.getElementById("lodgingChart"), {
    type: "pie",
    data: {
      labels: Object.keys(lodgingMap),
      datasets: [{ data: Object.values(lodgingMap) }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function renderKpisAndInsights() {
  const rows = getFilteredSurveyResponses();
  const visitors = rows.length;
  const totalNights = rows.reduce((sum, row) => sum + Number(row.nights || 0), 0);
  const avgNights = visitors ? totalNights / visitors : 0;
  const avgSpend = visitors ? rows.reduce((sum, row) => sum + Number(row.estimated_spend_ars || 0), 0) / visitors : 0;
  const beds = state.lodgingInventory.filter(x => x.is_active).reduce((sum, row) => sum + Number(row.beds || 0), 0);

  document.getElementById("kpiVisitors").textContent = number(visitors);
  document.getElementById("kpiNights").textContent = number(avgNights, 1);
  document.getElementById("kpiSpend").textContent = money(avgSpend);
  document.getElementById("kpiBeds").textContent = number(beds);

  const originMap = buildCountMap(rows, "origin_place");
  const purposeMap = buildCountMap(rows, "purpose");
  const topOrigin = Object.entries(originMap).sort((a,b) => b[1]-a[1])[0];
  const topPurpose = Object.entries(purposeMap).sort((a,b) => b[1]-a[1])[0];
  const noOvernight = rows.filter(r => Number(r.nights || 0) === 0).length;
  const withOvernight = rows.filter(r => Number(r.nights || 0) > 0).length;
  const overnightShare = visitors ? (withOvernight / visitors) * 100 : 0;

  const insights = [];
  if (topOrigin) insights.push(`La procedencia más relevada es ${topOrigin[0]}, con ${number(topOrigin[1])} encuestas. Esto sirve para orientar campañas y acuerdos promocionales.`);
  if (topPurpose) insights.push(`El motivo dominante es ${topPurpose[0]}. La agenda de productos y comunicación debería alinearse con esa demanda real, no con intuiciones.`);
  insights.push(`El promedio de estadía es de ${number(avgNights, 1)} noches y el gasto promedio estimado es de ${money(avgSpend)} por grupo.`);
  insights.push(`El ${number(overnightShare, 1)}% de los registros pernocta. Si ese ratio es bajo, el municipio tiene un problema de excursión sin derrame o de oferta insuficiente.`);
  if (beds > 0) insights.push(`Hay ${number(beds)} plazas activas registradas. Sin inventario de camas, hablar de ocupación es vender humo con PowerPoint.`);

  el.insightsList.innerHTML = insights.map(item => `<li>${escapeHtml(item)}</li>`).join("");

  el.reportSummary.innerHTML = `
    <div class="report-block"><strong>Base relevada:</strong> ${number(visitors)} encuestas bajo los filtros activos.</div>
    <div class="report-block"><strong>Demanda:</strong> estadía promedio de ${number(avgNights,1)} noches y gasto medio de ${money(avgSpend)} por grupo.</div>
    <div class="report-block"><strong>Mercado principal:</strong> ${topOrigin ? escapeHtml(topOrigin[0]) : "Sin dato"}.</div>
    <div class="report-block"><strong>Motivación dominante:</strong> ${topPurpose ? escapeHtml(topPurpose[0]) : "Sin dato"}.</div>
    <div class="report-block"><strong>Oferta:</strong> ${number(beds)} plazas activas declaradas en la base local.</div>
  `;
}

function renderAll() {
  populateFilterOptions();
  renderSurveyTable();
  renderLodgingTable();
  renderCharts();
  renderKpisAndInsights();
  renderProfileForm();
}

function renderProfileForm() {
  const muniName = state.municipality?.name || "";
  document.getElementById("municipalityName").textContent = muniName || "—";
  el.profileMunicipalityInput.value = muniName;
  el.profileProvinceInput.value = state.municipality?.province || "";
  el.profileDepartmentInput.value = state.municipality?.department || "";
  el.profileEmailInput.value = state.municipality?.public_contact_email || "";
}

async function fetchSessionAndData() {
  if (!supabaseClient) return;
  const { data: { session } } = await supabaseClient.auth.getSession();
  state.user = session?.user || null;

  if (!state.user) {
    el.authScreen.classList.remove("hidden");
    el.appContent.classList.add("hidden");
    return;
  }

  el.authScreen.classList.add("hidden");
  el.appContent.classList.remove("hidden");

  await fetchProfile();
  await Promise.all([fetchSurveyResponses(), fetchLodgingInventory()]);
  renderAll();
}

async function fetchProfile() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, municipality_id, role, municipalities(*)")
    .eq("id", state.user.id)
    .single();

  if (error) {
    console.error(error);
    showToast("No se pudo cargar el perfil.");
    return;
  }

  state.profile = data;
  state.municipality = data.municipalities;
}

async function fetchSurveyResponses() {
  const municipalityId = state.profile?.municipality_id;
  if (!municipalityId) return;

  const { data, error } = await supabaseClient
    .from("survey_responses")
    .select("*")
    .eq("municipality_id", municipalityId)
    .order("visit_date", { ascending: false });

  if (error) {
    console.error(error);
    showToast("No se pudieron cargar las encuestas.");
    return;
  }

  state.surveyResponses = data || [];
}

async function fetchLodgingInventory() {
  const municipalityId = state.profile?.municipality_id;
  if (!municipalityId) return;

  const { data, error } = await supabaseClient
    .from("lodging_inventory")
    .select("*")
    .eq("municipality_id", municipalityId)
    .order("name", { ascending: true });

  if (error) {
    console.error(error);
    showToast("No se pudo cargar el inventario de alojamientos.");
    return;
  }

  state.lodgingInventory = data || [];
}

async function handleLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const email = form.get("email");
  const password = form.get("password");

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    showToast(error.message);
    return;
  }
  showToast("Sesión iniciada.");
  await fetchSessionAndData();
}

async function handleSignup(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = {
    municipality_name: form.get("municipality_name"),
    email: form.get("email"),
    password: form.get("password"),
  };

  const { data, error } = await supabaseClient.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        municipality_name: payload.municipality_name,
      }
    }
  });

  if (error) {
    showToast(error.message);
    return;
  }

  showToast("Cuenta creada. Revisá el email si activaste confirmación.");
  if (data?.user) {
    await fetchSessionAndData();
  }
}

async function handleLogout() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    showToast(error.message);
    return;
  }
  state.user = null;
  state.profile = null;
  state.municipality = null;
  state.surveyResponses = [];
  state.lodgingInventory = [];
  el.authScreen.classList.remove("hidden");
  el.appContent.classList.add("hidden");
}

async function handleSurveySubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());
  payload.municipality_id = state.profile.municipality_id;
  payload.group_size = Number(payload.group_size || 0);
  payload.nights = Number(payload.nights || 0);
  payload.estimated_spend_ars = Number(payload.estimated_spend_ars || 0);

  const { error } = await supabaseClient.from("survey_responses").insert(payload);
  if (error) {
    showToast(error.message);
    return;
  }

  event.currentTarget.reset();
  event.currentTarget.visit_date.valueAsDate = new Date();
  showToast("Encuesta guardada.");
  await fetchSurveyResponses();
  renderAll();
}

async function handleLodgingSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());
  payload.municipality_id = state.profile.municipality_id;
  payload.units = Number(payload.units || 0);
  payload.beds = Number(payload.beds || 0);
  payload.is_active = payload.is_active === "true";

  const { error } = await supabaseClient.from("lodging_inventory").insert(payload);
  if (error) {
    showToast(error.message);
    return;
  }

  event.currentTarget.reset();
  showToast("Alojamiento guardado.");
  await fetchLodgingInventory();
  renderAll();
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());

  const { error } = await supabaseClient
    .from("municipalities")
    .update(payload)
    .eq("id", state.profile.municipality_id);

  if (error) {
    showToast(error.message);
    return;
  }

  state.municipality = { ...state.municipality, ...payload };
  renderProfileForm();
  showToast("Configuración actualizada.");
}

async function seedDemoData() {
  if (!state.profile?.municipality_id) {
    showToast("Primero iniciá sesión.");
    return;
  }

  const municipality_id = state.profile.municipality_id;
  const today = new Date();
  const monthString = (offset) => {
    const d = new Date(today.getFullYear(), today.getMonth() - offset, 14);
    return d.toISOString().slice(0, 10);
  };

  const surveySeed = [
    { municipality_id, visit_date: monthString(0), capture_channel: "QR", origin_place: "CABA", group_size: 2, purpose: "Vacaciones", nights: 3, lodging_type: "Hotel", estimated_spend_ars: 180000, activities: "Gastronomía y paseo costero" },
    { municipality_id, visit_date: monthString(0), capture_channel: "Evento", origin_place: "Rosario", group_size: 4, purpose: "Evento", nights: 1, lodging_type: "Cabaña", estimated_spend_ars: 240000, activities: "Festival local" },
    { municipality_id, visit_date: monthString(1), capture_channel: "Punto de informes", origin_place: "La Plata", group_size: 3, purpose: "Vacaciones", nights: 2, lodging_type: "Hotel", estimated_spend_ars: 150000, activities: "Termas y gastronomía" },
    { municipality_id, visit_date: monthString(1), capture_channel: "Encuestador", origin_place: "Córdoba", group_size: 2, purpose: "Trabajo / negocios", nights: 1, lodging_type: "Hotel", estimated_spend_ars: 98000, activities: "Reuniones y cena" },
    { municipality_id, visit_date: monthString(2), capture_channel: "QR", origin_place: "Mar del Plata", group_size: 5, purpose: "Visita a familiares/amigos", nights: 4, lodging_type: "Casa de familiares/amigos", estimated_spend_ars: 210000, activities: "Visita familiar y paseo" },
  ];

  const lodgingSeed = [
    { municipality_id, name: "Hotel Plaza Centro", category: "Hotel", units: 24, beds: 58, contact_name: "Recepción", is_active: true },
    { municipality_id, name: "Cabañas La Ribera", category: "Cabaña", units: 10, beds: 36, contact_name: "Administración", is_active: true },
    { municipality_id, name: "Camping Municipal", category: "Camping", units: 40, beds: 80, contact_name: "Turismo", is_active: true },
  ];

  const { error: sErr } = await supabaseClient.from("survey_responses").insert(surveySeed);
  if (sErr) {
    showToast(sErr.message);
    return;
  }
  const { error: lErr } = await supabaseClient.from("lodging_inventory").insert(lodgingSeed);
  if (lErr) {
    showToast(lErr.message);
    return;
  }

  await Promise.all([fetchSurveyResponses(), fetchLodgingInventory()]);
  renderAll();
  showToast("Demo cargada.");
}

function exportSurveyCsv() {
  const rows = getFilteredSurveyResponses();
  const headers = ["visit_date","capture_channel","origin_place","group_size","purpose","nights","lodging_type","estimated_spend_ars","activities","notes"];
  const csv = [headers.join(",")]
    .concat(rows.map(row => headers.map(h => `"${String(row[h] ?? "").replaceAll('"','""')}"`).join(",")))
    .join("\n");

  downloadFile("encuestas_turisticas.csv", csv, "text/csv;charset=utf-8;");
}

function downloadReportJson() {
  const rows = getFilteredSurveyResponses();
  const payload = {
    generated_at: new Date().toISOString(),
    municipality: state.municipality,
    filters: state.filters,
    metrics: {
      visitors: rows.length,
      avg_nights: rows.length ? rows.reduce((sum, row) => sum + Number(row.nights || 0), 0) / rows.length : 0,
      avg_spend_ars: rows.length ? rows.reduce((sum, row) => sum + Number(row.estimated_spend_ars || 0), 0) / rows.length : 0,
      beds_active: state.lodgingInventory.filter(x => x.is_active).reduce((sum, row) => sum + Number(row.beds || 0), 0),
    },
    survey_responses: rows,
    lodging_inventory: state.lodgingInventory,
  };
  downloadFile("reporte_observatorio.json", JSON.stringify(payload, null, 2), "application/json");
}

function bindFilters() {
  el.filterStartDate.addEventListener("change", (e) => {
    state.filters.startDate = e.target.value;
    renderAll();
  });
  el.filterEndDate.addEventListener("change", (e) => {
    state.filters.endDate = e.target.value;
    renderAll();
  });
  el.filterOrigin.addEventListener("change", (e) => {
    state.filters.origin = e.target.value;
    renderAll();
  });
  el.filterPurpose.addEventListener("change", (e) => {
    state.filters.purpose = e.target.value;
    renderAll();
  });
  document.getElementById("clearFiltersBtn").addEventListener("click", () => {
    state.filters = { startDate: "", endDate: "", origin: "", purpose: "" };
    el.filterStartDate.value = "";
    el.filterEndDate.value = "";
    el.filterOrigin.value = "";
    el.filterPurpose.value = "";
    renderAll();
  });
}

function bindUi() {
  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  document.getElementById("signupForm").addEventListener("submit", handleSignup);
  document.getElementById("logoutBtn").addEventListener("click", handleLogout);
  document.getElementById("surveyForm").addEventListener("submit", handleSurveySubmit);
  document.getElementById("lodgingForm").addEventListener("submit", handleLodgingSubmit);
  document.getElementById("profileForm").addEventListener("submit", handleProfileSubmit);
  document.getElementById("seedDemoBtn").addEventListener("click", seedDemoData);
  document.getElementById("syncBtn").addEventListener("click", async () => {
    await Promise.all([fetchSurveyResponses(), fetchLodgingInventory()]);
    renderAll();
    showToast("Datos sincronizados.");
  });
  document.getElementById("exportSurveyCsvBtn").addEventListener("click", exportSurveyCsv);
  document.getElementById("downloadReportJsonBtn").addEventListener("click", downloadReportJson);
  document.getElementById("printReportBtn").addEventListener("click", () => window.print());

  document.querySelectorAll(".nav-link").forEach(btn => {
    btn.addEventListener("click", () => {
      setActiveView(btn.dataset.view);
      document.getElementById("sidebar").classList.remove("open");
    });
  });

  document.getElementById("menuBtn").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  bindFilters();
}

async function startApp() {
  bindUi();
  document.querySelector('input[name="visit_date"]').valueAsDate = new Date();

  const ready = initSupabase();
  if (!ready) return;

  supabaseClient.auth.onAuthStateChange(async () => {
    await fetchSessionAndData();
  });

  await fetchSessionAndData();
}

startApp();
