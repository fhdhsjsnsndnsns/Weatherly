# 🌤 AETHER — Weather App

A beautifully crafted, interactive weather app with real-time data, animated icons, and dynamic visual themes. No API key required.

![AETHER Weather App](https://img.shields.io/badge/status-live-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ Features

- 🔍 **City search** with autocomplete suggestions (Nominatim / OpenStreetMap)
- 📍 **Geolocation** — detect your current location instantly
- 🌡 **°C / °F toggle** — switch units on the fly
- 🌤 **Animated weather icons** — canvas-drawn, condition-aware animations (sun rays, rain drops, snow, lightning…)
- 📅 **5-day forecast** with high/low temps and condition labels
- ⏱ **24-hour temperature chart** — smooth bezier curve with gradient fill
- 🌅 **Sunrise / Sunset progress bar** — live solar arc indicator
- 💧 Humidity, wind speed, pressure, visibility stats
- 🎨 **Dynamic background themes** — background color shifts based on weather condition (sunny, rainy, stormy, snowy…)
- ✨ **Floating particle animation** on the canvas
- 🕐 **Live clock** updated every second
- 📱 **Responsive** — works on mobile & desktop

---

## 🚀 Getting Started

No build step required. Just open `index.html` in your browser:

```bash
git clone https://github.com/YOUR_USERNAME/aether-weather.git
cd aether-weather
open index.html
```

Or serve it locally:

```bash
# Python
python3 -m http.server 8000

# Node (npx)
npx serve .
```

Then go to `http://localhost:8000`.

---

## 🌐 APIs Used

| API | Purpose | Key Required |
|-----|---------|:---:|
| [Open-Meteo](https://open-meteo.com/) | Weather data (current, hourly, daily) | ❌ Free |
| [Nominatim (OpenStreetMap)](https://nominatim.org/) | Geocoding & reverse geocoding | ❌ Free |

---

## 📁 Project Structure

```
aether-weather/
├── index.html    — Main HTML shell
├── style.css     — Styles, animations, theme variables
├── app.js        — All logic: fetch, render, canvas, charts
└── README.md
```

---

## 🎨 Design Highlights

- **Typography**: Cormorant Garamond (editorial serif) + DM Mono (code/data)
- **Color palette**: Deep navy/indigo background with golden amber accents
- **Animations**: Pure CSS orb animations, canvas particle system, animated weather icons
- **Themes**: 6 dynamic color modes that shift the ambient background based on weather condition

---

## 📄 License

MIT — free to use and modify.
