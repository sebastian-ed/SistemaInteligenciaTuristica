const state = {
  user: null,
  profile: null,
  municipality: null,
  surveyResponses: [],
  lodgingInventory: [],
  charts: {},
  filters: { startDate: "", endDate: "", origin: "", purpose: "" },
};

const el = {
  authScreen: document.getElementById("authScreen"),
  appContent: document.getElementById("appContent"),
  toast: document.getElementById("toast"),
  municipalityName: document.getElementById("municipalityName"),
  miniDatasetInfo: document.getElementById("miniDatasetInfo"),
  viewTitle: document.getElementById("viewTitle"),
  viewSubtitle: document.getElementById("viewSubtitle"),
  surveyTableBody: document.getElementById("surveyTableBody"),
  lodgingTableBody: document.getElementById("lodgingTableBody"),
  insightsList: document.getElementById("insightsList"),
  reportsInsightsList: document.getElementById("reportsInsightsList"),
  reportSummary: document.getElementById("reportSummary"),
  profileMunicipalityInput: document.getElementById("profileMunicipalityInput"),
  profileProvinceInput: document.getElementById("profileProvinceInput"),
  profileDepartmentInput: document.getElementById("profileDepartmentInput"),
  profileEmailInput: document.getElementById("profileEmailInput"),
  filterStartDate: document.getElementById("filterStartDate"),
  filterEndDate: document.getElementById("filterEndDate"),
  filterOrigin: document.getElementById("filterOrigin"),
  filterPurpose: document.getElementById("filterPurpose"),
  backToDashboardBtn: document.getElementById("backToDashboardBtn"),
};

const viewMeta = {
  dashboard: { title: "Dashboard", subtitle: "Indicadores en tiempo real del destino" },
  survey: { title: "Encuestas", subtitle: "Captura mejorada y revisión operativa" },
  lodging: { title: "Alojamientos", subtitle: "Inventario local de oferta y plazas" },
  reports: { title: "Reportes", subtitle: "Síntesis ejecutiva y exportables" },
  settings: { title: "Configuración", subtitle: "Datos institucionales del municipio" },
};

let supabaseClient = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => el.toast.classList.add("hidden"), 3200);
}

function setButtonBusy(btn, busy, labelBusy, labelIdle) {
  if (!btn) return;
  btn.disabled = busy;
  btn.textContent = busy ? labelBusy : labelIdle;
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

function initSupabase() {
  try {
    if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      showToast("Configurá Supabase en supabase.js antes de usar la app.");
      return false;
    }
    supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    return true;
  } catch (error) {
    console.error(error);
    showToast("No se pudo inicializar Supabase.");
    return false;
  }
}

function setActiveView(viewName) {
  document.querySelectorAll(".nav-link").forEach(btn => btn.classList.toggle("active", btn.dataset.view === viewName));
  document.querySelectorAll(".view").forEach(view => view.classList.add("hidden"));
  document.getElementById(`${viewName}View`)?.classList.remove("hidden");
  el.viewTitle.textContent = viewMeta[viewName].title;
  el.viewSubtitle.textContent = viewMeta[viewName].subtitle;
  el.backToDashboardBtn.classList.toggle("hidden", viewName === "dashboard");
}

function populateFilterOptions() {
  const origins = [...new Set(state.surveyResponses.map(r => r.origin_place).filter(Boolean))].sort();
  const purposes = [...new Set(state.surveyResponses.map(r => r.purpose).filter(Boolean))].sort();
  el.filterOrigin.innerHTML = `<option value="">Todos</option>` + origins.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  el.filterPurpose.innerHTML = `<option value="">Todos</option>` + purposes.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  el.filterOrigin.value = state.filters.origin;
  el.filterPurpose.value = state.filters.purpose;
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

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "Sin dato";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function destroyCharts() {
  Object.values(state.charts).forEach(chart => chart.destroy());
  state.charts = {};
}

function buildChart(canvasId, label, counts) {
  const node = document.getElementById(canvasId);
  state.charts[canvasId] = new Chart(node, {
    type: "bar",
    data: { labels: Object.keys(counts), datasets: [{ label, data: Object.values(counts), borderWidth: 1, borderRadius: 8 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#617086" }, grid: { color: "rgba(17,32,51,0.05)" } },
        y: { beginAtZero: true, ticks: { color: "#617086", precision: 0 }, grid: { color: "rgba(17,32,51,0.05)" } },
      },
    },
  });
}

function renderCharts() {
  destroyCharts();
  const rows = getFilteredSurveyResponses();
  buildChart("motivoChart", "Motivos", countBy(rows, "purpose"));
  buildChart("alojamientoChart", "Alojamientos", countBy(rows, "lodging_type"));
  buildChart("canalChart", "Canales", countBy(rows, "capture_channel"));
  buildChart("transporteChart", "Transportes", countBy(rows, "transport_mode"));
}

function renderSurveyTable() {
  const rows = [...getFilteredSurveyResponses()].sort((a, b) => (a.visit_date < b.visit_date ? 1 : -1));
  el.surveyTableBody.innerHTML = rows.map(row => {
    const parsed = parseNotesField(row.notes);
    return `
    <tr>
      <td>${formatDate(row.visit_date)}</td>
      <td>${escapeHtml(row.municipality_name || state.municipality?.name || "—")}</td>
      <td>${escapeHtml(row.province_label || "—")}</td>
      <td>${escapeHtml(row.origin_place)}</td>
      <td>${number(row.group_size)}</td>
      <td>${number(row.nights)}</td>
      <td>${escapeHtml(row.purpose)}</td>
      <td>${escapeHtml(row.lodging_type)}</td>
      <td>${escapeHtml(row.transport_mode || "—")}</td>
      <td>${escapeHtml(row.capture_channel || "—")}</td>
      <td>${escapeHtml(row.activities || "—")}</td>
      <td>${money(row.estimated_spend_ars)}</td>
      <td>${number(row.satisfaction, 0)}/5</td>
      <td>${number(row.recommendation, 0)}/10</td>
      <td>${escapeHtml(parsed.anticipacion || "—")}</td>
      <td>${escapeHtml(parsed.razon_eleccion || "—")}</td>
      <td>${escapeHtml(parsed.canal_reserva || "—")}</td>
      <td>${escapeHtml(parsed.retorno || "—")}</td>
      <td>${escapeHtml(parsed.epoca_retorno || "—")}</td>
      <td>${escapeHtml(parsed.mejoras || "—")}</td>
    </tr>
  `}).join("") || `<tr><td colspan="20">Todavía no hay encuestas cargadas.</td></tr>`;
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

function getTopLabel(counts) {
  const entries = Object.entries(counts);
  if (!entries.length) return "Sin datos";
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

function renderKpisAndInsights() {
  const rows = getFilteredSurveyResponses();
  const surveys = rows.length;
  const visitors = rows.reduce((sum, row) => sum + Number(row.group_size || 0), 0);
  const avgNights = surveys ? rows.reduce((sum, row) => sum + Number(row.nights || 0), 0) / surveys : 0;
  const avgSpend = surveys ? rows.reduce((sum, row) => sum + Number(row.estimated_spend_ars || 0), 0) / surveys : 0;
  const avgSatisfaction = surveys ? rows.reduce((sum, row) => sum + Number(row.satisfaction || 0), 0) / surveys : 0;
  const scores = rows.map(r => Number(r.recommendation || 0));
  const promoters = scores.filter(v => v >= 9).length;
  const detractors = scores.filter(v => v <= 6).length;
  const nps = scores.length ? Math.round(((promoters - detractors) / scores.length) * 100) : 0;
  const activeLodgings = state.lodgingInventory.filter(x => x.is_active);
  const beds = activeLodgings.reduce((sum, row) => sum + Number(row.beds || 0), 0);

  document.getElementById("kpiEncuestas").textContent = number(surveys);
  document.getElementById("kpiVisitantes").textContent = number(visitors);
  document.getElementById("kpiNoches").textContent = number(avgNights, 1);
  document.getElementById("kpiGasto").textContent = money(avgSpend);
  document.getElementById("kpiSatisfaccion").textContent = number(avgSatisfaction, 1);
  document.getElementById("kpiNps").textContent = number(nps);
  document.getElementById("kpiBeds").textContent = number(beds);
  document.getElementById("kpiLodgings").textContent = number(activeLodgings.length);
  el.miniDatasetInfo.textContent = `${number(surveys)} registros`;
  document.getElementById("datasetInfo").textContent = `${number(surveys)} visibles / ${number(state.surveyResponses.length)} totales`;

  const purposes = countBy(rows, "purpose");
  const lodgings = countBy(rows, "lodging_type");
  const channels = countBy(rows, "capture_channel");
  const transports = countBy(rows, "transport_mode");

  const messages = rows.length ? [
    `El motivo de viaje más frecuente es ${getTopLabel(purposes)}.`,
    `El alojamiento dominante es ${getTopLabel(lodgings)}.`,
    `El principal canal de descubrimiento del destino es ${getTopLabel(channels)}.`,
    `El transporte más utilizado es ${getTopLabel(transports)}.`,
    `Se relevaron ${number(visitors)} visitantes estimados en ${number(surveys)} encuestas.`,
    `La estadía promedio es de ${number(avgNights, 1)} noches.`,
    `El gasto promedio estimado por grupo es ${money(avgSpend)}.`,
    `La satisfacción promedio es ${number(avgSatisfaction, 1)} sobre 5, con NPS ${number(nps)}.`,
    ...((() => {
      const extra = [];
      // Anticipación dominante
      const anticipaciones = countBy(rows.filter(r => r.notes && r.notes.includes("Anticipación:")), "notes");
      const anticipRows = rows.filter(r => r.notes && r.notes.includes("Anticipación:"));
      if (anticipRows.length) {
        const freqMap = anticipRows.reduce((acc, r) => {
          const m = r.notes.match(/Anticipación: ([^|]+)/);
          if (m) { const v = m[1].trim(); acc[v] = (acc[v]||0)+1; }
          return acc;
        }, {});
        const top = Object.entries(freqMap).sort((a,b)=>b[1]-a[1])[0];
        if (top) extra.push(`La mayoría planifica el viaje con: ${top[0]}.`);
      }
      // Razón de elección dominante
      const razonRows = rows.filter(r => r.notes && r.notes.includes("Razón de elección:"));
      if (razonRows.length) {
        const freqMap = razonRows.reduce((acc, r) => {
          const m = r.notes.match(/Razón de elección: ([^|]+)/);
          if (m) { const v = m[1].trim(); acc[v] = (acc[v]||0)+1; }
          return acc;
        }, {});
        const top = Object.entries(freqMap).sort((a,b)=>b[1]-a[1])[0];
        if (top) extra.push(`El destino se elige principalmente por: ${top[0]}.`);
      }
      // Intención de retorno
      const retornoRows = rows.filter(r => r.notes && r.notes.includes("Retorno:"));
      if (retornoRows.length) {
        const positivos = retornoRows.filter(r => r.notes.includes("Retorno: Sí")).length;
        const pct = Math.round((positivos / retornoRows.length) * 100);
        extra.push(`El ${pct}% de los encuestados indicó intención de volver.`);
      }
      // Actividad más realizada
      const actRows = rows.filter(r => r.activities);
      if (actRows.length) {
        const freqMap = actRows.reduce((acc, r) => { acc[r.activities] = (acc[r.activities]||0)+1; return acc; }, {});
        const top = Object.entries(freqMap).sort((a,b)=>b[1]-a[1])[0];
        if (top) extra.push(`La actividad principal reportada es: ${top[0]}.`);
      }
      return extra;
    })()),
  ] : ["No hay datos todavía. Sin base, no hay inteligencia; sólo intuición."];

  const listHtml = messages.map(msg => `<li>${escapeHtml(msg)}</li>`).join("");
  el.insightsList.innerHTML = listHtml;
  el.reportsInsightsList.innerHTML = messages.map(msg => `<div class="report-block">${escapeHtml(msg)}</div>`).join("");
  el.reportSummary.innerHTML = `
    <div class="report-block"><strong>Encuestas:</strong> ${number(surveys)} registros bajo filtros activos.</div>
    <div class="report-block"><strong>Visitantes estimados:</strong> ${number(visitors)} personas relevadas.</div>
    <div class="report-block"><strong>Demanda:</strong> estadía promedio ${number(avgNights,1)} noches y gasto medio ${money(avgSpend)}.</div>
    <div class="report-block"><strong>Experiencia:</strong> satisfacción ${number(avgSatisfaction,1)}/5 y NPS ${number(nps)}.</div>
    <div class="report-block"><strong>Oferta:</strong> ${number(activeLodgings.length)} alojamientos activos y ${number(beds)} plazas declaradas.</div>
  `;
}

function renderProfileForm() {
  const municipality = state.municipality || {};
  el.municipalityName.textContent = municipality.name || "—";
  el.profileMunicipalityInput.value = municipality.name || "";
  el.profileProvinceInput.value = municipality.province || "";
  el.profileDepartmentInput.value = municipality.department || "";
  el.profileEmailInput.value = municipality.public_contact_email || "";
  const municipalityInput = document.getElementById("municipio");
  const provinceInput = document.getElementById("provincia");
  if (municipalityInput && !municipalityInput.value && municipality.name) municipalityInput.value = municipality.name;
  if (provinceInput && !provinceInput.value && municipality.province) provinceInput.value = municipality.province;
}

function renderAll() {
  populateFilterOptions();
  renderSurveyTable();
  renderLodgingTable();
  renderCharts();
  renderKpisAndInsights();
  renderProfileForm();
}

async function fetchProfile() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, municipality_id, role")
    .eq("id", state.user.id)
    .single();
  if (error) throw error;
  state.profile = data;

  const { data: municipality, error: municipalityError } = await supabaseClient
    .from("municipalities")
    .select("*")
    .eq("id", data.municipality_id)
    .single();
  if (municipalityError) throw municipalityError;
  state.municipality = municipality;
}

async function fetchSurveyResponses() {
  const { data, error } = await supabaseClient
    .from("survey_responses")
    .select("*")
    .eq("municipality_id", state.profile.municipality_id)
    .order("visit_date", { ascending: false });
  if (error) throw error;
  state.surveyResponses = data || [];
}

async function fetchLodgingInventory() {
  const { data, error } = await supabaseClient
    .from("lodging_inventory")
    .select("*")
    .eq("municipality_id", state.profile.municipality_id)
    .order("name", { ascending: true });
  if (error) throw error;
  state.lodgingInventory = data || [];
}

async function syncAll(showMessage = false) {
  if (!state.user) return;
  try {
    await fetchProfile();
    await Promise.all([fetchSurveyResponses(), fetchLodgingInventory()]);
    renderAll();
    if (showMessage) showToast("Datos sincronizados.");
  } catch (error) {
    console.error(error);
    showToast(`No se pudo sincronizar: ${error.message || "error desconocido"}`);
  }
}

async function fetchSessionAndData() {
  if (!supabaseClient) return;
  const { data: { session } } = await supabaseClient.auth.getSession();
  state.user = session?.user || null;
  if (!state.user) {
    state.profile = null;
    state.municipality = null;
    state.surveyResponses = [];
    state.lodgingInventory = [];
    el.authScreen.classList.remove("hidden");
    el.appContent.classList.add("hidden");
    return;
  }
  el.authScreen.classList.add("hidden");
  el.appContent.classList.remove("hidden");
  await syncAll(false);
}

function normalizeSurveyPayload(payload) {
  const safe = (value) => String(value ?? "").trim();
  const municipalityName = safe(payload.municipio) || safe(state.municipality?.name);
  const provinceLabel = safe(payload.provincia) || safe(state.municipality?.province);

  // Desglose de gasto
  const gastoAlojamiento = Number(payload.gasto_alojamiento || 0);
  const gastoGastronomia = Number(payload.gasto_gastronomia || 0);
  const gastoActividades = Number(payload.gasto_actividades || 0);
  const gastoCompras = Number(payload.gasto_compras || 0);
  const gastoDesglosado = gastoAlojamiento + gastoGastronomia + gastoActividades + gastoCompras;
  const gastoTotal = gastoDesglosado > 0 ? gastoDesglosado : Number(payload.gasto || 0);

  // Construir notas enriquecidas con datos de comportamiento
  const notasComportamiento = [
    payload.anticipacion ? `Anticipación: ${safe(payload.anticipacion)}` : null,
    payload.razon_eleccion ? `Razón de elección: ${safe(payload.razon_eleccion)}` : null,
    payload.canal_reserva ? `Canal de reserva: ${safe(payload.canal_reserva)}` : null,
    payload.retorno ? `Retorno: ${safe(payload.retorno)}` : null,
    payload.epoca_retorno ? `Época preferida: ${safe(payload.epoca_retorno)}` : null,
    gastoDesglosado > 0 ? `Desglose gasto — Aloj: $${gastoAlojamiento} | Gastro: $${gastoGastronomia} | Activ: $${gastoActividades} | Compras: $${gastoCompras}` : null,
    safe(payload.mejora) ? `Mejoras: ${safe(payload.mejora)}` : null,
  ].filter(Boolean).join(" | ");

  return {
    municipality_id: state.profile.municipality_id,
    municipality_name: municipalityName || null,
    province_label: provinceLabel || null,
    visit_date: payload.fecha,
    origin_place: safe(payload.origen),
    group_size: Number(payload.grupo || 0),
    nights: Number(payload.noches || 0),
    lodging_type: safe(payload.alojamiento),
    purpose: safe(payload.motivo),
    transport_mode: safe(payload.transporte) || null,
    capture_channel: safe(payload.canal) || null,
    estimated_spend_ars: gastoTotal,
    satisfaction: Number(payload.satisfaccion || 0),
    recommendation: Number(payload.recomendacion || 0),
    activities: safe(payload.actividades) || null,
    notes: notasComportamiento || null,
  };
}

function validateSurveyPayload(payload) {
  if (!payload.visit_date) return "Indicá la fecha del relevamiento.";
  if (!payload.origin_place) return "Completá el origen del visitante.";
  if (!payload.lodging_type) return "Seleccioná el tipo de alojamiento.";
  if (!payload.purpose) return "Seleccioná el motivo del viaje.";
  if (!payload.capture_channel) return "Seleccioná cómo conoció el destino.";
  if (!payload.transport_mode) return "Seleccioná el medio de transporte.";
  if (!payload.group_size || payload.group_size < 1) return "La cantidad de personas del grupo debe ser al menos 1.";
  if (payload.nights < 0) return "La cantidad de noches no puede ser negativa.";
  if (payload.estimated_spend_ars < 0) return "El gasto no puede ser negativo.";
  if (!payload.satisfaction || payload.satisfaction < 1 || payload.satisfaction > 5) return "Seleccioná una satisfacción válida.";
  if (payload.recommendation < 0 || payload.recommendation > 10) return "La recomendación debe estar entre 0 y 10.";
  return null;
}

async function handleLogin(event) {
  event.preventDefault();
  const btn = document.getElementById("loginSubmitBtn");
  setButtonBusy(btn, true, "Ingresando...", "Ingresar");
  try {
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    showToast("Sesión iniciada.");
  } catch (error) {
    console.error(error);
    showToast(error.message?.includes("fetch") ? "No se pudo conectar con Supabase. Revisá URL, key o red." : (error.message || "No se pudo iniciar sesión."));
  } finally {
    setButtonBusy(btn, false, "Ingresando...", "Ingresar");
  }
}

async function handleSignup(event) {
  event.preventDefault();
  const btn = document.getElementById("signupSubmitBtn");
  setButtonBusy(btn, true, "Creando...", "Crear municipio");
  try {
    const form = new FormData(event.currentTarget);
    const { error, data } = await supabaseClient.auth.signUp({
      email: form.get("email"),
      password: form.get("password"),
      options: { data: { municipality_name: form.get("municipality_name") } }
    });
    if (error) throw error;
    showToast("Cuenta creada. Revisá el email si activaste confirmación.");
    if (data?.user) await fetchSessionAndData();
  } catch (error) {
    console.error(error);
    showToast(error.message?.includes("fetch") ? "No se pudo conectar con Supabase. Revisá URL, key o red." : (error.message || "No se pudo crear la cuenta."));
  } finally {
    setButtonBusy(btn, false, "Creando...", "Crear municipio");
  }
}

async function handleLogout() {
  const btn = document.getElementById("logoutBtn");
  setButtonBusy(btn, true, "Cerrando...", "Cerrar sesión");
  try {
    state.user = null;
    state.profile = null;
    state.municipality = null;
    state.surveyResponses = [];
    state.lodgingInventory = [];
    destroyCharts();
    document.getElementById("sidebar").classList.remove("open");
    setActiveView("dashboard");
    el.appContent.classList.add("hidden");
    el.authScreen.classList.remove("hidden");

    const { error } = await supabaseClient.auth.signOut({ scope: "local" });
    if (error) throw error;

    showToast("Sesión cerrada.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "No se pudo cerrar la sesión.");
  } finally {
    setButtonBusy(btn, false, "Cerrando...", "Cerrar sesión");
  }
}

async function handleSurveySubmit(event) {
  event.preventDefault();
  const formEl = event.currentTarget;
  const btn = document.getElementById("saveSurveyBtn");
  setButtonBusy(btn, true, "Guardando...", "Guardar relevamiento");
  try {
    const form = new FormData(formEl);
    const payload = normalizeSurveyPayload(Object.fromEntries(form.entries()));
    const validationError = validateSurveyPayload(payload);
    if (validationError) throw new Error(validationError);

    const { error } = await supabaseClient.from("survey_responses").insert(payload);
    if (error) throw error;
    formEl.reset();
    const fechaInput = document.getElementById("fecha");
    if (fechaInput) fechaInput.value = new Date().toISOString().slice(0, 10);
    if (!document.getElementById("municipio").value && state.municipality?.name) {
      document.getElementById("municipio").value = state.municipality.name;
    }
    if (!document.getElementById("provincia").value && state.municipality?.province) {
      document.getElementById("provincia").value = state.municipality.province;
    }
    showToast("Relevamiento guardado.");
    await syncAll(false);
  } catch (error) {
    console.error(error);
    showToast(error.message || "No se pudo guardar la encuesta.");
  } finally {
    setButtonBusy(btn, false, "Guardando...", "Guardar relevamiento");
  }
}

async function handleLodgingSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById("saveLodgingBtn");
  setButtonBusy(btn, true, "Guardando...", "Guardar alojamiento");
  try {
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const payload = Object.fromEntries(form.entries());
    payload.municipality_id = state.profile.municipality_id;
    payload.name = String(payload.name || "").trim();
    payload.category = String(payload.category || "").trim();
    payload.address = String(payload.address || "").trim() || null;
    payload.contact_name = String(payload.contact_name || "").trim() || null;
    payload.contact_phone = String(payload.contact_phone || "").trim() || null;
    payload.units = Number(payload.units || 0);
    payload.beds = Number(payload.beds || 0);
    payload.is_active = payload.is_active === "true";

    if (!payload.name) throw new Error("Completá el nombre comercial del alojamiento.");
    if (!payload.category) throw new Error("Seleccioná el tipo de alojamiento.");

    const { error } = await supabaseClient.from("lodging_inventory").insert(payload);
    if (error) throw error;
    formEl.reset();
    showToast("Alojamiento guardado.");
    await syncAll(false);
  } catch (error) {
    console.error(error);
    showToast(error.message || "No se pudo guardar el alojamiento.");
  } finally {
    setButtonBusy(btn, false, "Guardando...", "Guardar alojamiento");
  }
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById("saveProfileBtn");
  setButtonBusy(btn, true, "Guardando...", "Guardar cambios");
  try {
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const { error } = await supabaseClient.from("municipalities").update(payload).eq("id", state.profile.municipality_id);
    if (error) throw error;
    showToast("Configuración actualizada.");
    await syncAll(false);
  } catch (error) {
    console.error(error);
    showToast(error.message || "No se pudieron guardar los cambios.");
  } finally {
    setButtonBusy(btn, false, "Guardando...", "Guardar cambios");
  }
}

async function seedDemoData() {
  if (!state.profile?.municipality_id) return showToast("Primero iniciá sesión.");
  try {
    const municipality_id = state.profile.municipality_id;
    const municipality_name = state.municipality?.name || "Municipio demo";
    const province_label = state.municipality?.province || "Córdoba";
    const surveySeed = [
      { municipality_id, municipality_name, province_label, visit_date: '2026-03-01', origin_place: 'Rosario', group_size: 4, nights: 3, lodging_type: 'Cabaña', purpose: 'Fin de semana', transport_mode: 'Auto', capture_channel: 'Redes sociales', estimated_spend_ars: 240000, satisfaction: 5, recommendation: 10, notes: 'Más cartelería en senderos' },
      { municipality_id, municipality_name, province_label, visit_date: '2026-03-02', origin_place: 'CABA', group_size: 2, nights: 2, lodging_type: 'Hotel', purpose: 'Vacaciones', transport_mode: 'Ómnibus', capture_channel: 'Google / Web', estimated_spend_ars: 180000, satisfaction: 4, recommendation: 9, notes: 'Más eventos nocturnos' },
      { municipality_id, municipality_name, province_label, visit_date: '2026-03-05', origin_place: 'San Juan', group_size: 3, nights: 0, lodging_type: 'Excursión sin pernocte', purpose: 'Evento', transport_mode: 'Auto', capture_channel: 'Recomendación', estimated_spend_ars: 95000, satisfaction: 4, recommendation: 8, notes: 'Mejorar baños públicos' },
      { municipality_id, municipality_name, province_label, visit_date: '2026-03-08', origin_place: 'Mendoza', group_size: 5, nights: 4, lodging_type: 'Alquiler temporario', purpose: 'Vacaciones', transport_mode: 'Auto', capture_channel: 'Ya conocía el lugar', estimated_spend_ars: 420000, satisfaction: 5, recommendation: 10, notes: 'Más actividades para niños' },
      { municipality_id, municipality_name, province_label, visit_date: '2026-03-09', origin_place: 'Chile', group_size: 2, nights: 3, lodging_type: 'Hotel', purpose: 'Gastronomía', transport_mode: 'Avión', capture_channel: 'Redes sociales', estimated_spend_ars: 320000, satisfaction: 3, recommendation: 6, notes: 'Mejor conectividad de internet' },
    ];
    const lodgingSeed = [
      { municipality_id, name: 'Hotel Plaza Centro', category: 'Hotel', units: 24, beds: 58, contact_name: 'Recepción', is_active: true },
      { municipality_id, name: 'Cabañas La Ribera', category: 'Cabaña', units: 10, beds: 36, contact_name: 'Administración', is_active: true },
      { municipality_id, name: 'Camping Municipal', category: 'Camping', units: 40, beds: 80, contact_name: 'Turismo', is_active: true },
    ];
    const { error: surveyError } = await supabaseClient.from("survey_responses").insert(surveySeed);
    if (surveyError) throw surveyError;
    const { error: lodgingError } = await supabaseClient.from("lodging_inventory").insert(lodgingSeed);
    if (lodgingError) throw lodgingError;
    await syncAll(false);
    showToast("Demo cargada.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "No se pudo cargar la demo.");
  }
}

async function clearDemoData() {
  if (!state.profile?.municipality_id) return showToast("Primero iniciá sesión.");
  const ok = window.confirm("Se eliminarán las encuestas y alojamientos demo de este municipio. Esta acción no se puede deshacer.");
  if (!ok) return;
  try {
    const municipalityId = state.profile.municipality_id;
    const { error: surveyError } = await supabaseClient.from("survey_responses").delete().eq("municipality_id", municipalityId);
    if (surveyError) throw surveyError;
    const { error: lodgingError } = await supabaseClient.from("lodging_inventory").delete().eq("municipality_id", municipalityId);
    if (lodgingError) throw lodgingError;
    await syncAll(false);
    showToast("Base demo eliminada.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "No se pudo borrar la demo.");
  }
}

function parseNotesField(notes) {
  // Extrae los campos estructurados guardados en notes como "Clave: Valor | ..."
  const result = {
    anticipacion: "",
    razon_eleccion: "",
    canal_reserva: "",
    retorno: "",
    epoca_retorno: "",
    gasto_alojamiento: "",
    gasto_gastronomia: "",
    gasto_actividades: "",
    gasto_compras: "",
    mejoras: "",
  };
  if (!notes) return result;

  // Anticipación
  const anticipacion = notes.match(/Anticipaci[oó]n:\s*([^|]+)/i);
  if (anticipacion) result.anticipacion = anticipacion[1].trim();

  // Razón de elección
  const razon = notes.match(/Raz[oó]n de elecci[oó]n:\s*([^|]+)/i);
  if (razon) result.razon_eleccion = razon[1].trim();

  // Canal de reserva
  const canalReserva = notes.match(/Canal de reserva:\s*([^|]+)/i);
  if (canalReserva) result.canal_reserva = canalReserva[1].trim();

  // Retorno
  const retorno = notes.match(/Retorno:\s*([^|]+)/i);
  if (retorno) result.retorno = retorno[1].trim();

  // Época preferida
  const epoca = notes.match(/[EÉ]poca preferida:\s*([^|]+)/i);
  if (epoca) result.epoca_retorno = epoca[1].trim();

  // Desglose de gasto — Aloj: $X | Gastro: $Y | Activ: $Z | Compras: $W
  const aloj = notes.match(/Aloj:\s*\$?([\d.]+)/i);
  if (aloj) result.gasto_alojamiento = aloj[1].trim();

  const gastro = notes.match(/Gastro:\s*\$?([\d.]+)/i);
  if (gastro) result.gasto_gastronomia = gastro[1].trim();

  const activ = notes.match(/Activ:\s*\$?([\d.]+)/i);
  if (activ) result.gasto_actividades = activ[1].trim();

  const compras = notes.match(/Compras:\s*\$?([\d.]+)/i);
  if (compras) result.gasto_compras = compras[1].trim();

  // Mejoras
  const mejoras = notes.match(/Mejoras:\s*([^|]+)/i);
  if (mejoras) result.mejoras = mejoras[1].trim();

  return result;
}

function exportSurveyCsv() {
  const rows = getFilteredSurveyResponses();
  const baseHeaders = [
    "visit_date","municipality_name","province_label","origin_place",
    "group_size","nights","lodging_type","purpose","transport_mode",
    "capture_channel","estimated_spend_ars","satisfaction","recommendation","activities"
  ];
  const behaviorHeaders = [
    "anticipacion","razon_eleccion","canal_reserva","retorno","epoca_retorno",
    "gasto_alojamiento","gasto_gastronomia","gasto_actividades","gasto_compras","mejoras"
  ];
  const allHeaders = [...baseHeaders, ...behaviorHeaders];

  const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

  const dataRows = rows.map(row => {
    const parsed = parseNotesField(row.notes);
    const base = baseHeaders.map(h => csvCell(row[h]));
    const behavior = behaviorHeaders.map(h => csvCell(parsed[h]));
    return [...base, ...behavior].join(",");
  });

  const csv = [allHeaders.join(","), ...dataRows].join("\n");
  downloadFile("encuestas_turisticas.csv", csv, "text/csv;charset=utf-8;");
}

function exportSurveyJson() {
  downloadFile("encuestas_turisticas.json", JSON.stringify(getFilteredSurveyResponses(), null, 2), "application/json");
}

function downloadReportJson() {
  const rows = getFilteredSurveyResponses();
  const payload = {
    generated_at: new Date().toISOString(),
    municipality: state.municipality,
    filters: state.filters,
    survey_responses: rows,
    lodging_inventory: state.lodgingInventory,
  };
  downloadFile("reporte_observatorio.json", JSON.stringify(payload, null, 2), "application/json");
}

async function handleForgotPassword(event) {
  event.preventDefault();
  const btn = document.getElementById("forgotPasswordSubmitBtn");
  setButtonBusy(btn, true, "Enviando...", "Enviar enlace de recuperación");
  try {
    const email = String(document.getElementById("recoveryEmailInput").value || "").trim();
    if (!email) throw new Error("Ingresá tu email.");
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) throw error;
    showToast("✓ Revisá tu email. Te enviamos un enlace para restablecer la contraseña.");
    document.getElementById("forgotPasswordPanel").classList.add("hidden");
    document.getElementById("recoveryEmailInput").value = "";
  } catch (error) {
    console.error(error);
    showToast(error.message || "No se pudo enviar el email de recuperación.");
  } finally {
    setButtonBusy(btn, false, "Enviando...", "Enviar enlace de recuperación");
  }
}

async function handleChangePassword(event) {
  event.preventDefault();
  const btn = document.getElementById("changePasswordBtn");
  setButtonBusy(btn, true, "Guardando...", "Cambiar contraseña");
  try {
    const newPassword = String(document.getElementById("newPasswordInput").value || "");
    const confirmPassword = String(document.getElementById("confirmPasswordInput").value || "");
    if (!newPassword || newPassword.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
    if (newPassword !== confirmPassword) throw new Error("Las contraseñas no coinciden.");
    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
    if (error) throw error;
    document.getElementById("changePasswordForm").reset();
    showToast("✓ Contraseña actualizada correctamente.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "No se pudo cambiar la contraseña.");
  } finally {
    setButtonBusy(btn, false, "Guardando...", "Cambiar contraseña");
  }
}

async function downloadDashboardPdf() {
  const btn = document.getElementById("downloadDashboardPdfBtn");
  setButtonBusy(btn, true, "Generando PDF...", "📥 Descargar Dashboard PDF");
  try {
    // Temporarily switch to dashboard view for capture
    const currentActive = document.querySelector(".nav-link.active")?.dataset?.view || "reports";
    setActiveView("dashboard");
    await new Promise(r => setTimeout(r, 400)); // wait for charts to render

    const dashboardEl = document.getElementById("dashboardView");
    const canvas = await html2canvas(dashboardEl, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: "#f4f7fb",
      logging: false,
    });

    const { jsPDF } = window.jspdf;
    const imgData = canvas.toDataURL("image/png");
    const pdfWidth = 210; // A4 mm
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    const pdf = new jsPDF({ orientation: pdfHeight > pdfWidth ? "portrait" : "landscape", unit: "mm", format: "a4" });
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPos = 0;
    const pageCount = Math.ceil(pdfHeight / pageHeight);
    for (let i = 0; i < pageCount; i++) {
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, -i * pageHeight, pdfWidth, pdfHeight);
    }

    const munName = (state.municipality?.name || "observatorio").replace(/\s+/g, "_");
    const fecha = new Date().toISOString().slice(0, 10);
    pdf.save(`dashboard_${munName}_${fecha}.pdf`);

    setActiveView(currentActive);
    showToast("✓ PDF descargado correctamente.");
  } catch (error) {
    console.error(error);
    showToast("No se pudo generar el PDF. Intentá de nuevo.");
  } finally {
    setButtonBusy(btn, false, "Generando PDF...", "📥 Descargar Dashboard PDF");
  }
}


function bindFilters() {
  el.filterStartDate.addEventListener("change", (e) => { state.filters.startDate = e.target.value; renderAll(); });
  el.filterEndDate.addEventListener("change", (e) => { state.filters.endDate = e.target.value; renderAll(); });
  el.filterOrigin.addEventListener("change", (e) => { state.filters.origin = e.target.value; renderAll(); });
  el.filterPurpose.addEventListener("change", (e) => { state.filters.purpose = e.target.value; renderAll(); });
  document.getElementById("clearFiltersBtn").addEventListener("click", () => {
    state.filters = { startDate: "", endDate: "", origin: "", purpose: "" };
    el.filterStartDate.value = ""; el.filterEndDate.value = ""; el.filterOrigin.value = ""; el.filterPurpose.value = "";
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
  document.getElementById("changePasswordForm").addEventListener("submit", handleChangePassword);
  document.getElementById("forgotPasswordForm").addEventListener("submit", handleForgotPassword);
  document.getElementById("forgotPasswordBtn").addEventListener("click", () => {
    document.getElementById("forgotPasswordPanel").classList.toggle("hidden");
  });
  document.getElementById("cancelForgotBtn").addEventListener("click", () => {
    document.getElementById("forgotPasswordPanel").classList.add("hidden");
    document.getElementById("recoveryEmailInput").value = "";
  });
  document.getElementById("seedDemoBtn").addEventListener("click", seedDemoData);
  document.getElementById("clearDemoBtn").addEventListener("click", clearDemoData);
  document.getElementById("syncBtn").addEventListener("click", () => syncAll(true));
  document.getElementById("exportSurveyCsvBtn").addEventListener("click", exportSurveyCsv);
  document.getElementById("exportSurveyJsonBtn").addEventListener("click", exportSurveyJson);
  document.getElementById("downloadReportJsonBtn").addEventListener("click", downloadReportJson);
  document.getElementById("printReportBtn").addEventListener("click", () => window.print());
  document.getElementById("downloadDashboardPdfBtn").addEventListener("click", downloadDashboardPdf);
  el.backToDashboardBtn.addEventListener("click", () => setActiveView("dashboard"));

  document.querySelectorAll(".nav-link").forEach(btn => {
    btn.addEventListener("click", () => {
      setActiveView(btn.dataset.view);
      document.getElementById("sidebar").classList.remove("open");
    });
  });
  document.getElementById("menuBtn").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
  bindFilters();
}

async function startApp() {
  bindUi();
  document.getElementById("fecha").value = new Date().toISOString().slice(0, 10);

  // Auto-suma de gasto desde rubros desglosados
  const gastoRubros = ["gasto_alojamiento", "gasto_gastronomia", "gasto_actividades", "gasto_compras"];
  gastoRubros.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener("input", () => {
        const total = gastoRubros.reduce((sum, rid) => {
          return sum + Number(document.getElementById(rid)?.value || 0);
        }, 0);
        if (total > 0) document.getElementById("gasto").value = total;
      });
    }
  });

  if (!initSupabase()) return;

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user || null;
    // If user arrives via password recovery link, redirect to settings so they can set new password
    if (_event === "PASSWORD_RECOVERY") {
      state.user = session?.user || null;
      el.authScreen.classList.add("hidden");
      el.appContent.classList.remove("hidden");
      window.setTimeout(async () => {
        await syncAll(false);
        setActiveView("settings");
        showToast("Ingresá tu nueva contraseña en la sección Seguridad.");
      }, 0);
      return;
    }
    window.setTimeout(() => {
      fetchSessionAndData();
    }, 0);
  });

  await fetchSessionAndData();
}

startApp();
