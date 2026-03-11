/* ═══════════════════════════════════════════════════
   AETHER Weather App — app.js
   Uses Open-Meteo (free, no API key) + Nominatim geocoding
═══════════════════════════════════════════════════ */

// ── State ──────────────────────────────────────────
const state = {
  useCelsius: true,
  rawData: null,
  city: null,
  lat: null,
  lon: null,
};

// ── DOM refs ───────────────────────────────────────
const $ = id => document.getElementById(id);
const searchInput = $('searchInput');
const suggestions  = $('suggestions');
const loader       = $('loader');
const errorMsg     = $('errorMsg');
const weatherContent = $('weatherContent');
const unitToggle   = $('unitToggle');
const timeDisplay  = $('timeDisplay');
const locBtn       = $('locBtn');

// ── Clock ─────────────────────────────────────────
function updateClock() {
  const now = new Date();
  timeDisplay.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// ── Particles ─────────────────────────────────────
const pCanvas = $('particleCanvas');
const pCtx = pCanvas.getContext('2d');
let particles = [];

function resizeParticleCanvas() {
  pCanvas.width  = window.innerWidth;
  pCanvas.height = window.innerHeight;
}
resizeParticleCanvas();
window.addEventListener('resize', resizeParticleCanvas);

class Particle {
  constructor() { this.reset(); }
  reset() {
    this.x = Math.random() * pCanvas.width;
    this.y = Math.random() * pCanvas.height;
    this.size  = Math.random() * 1.5 + 0.3;
    this.speedX = (Math.random() - 0.5) * 0.3;
    this.speedY = Math.random() * 0.15 + 0.05;
    this.alpha  = Math.random() * 0.35 + 0.05;
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    if (this.y > pCanvas.height + 5) this.reset();
  }
  draw() {
    pCtx.beginPath();
    pCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    pCtx.fillStyle = `rgba(201,169,110,${this.alpha})`;
    pCtx.fill();
  }
}

function initParticles(count = 60) {
  particles = Array.from({ length: count }, () => new Particle());
}

function animateParticles() {
  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
  particles.forEach(p => { p.update(); p.draw(); });
  requestAnimationFrame(animateParticles);
}

initParticles();
animateParticles();

// ── Geocoding (Nominatim) ─────────────────────────
let debounceTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  const q = searchInput.value.trim();
  if (q.length < 2) { closeSuggestions(); return; }
  debounceTimer = setTimeout(() => fetchSuggestions(q), 350);
});

async function fetchSuggestions(q) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&featuretype=city`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    renderSuggestions(data);
  } catch { closeSuggestions(); }
}

function renderSuggestions(data) {
  if (!data.length) { closeSuggestions(); return; }
  suggestions.innerHTML = '';
  data.forEach(item => {
    const parts  = item.display_name.split(', ');
    const city   = parts[0];
    const country= parts[parts.length - 1];
    const li = document.createElement('li');
    li.innerHTML = `<span>📍</span><span class="city">${city}</span><span class="country">— ${country}</span>`;
    li.addEventListener('click', () => {
      searchInput.value = city;
      closeSuggestions();
      loadWeather(parseFloat(item.lat), parseFloat(item.lon), city, country);
    });
    suggestions.appendChild(li);
  });
  suggestions.classList.add('open');
}

function closeSuggestions() { suggestions.classList.remove('open'); suggestions.innerHTML = ''; }

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) closeSuggestions();
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const q = searchInput.value.trim();
    if (q) { closeSuggestions(); quickSearch(q); }
  }
});

async function quickSearch(q) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    if (!data.length) { showError('City not found. Try another search.'); return; }
    const item = data[0];
    const parts = item.display_name.split(', ');
    loadWeather(parseFloat(item.lat), parseFloat(item.lon), parts[0], parts[parts.length - 1]);
  } catch { showError('Network error. Please check your connection.'); }
}

// ── Geolocation ────────────────────────────────────
locBtn.addEventListener('click', () => {
  if (!navigator.geolocation) { showError('Geolocation not supported by your browser.'); return; }
  showLoader();
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
      const data = await res.json();
      const city = data.address?.city || data.address?.town || data.address?.village || 'Your Location';
      const country = data.address?.country || '';
      searchInput.value = city;
      loadWeather(lat, lon, city, country);
    } catch { loadWeather(lat, lon, 'Current Location', ''); }
  }, () => { hideLoader(); showError('Could not access your location.'); });
});

// ── Weather Fetch (Open-Meteo) ─────────────────────
async function loadWeather(lat, lon, city, country) {
  showLoader();
  state.lat = lat; state.lon = lon; state.city = city;
  try {
    const params = new URLSearchParams({
      latitude: lat, longitude: lon,
      hourly: 'temperature_2m,weathercode',
      daily: 'weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset',
      current_weather: true,
      wind_speed_unit: 'kmh',
      timezone: 'auto',
      forecast_days: 5,
    });
    // Extra current params
    const extraParams = new URLSearchParams({
      latitude: lat, longitude: lon,
      current: 'relative_humidity_2m,apparent_temperature,surface_pressure,visibility',
      timezone: 'auto',
    });

    const [mainRes, extraRes] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?${params}`),
      fetch(`https://api.open-meteo.com/v1/forecast?${extraParams}`),
    ]);

    const mainData  = await mainRes.json();
    const extraData = await extraRes.json();

    state.rawData = { main: mainData, extra: extraData, city, country, lat, lon };
    renderWeather();
  } catch (e) {
    hideLoader();
    showError('Failed to fetch weather data. Please try again.');
    console.error(e);
  }
}

// ── WMO code → description & icon ─────────────────
function wmoInfo(code) {
  const map = {
    0:  { label: 'Clear Sky',         icon: '☀️',  cls: 'sunny'  },
    1:  { label: 'Mainly Clear',      icon: '🌤',  cls: 'sunny'  },
    2:  { label: 'Partly Cloudy',     icon: '⛅️', cls: 'cloudy' },
    3:  { label: 'Overcast',          icon: '☁️',  cls: 'cloudy' },
    45: { label: 'Foggy',             icon: '🌫',  cls: 'foggy'  },
    48: { label: 'Icy Fog',           icon: '🌫',  cls: 'foggy'  },
    51: { label: 'Light Drizzle',     icon: '🌦',  cls: 'rainy'  },
    53: { label: 'Drizzle',           icon: '🌦',  cls: 'rainy'  },
    55: { label: 'Heavy Drizzle',     icon: '🌧',  cls: 'rainy'  },
    61: { label: 'Light Rain',        icon: '🌧',  cls: 'rainy'  },
    63: { label: 'Moderate Rain',     icon: '🌧',  cls: 'rainy'  },
    65: { label: 'Heavy Rain',        icon: '🌧',  cls: 'rainy'  },
    71: { label: 'Light Snow',        icon: '🌨',  cls: 'snowy'  },
    73: { label: 'Moderate Snow',     icon: '❄️',  cls: 'snowy'  },
    75: { label: 'Heavy Snow',        icon: '❄️',  cls: 'snowy'  },
    77: { label: 'Snow Grains',       icon: '🌨',  cls: 'snowy'  },
    80: { label: 'Light Showers',     icon: '🌦',  cls: 'rainy'  },
    81: { label: 'Showers',           icon: '🌧',  cls: 'rainy'  },
    82: { label: 'Violent Showers',   icon: '⛈',  cls: 'stormy' },
    85: { label: 'Snow Showers',      icon: '🌨',  cls: 'snowy'  },
    86: { label: 'Heavy Snow Showers',icon: '🌨',  cls: 'snowy'  },
    95: { label: 'Thunderstorm',      icon: '⛈',  cls: 'stormy' },
    96: { label: 'Thunderstorm + Hail',icon:'⛈',  cls: 'stormy' },
    99: { label: 'Severe Thunderstorm',icon:'⛈',  cls: 'stormy' },
  };
  return map[code] || { label: 'Unknown', icon: '🌡', cls: 'cloudy' };
}

// ── Temperature conversion ─────────────────────────
function fmt(c) {
  if (state.useCelsius) return `${Math.round(c)}°C`;
  return `${Math.round(c * 9/5 + 32)}°F`;
}

// ── Render ─────────────────────────────────────────
function renderWeather() {
  const { main, extra, city, country } = state.rawData;
  const cw   = main.current_weather;
  const daily = main.daily;
  const ex   = extra.current;

  const info = wmoInfo(cw.weathercode);

  // Theme body
  document.body.className = `weather-${info.cls}`;

  // Location
  $('cityName').textContent    = city;
  const date = new Date();
  $('countryDate').textContent = `${country} · ${date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`;

  // Temp
  $('tempMain').textContent    = fmt(cw.temperature);
  $('feelsLike').textContent   = `Feels like ${fmt(ex.apparent_temperature)}`;
  $('conditionLabel').textContent = info.label;

  // Draw icon on canvas
  drawWeatherIcon(info.cls);

  // Stats
  $('humidity').textContent   = `${ex.relative_humidity_2m}%`;
  $('wind').textContent       = `${Math.round(cw.windspeed)} km/h`;
  $('pressure').textContent   = `${Math.round(ex.surface_pressure)} hPa`;
  $('visibility').textContent = `${Math.round(ex.visibility / 1000)} km`;

  // Sun bar
  const sunriseTs = new Date(daily.sunrise[0]).getTime();
  const sunsetTs  = new Date(daily.sunset[0]).getTime();
  const nowTs     = Date.now();
  const progress  = Math.max(0, Math.min(1, (nowTs - sunriseTs) / (sunsetTs - sunriseTs)));
  const pct       = `${Math.round(progress * 100)}%`;
  $('sunrise').textContent = new Date(daily.sunrise[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  $('sunset').textContent  = new Date(daily.sunset[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  setTimeout(() => {
    $('sunProgress').style.width = pct;
    $('sunDot').style.left = pct;
  }, 300);

  // Forecast
  const forecastRow = $('forecastRow');
  forecastRow.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const d    = new Date(daily.time[i]);
    const fi   = wmoInfo(daily.weathercode[i]);
    const dayName = i === 0 ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short' });
    const card = document.createElement('div');
    card.className = 'forecast-card';
    card.innerHTML = `
      <div class="fc-day">${dayName}</div>
      <div class="fc-icon">${fi.icon}</div>
      <div class="fc-temp-hi">${fmt(daily.temperature_2m_max[i])}</div>
      <div class="fc-temp-lo">${fmt(daily.temperature_2m_min[i])}</div>
      <div class="fc-desc">${fi.label}</div>
    `;
    forecastRow.appendChild(card);
  }

  // Hourly chart
  drawHourlyChart(main.hourly);

  // Show
  weatherContent.style.display = 'block';
  hideLoader();
  clearError();
}

// ── Animated Weather Icon Canvas ──────────────────
function drawWeatherIcon(cls) {
  const canvas = $('weatherIconCanvas');
  const ctx    = canvas.getContext('2d');
  canvas.width = 120; canvas.height = 120;
  let frame = 0;
  if (canvas._animId) cancelAnimationFrame(canvas._animId);

  function draw() {
    ctx.clearRect(0, 0, 120, 120);
    const t = frame / 60;

    if (cls === 'sunny') {
      // Animated sun
      ctx.save();
      ctx.translate(60, 60);
      // Rays
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate((i / 8) * Math.PI * 2 + t);
        const len = 18 + Math.sin(t * 2 + i) * 3;
        ctx.strokeStyle = `rgba(255, 200, 80, ${0.4 + Math.sin(t + i) * 0.2})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 22); ctx.lineTo(0, 22 + len);
        ctx.stroke();
        ctx.restore();
      }
      // Sun body
      const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, 22);
      grad.addColorStop(0, '#fff8c0');
      grad.addColorStop(1, '#ffa500');
      ctx.beginPath();
      ctx.arc(0, 0, 20 + Math.sin(t * 1.5) * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    } else if (cls === 'rainy') {
      // Cloud + rain drops
      drawCloud(ctx, 60, 38);
      for (let i = 0; i < 5; i++) {
        const x = 30 + i * 14;
        const y = 70 + ((t * 40 + i * 15) % 40);
        const alpha = 1 - ((t * 40 + i * 15) % 40) / 40;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 10);
        ctx.strokeStyle = `rgba(100, 160, 255, ${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    } else if (cls === 'snowy') {
      drawCloud(ctx, 60, 38);
      for (let i = 0; i < 5; i++) {
        const x = 28 + i * 14;
        const y = 70 + ((t * 20 + i * 12) % 35);
        const a = 1 - ((t * 20 + i * 12) % 35) / 35;
        ctx.font = `12px serif`;
        ctx.globalAlpha = a;
        ctx.fillText('❄', x - 6, y);
        ctx.globalAlpha = 1;
      }
    } else if (cls === 'stormy') {
      drawCloud(ctx, 60, 38, true);
      // Lightning
      const lt = Math.floor(t * 2) % 4;
      if (lt === 0) {
        ctx.beginPath();
        ctx.moveTo(62, 62); ctx.lineTo(52, 80); ctx.lineTo(60, 80); ctx.lineTo(50, 100);
        ctx.strokeStyle = '#ffee44';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ffee44';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    } else if (cls === 'cloudy') {
      ctx.save();
      ctx.translate(Math.sin(t * 0.5) * 3, Math.cos(t * 0.3) * 2);
      drawCloud(ctx, 60, 60);
      ctx.restore();
    } else if (cls === 'foggy') {
      for (let i = 0; i < 4; i++) {
        const x = 15 + ((t * 10 + i * 20) % 100);
        const y = 40 + i * 14;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + 40, y);
        ctx.strokeStyle = `rgba(180,190,200,0.4)`;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    } else {
      // default: sun
      drawCloud(ctx, 60, 55);
      ctx.save();
      ctx.translate(30, 42);
      const sg = ctx.createRadialGradient(0,0,3,0,0,16);
      sg.addColorStop(0,'#fff8c0'); sg.addColorStop(1,'#ffa500');
      ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2);
      ctx.fillStyle = sg; ctx.fill();
      ctx.restore();
    }
    frame++;
    canvas._animId = requestAnimationFrame(draw);
  }
  draw();
}

function drawCloud(ctx, cx, cy, dark = false) {
  ctx.save();
  const grad = ctx.createLinearGradient(cx - 35, cy - 20, cx + 35, cy + 20);
  if (dark) { grad.addColorStop(0, '#555'); grad.addColorStop(1, '#333'); }
  else       { grad.addColorStop(0, '#e8eef5'); grad.addColorStop(1, '#c8d5e0'); }
  ctx.fillStyle = grad;
  ctx.shadowColor = dark ? 'rgba(0,0,0,0.4)' : 'rgba(100,130,170,0.3)';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(cx - 16, cy, 18, 0, Math.PI * 2);
  ctx.arc(cx + 8,  cy - 8, 22, 0, Math.PI * 2);
  ctx.arc(cx + 24, cy + 2, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── Hourly Chart (pure Canvas) ─────────────────────
function drawHourlyChart(hourly) {
  const canvas = $('tempChart');
  canvas.width = canvas.offsetWidth * window.devicePixelRatio || 700;
  canvas.height = 120 * window.devicePixelRatio;
  canvas.style.height = '120px';
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  ctx.scale(dpr, dpr);
  const W = canvas.width / dpr;
  const H = canvas.height / dpr;

  // Take next 24h
  const now    = new Date();
  const temps  = [];
  const labels = [];
  for (let i = 0; i < hourly.time.length && temps.length < 24; i++) {
    const t = new Date(hourly.time[i]);
    if (t >= now) {
      temps.push(hourly.temperature_2m[i]);
      labels.push(t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }

  if (temps.length < 2) return;

  const min = Math.min(...temps) - 2;
  const max = Math.max(...temps) + 2;
  const padX = 40, padY = 20;
  const chartW = W - padX * 2;
  const chartH = H - padY * 2;

  const toX = i => padX + (i / (temps.length - 1)) * chartW;
  const toY = v => padY + chartH - ((v - min) / (max - min)) * chartH;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const y = padY + (g / 4) * chartH;
    ctx.beginPath(); ctx.moveTo(padX, y); ctx.lineTo(W - padX, y); ctx.stroke();
  }

  // Gradient fill
  const fillGrad = ctx.createLinearGradient(0, padY, 0, H - padY);
  fillGrad.addColorStop(0, 'rgba(201,169,110,0.3)');
  fillGrad.addColorStop(1, 'rgba(201,169,110,0)');

  ctx.beginPath();
  ctx.moveTo(toX(0), toY(temps[0]));
  for (let i = 1; i < temps.length; i++) {
    const x0 = toX(i - 1), y0 = toY(temps[i - 1]);
    const x1 = toX(i),     y1 = toY(temps[i]);
    const cp1x = x0 + (x1 - x0) / 3, cp2x = x0 + (x1 - x0) * 2 / 3;
    ctx.bezierCurveTo(cp1x, y0, cp2x, y1, x1, y1);
  }
  ctx.lineTo(toX(temps.length - 1), H - padY);
  ctx.lineTo(toX(0), H - padY);
  ctx.closePath();
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // Line
  const lineGrad = ctx.createLinearGradient(padX, 0, W - padX, 0);
  lineGrad.addColorStop(0, '#c9a96e');
  lineGrad.addColorStop(0.5, '#ffca80');
  lineGrad.addColorStop(1, '#c9a96e');

  ctx.beginPath();
  ctx.moveTo(toX(0), toY(temps[0]));
  for (let i = 1; i < temps.length; i++) {
    const x0 = toX(i - 1), y0 = toY(temps[i - 1]);
    const x1 = toX(i),     y1 = toY(temps[i]);
    const cp1x = x0 + (x1 - x0) / 3, cp2x = x0 + (x1 - x0) * 2 / 3;
    ctx.bezierCurveTo(cp1x, y0, cp2x, y1, x1, y1);
  }
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth   = 2.5;
  ctx.stroke();

  // Dots + labels (every 4h)
  ctx.font = `10px 'DM Mono', monospace`;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.textAlign = 'center';
  for (let i = 0; i < temps.length; i += 4) {
    const x = toX(i), y = toY(temps[i]);
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#c9a96e';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(labels[i], x, H - 4);
    ctx.fillStyle = 'rgba(232,228,220,0.8)';
    ctx.fillText(
      state.useCelsius ? `${Math.round(temps[i])}°` : `${Math.round(temps[i]*9/5+32)}°`,
      x, y - 8
    );
  }
}

// ── Unit toggle ────────────────────────────────────
unitToggle.addEventListener('click', () => {
  state.useCelsius = !state.useCelsius;
  unitToggle.classList.toggle('active', !state.useCelsius);
  if (state.rawData) renderWeather();
});

// ── UI helpers ─────────────────────────────────────
function showLoader()  { loader.classList.add('visible'); weatherContent.style.display = 'none'; clearError(); }
function hideLoader()  { loader.classList.remove('visible'); }
function showError(msg){ errorMsg.textContent = msg; errorMsg.classList.add('visible'); }
function clearError()  { errorMsg.classList.remove('visible'); }

// ── Init: default city ─────────────────────────────
window.addEventListener('load', () => {
  loadWeather(48.8566, 2.3522, 'Paris', 'France');
  searchInput.value = 'Paris';
});
