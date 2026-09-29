const GEOJSON_URL = "https://raw.githubusercontent.com/g0v/twgeojson/master/json/twTown1982.geo.json";
const REQUIRED_GEOJSON_FIELDS = ["COUNTYNAME", "TOWNNAME"];
const TEMP_COLORS = ["#457c9e", "#72a8b7", "#b3c6a8", "#e8c875", "#eb9858", "#d96554"];
const RAIN_COLORS = ["#e3eee7", "#b4d9d5", "#75babe", "#438da0", "#286375", "#234653"];
const METRICS = {
  t: { label: "平均氣溫", unit: "°C", colors: TEMP_COLORS, breaks: [14, 18, 22, 26, 30] },
  maxt: { label: "最高氣溫", unit: "°C", colors: TEMP_COLORS, breaks: [16, 20, 24, 28, 32] },
  mint: { label: "最低氣溫", unit: "°C", colors: TEMP_COLORS, breaks: [10, 14, 18, 22, 26] },
  pop: { label: "降雨機率", unit: "%", colors: RAIN_COLORS, breaks: [10, 25, 40, 60, 80] },
};

const state = {
  rows: [],
  byLocationDate: new Map(),
  byLocation: new Map(),
  map: null,
  boundaryLayer: null,
  chart: null,
  selected: null,
  selectedDate: "",
  geoFeatures: [],
};

const elements = {
  date: document.querySelector("#forecast-date"),
  metric: document.querySelector("#map-metric"),
  county: document.querySelector("#county-filter"),
  region: document.querySelector("#region-search"),
  regionMobile: document.querySelector("#region-search-mobile"),
  mapLoading: document.querySelector("#map-loading"),
  mapLegend: document.querySelector("#map-legend"),
  selectedPlace: document.querySelector("#selected-place"),
  chartCanvas: document.querySelector("#temperature-chart"),
  chartEmpty: document.querySelector("#empty-chart"),
  table: document.querySelector("#forecast-table"),
  toast: document.querySelector("#toast"),
};

function normalize(value) {
  return String(value || "").normalize("NFKC").replaceAll("臺", "台").trim();
}

function locationKey(county, region) {
  return `${normalize(county)}::${normalize(region)}`;
}

function locationDateKey(county, region, date) {
  return `${locationKey(county, region)}::${date}`;
}

function formatDate(date) {
  if (!date) return "--";
  const parsed = new Date(`${date}T00:00:00+08:00`);
  return new Intl.DateTimeFormat("zh-TW", { month: "2-digit", day: "2-digit", weekday: "short", timeZone: "Asia/Taipei" }).format(parsed);
}

function formatTimestamp(value) {
  if (!value) return "資料更新時間未知";
  return new Intl.DateTimeFormat("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Taipei" }).format(new Date(value));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => elements.toast.classList.remove("visible"), 3600);
}

function metricColor(value, metric) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "#d8e1dc";
  const config = METRICS[metric];
  const step = config.breaks.findIndex((limit) => Number(value) < limit);
  return config.colors[step === -1 ? config.colors.length - 1 : step];
}

function valueLabel(value, metric) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "無資料";
  return `${Math.round(Number(value))}${METRICS[metric].unit}`;
}

function currentLocationRows() {
  if (!state.selected) return [];
  return state.byLocation.get(locationKey(state.selected.countyName, state.selected.regionName)) || [];
}

function rowForFeature(feature, date = state.selectedDate) {
  const properties = feature.properties || {};
  return state.byLocationDate.get(locationDateKey(properties.COUNTYNAME, properties.TOWNNAME, date));
}

function createMap() {
  state.map = L.map("taiwan-map", { zoomControl: true, scrollWheelZoom: true, minZoom: 5, maxZoom: 12 }).setView([23.75, 120.95], 6.7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(state.map);
}

function featureStyle(feature) {
  const row = rowForFeature(feature);
  const metric = elements.metric.value;
  const selected = state.selected && locationKey(feature.properties.COUNTYNAME, feature.properties.TOWNNAME) === locationKey(state.selected.countyName, state.selected.regionName);
  return {
    color: selected ? "#183a35" : "#fbfcfa",
    weight: selected ? 2 : 0.7,
    opacity: 1,
    fillColor: row ? metricColor(row[metric], metric) : "#d8e1dc",
    fillOpacity: row ? 0.82 : 0.42,
  };
}

function featureLabel(feature) {
  const { COUNTYNAME, TOWNNAME } = feature.properties;
  const row = rowForFeature(feature);
  const metric = elements.metric.value;
  const value = row ? valueLabel(row[metric], metric) : "尚無預報";
  return `${COUNTYNAME} ${TOWNNAME}<br>${METRICS[metric].label}：${value}`;
}

function renderLegend() {
  const metric = elements.metric.value;
  const config = METRICS[metric];
  const scale = config.colors.join(", ");
  elements.mapLegend.innerHTML = `<div class="legend-title">${config.label}（${config.unit}）</div><div class="legend-scale" style="background:linear-gradient(90deg,${scale})"></div><div class="legend-labels"><span>${config.breaks[0]}</span><span>${config.breaks[2]}</span><span>${config.breaks.at(-1)}+</span></div>`;
}

function updateMap() {
  if (!state.boundaryLayer) return;
  state.boundaryLayer.setStyle(featureStyle);
  state.boundaryLayer.eachLayer((layer) => {
    const row = rowForFeature(layer.feature);
    layer.setTooltipContent(featureLabel(layer.feature));
    if (row) {
      layer.bindPopup(`${layer.feature.properties.COUNTYNAME} ${layer.feature.properties.TOWNNAME}<br>${METRICS[elements.metric.value].label}：${valueLabel(row[elements.metric.value], elements.metric.value)}`);
    }
  });
  renderLegend();
}

function addBoundaries(geojson) {
  const feature = geojson.features?.find((item) => REQUIRED_GEOJSON_FIELDS.every((key) => item.properties?.[key]));
  if (!feature) throw new Error("GeoJSON 缺少 COUNTYNAME / TOWNNAME 欄位");
  state.geoFeatures = geojson.features;
  state.boundaryLayer = L.geoJSON(geojson, {
    style: featureStyle,
    onEachFeature(item, layer) {
      layer.bindTooltip(featureLabel(item), { sticky: true, direction: "top", className: "town-tooltip" });
      layer.on("click", () => selectLocation(item.properties.COUNTYNAME, item.properties.TOWNNAME, true));
    },
  }).addTo(state.map);
  state.map.fitBounds(state.boundaryLayer.getBounds(), { padding: [12, 12] });
  elements.mapLoading.classList.add("hidden");
}

function setText(selector, value) {
  document.querySelector(selector).textContent = value;
}

function populateControls() {
  const counties = [...new Set(state.rows.map((row) => row.countyName))].sort((a, b) => a.localeCompare(b, "zh-Hant"));
  const towns = [...state.rows.reduce((map, row) => map.set(locationKey(row.countyName, row.regionName), row), new Map()).values()]
    .sort((a, b) => `${a.countyName}${a.regionName}`.localeCompare(`${b.countyName}${b.regionName}`, "zh-Hant"));
  const dates = [...new Set(state.rows.map((row) => row.dataDate))].sort();

  for (const county of counties) {
    const option = new Option(county, county);
    elements.county.add(option);
  }
  for (const town of towns) {
    const value = locationKey(town.countyName, town.regionName);
    const label = `${town.countyName}・${town.regionName}`;
    elements.region.add(new Option(label, value));
    elements.regionMobile.add(new Option(label, value));
  }
  elements.date.min = dates[0] || "";
  elements.date.max = dates.at(-1) || "";
  elements.date.value = dates[0] || "";
  state.selectedDate = elements.date.value;
  setText("#township-count", String(new Set(state.rows.map((row) => row.geocode)).size));
  setText("#county-count", String(counties.length));
}

function selectLocation(county, region, zoom = false) {
  const rows = state.byLocation.get(locationKey(county, region));
  if (!rows?.length) {
    showToast("這個鄉鎮目前沒有可用預報資料");
    return;
  }
  state.selected = { countyName: rows[0].countyName, regionName: rows[0].regionName };
  const key = locationKey(state.selected.countyName, state.selected.regionName);
  elements.region.value = key;
  elements.regionMobile.value = key;
  elements.county.value = state.selected.countyName;
  renderSelectedForecast();
  updateMap();
  if (zoom && state.boundaryLayer) {
    const target = state.geoFeatures.filter((feature) => locationKey(feature.properties.COUNTYNAME, feature.properties.TOWNNAME) === key);
    if (target.length) state.map.fitBounds(L.geoJSON(target).getBounds(), { maxZoom: 10, padding: [20, 20] });
  }
}

function renderSelectedForecast() {
  const rows = currentLocationRows();
  const today = rows.find((row) => row.dataDate === state.selectedDate) || rows[0];
  if (!state.selected || !today) return;

  elements.selectedPlace.innerHTML = "";
  const kicker = document.createElement("span");
  kicker.className = "place-kicker";
  kicker.textContent = "目前選取";
  const title = document.createElement("strong");
  title.textContent = `${state.selected.countyName} ${state.selected.regionName}`;
  const condition = document.createElement("span");
  condition.textContent = `${formatDate(today.dataDate)}・${today.wx || "天氣資料暫缺"}`;
  elements.selectedPlace.append(kicker, title, condition);

  setText("#selected-temp", today.t === null ? "--°" : `${Math.round(today.t)}°`);
  setText("#selected-max", today.maxt === null ? "--°" : `${Math.round(today.maxt)}°`);
  setText("#selected-min", today.mint === null ? "--°" : `${Math.round(today.mint)}°`);
  setText("#selected-pop", today.pop === null ? "--%" : `${Math.round(today.pop)}%`);
  renderChart(rows);
  renderTable(rows);
}

function renderChart(rows) {
  elements.chartEmpty.classList.toggle("hidden", rows.length > 0);
  if (!rows.length) return;
  const chartData = {
    labels: rows.map((row) => formatDate(row.dataDate)),
    datasets: [
      { label: "最高溫", data: rows.map((row) => row.maxt), borderColor: "#dc6b5b", backgroundColor: "rgba(220,107,91,.12)", pointRadius: 2, pointHoverRadius: 4, borderWidth: 2, tension: 0.32, spanGaps: true },
      { label: "最低溫", data: rows.map((row) => row.mint), borderColor: "#548eb1", backgroundColor: "rgba(84,142,177,.1)", pointRadius: 2, pointHoverRadius: 4, borderWidth: 2, tension: 0.32, spanGaps: true },
    ],
  };
  if (state.chart) {
    state.chart.data = chartData;
    state.chart.update();
    return;
  }
  state.chart = new Chart(elements.chartCanvas, {
    type: "line",
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: "#183a35", padding: 10, titleFont: { family: "DM Sans" }, bodyFont: { family: "DM Sans" } } },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: "#7b8b85", maxRotation: 0, autoSkip: false, font: { size: 9 } } },
        y: { grid: { color: "rgba(32,54,50,.08)" }, border: { display: false }, ticks: { color: "#7b8b85", font: { size: 9 }, callback: (value) => `${value}°` } },
      },
    },
  });
}

function renderTable(rows) {
  elements.table.replaceChildren();
  for (const row of rows) {
    const tr = document.createElement("tr");
    const values = [formatDate(row.dataDate), row.wx || "--", row.pop === null ? "--" : `${Math.round(row.pop)}%`, row.mint === null ? "--" : `${Math.round(row.mint)}°`, row.maxt === null ? "--" : `${Math.round(row.maxt)}°`];
    values.forEach((value, index) => {
      const td = document.createElement("td");
      td.textContent = value;
      if (index === 1) td.className = "weather-cell";
      if (index === 3) td.className = "temperature-low";
      if (index === 4) td.className = "temperature-high";
      tr.append(td);
    });
    elements.table.append(tr);
  }
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "table-empty";
    td.textContent = "目前沒有預報資料";
    tr.append(td);
    elements.table.append(tr);
  }
}

async function loadForecasts() {
  const response = await fetch("/api/forecast", { headers: { Accept: "application/json" } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.detail || "無法讀取 CWA 預報資料");
  if (!Array.isArray(payload.rows) || payload.rows.length === 0) throw new Error("資料庫目前沒有可顯示的預報資料");

  state.rows = payload.rows;
  state.byLocationDate.clear();
  state.byLocation.clear();
  for (const row of state.rows) {
    state.byLocationDate.set(locationDateKey(row.countyName, row.regionName, row.dataDate), row);
    const key = locationKey(row.countyName, row.regionName);
    state.byLocation.set(key, [...(state.byLocation.get(key) || []), row]);
  }
  populateControls();
  setText("#updated-at", `資料更新 ${formatTimestamp(payload.updatedAt)}`);
  if (payload.stale) showToast("CWA 暫時無法更新，先顯示資料庫中的最近資料");
}

async function loadMapGeometry() {
  const response = await fetch(GEOJSON_URL);
  if (!response.ok) throw new Error("台灣鄉鎮界線載入失敗");
  addBoundaries(await response.json());
}

function wireControls() {
  elements.date.addEventListener("change", () => {
    state.selectedDate = elements.date.value;
    updateMap();
    renderSelectedForecast();
  });
  elements.metric.addEventListener("change", updateMap);
  elements.county.addEventListener("change", () => {
    const county = elements.county.value;
    const selectedTown = state.selected && state.selected.countyName === county ? state.selected : null;
    if (selectedTown) return;
    state.selected = null;
    elements.region.value = "";
    elements.regionMobile.value = "";
    const features = county ? state.geoFeatures.filter((feature) => normalize(feature.properties.COUNTYNAME) === normalize(county)) : state.geoFeatures;
    if (features.length && state.map) state.map.fitBounds(L.geoJSON(features).getBounds(), { padding: [12, 12], maxZoom: county ? 9 : 7 });
    updateMap();
  });
  const onRegionChange = (event) => {
    if (!event.target.value) return;
    const row = state.rows.find((item) => locationKey(item.countyName, item.regionName) === event.target.value);
    if (row) selectLocation(row.countyName, row.regionName, true);
  };
  elements.region.addEventListener("change", onRegionChange);
  elements.regionMobile.addEventListener("change", onRegionChange);
}

async function start() {
  try {
    await loadForecasts();
    createMap();
    wireControls();
    await loadMapGeometry();
    renderLegend();
    if (window.lucide) window.lucide.createIcons();
  } catch (error) {
    elements.mapLoading.classList.add("hidden");
    showToast(error.message || "載入失敗，請稍後再試");
    setText("#updated-at", "資料暫時無法載入");
  }
}

start();