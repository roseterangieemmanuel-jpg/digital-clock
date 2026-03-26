let currentTimeZone = 'local';
let alarms = JSON.parse(localStorage.getItem("alarms")) || [];
let editingAlarmIndex = null;
let currentRingingAlarm = null;

/* ---------- SECTION NAVIGATION ---------- */
function showSection(sectionId, event) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.menu button').forEach(b => b.classList.remove('active'));
  document.getElementById(sectionId).classList.add('active');
  if (event && event.target) event.target.classList.add('active');
  if (sectionId === 'weather') autoDetectWeather();
  if (sectionId === 'map') {
    setTimeout(() => {
      if (!map) initMap();
      map.invalidateSize();
      autoDetectMapLocation();
    }, 100);
  }
}

/* ---------- ANALOG CLOCK ---------- */
function updateAnalogClock() {
  const now = new Date();
  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  const hourDeg = (hours * 30) + (minutes * 0.5);
  const minuteDeg = minutes * 6;
  const secondDeg = seconds * 6;

  document.getElementById('hourHand').style.transform = `rotate(${hourDeg}deg)`;
  document.getElementById('minuteHand').style.transform = `rotate(${minuteDeg}deg)`;
  document.getElementById('secondHand').style.transform = `rotate(${secondDeg}deg)`;
}

function setClockNumbers() {
  const numbersElem = document.getElementById('clockNumbers');
  numbersElem.innerHTML = '';
  const radius = 135;
  const center = 150;
  for (let i = 1; i <= 12; i++) {
    const angle = (i * 30 - 90) * (Math.PI / 180);
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    const num = document.createElement('div');
    num.textContent = i;
    num.style.position = 'absolute';
    num.style.left = `${x}px`;
    num.style.top = `${y}px`;
    num.style.transform = 'translate(-50%, -50%)';
    numbersElem.appendChild(num);
  }
}

/* ---------- DIGITAL CLOCK ---------- */
function updateClockDisplay() {
  const now = new Date();
  const options = currentTimeZone === 'local' ? {} : { timeZone: currentTimeZone };
  const time = now.toLocaleTimeString([], options);
  const date = now.toLocaleDateString([], options);

  document.getElementById('clock').innerText = time;
  document.getElementById('dateDisplay').innerText = date;
}

function updateTimeZone() {
  currentTimeZone = document.getElementById('timeZoneSelect').value;
  updateClockDisplay();
}

/* ---------- ALARM ---------- */
function renderAlarms() {
  const list = document.getElementById("alarmList");
  list.innerHTML = "";
  alarms.forEach((alarm, i) => {
    const li = document.createElement("li");
    li.innerHTML = `${alarm.label || "Alarm"} - ${convertTo12Hour(alarm.time)} ` +
      `<button onclick="editAlarm(${i})">Edit</button> ` +
      `<button onclick="removeAlarm(${i})">Delete</button>`;
    list.appendChild(li);
  });
}

function convertTo12Hour(time24) {
  const [hours, minutes] = time24.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${minutes} ${ampm}`;
}

function showAlarmForm() {
  document.getElementById("alarmForm").style.display = 'block';
  document.getElementById("showAlarmFormButton").style.display = 'none';
}

function hideAlarmForm() {
  document.getElementById("alarmForm").style.display = 'none';
  document.getElementById("showAlarmFormButton").style.display = 'inline-block';
  clearAlarmForm();
}

function clearAlarmForm() {
  document.getElementById("alarmInput").value = "";
  document.getElementById("alarmLabel").value = "";
  document.getElementById("alarmSoundChoice").value = "https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3";
  document.getElementById("alarmRepeat").checked = false;
  document.getElementById("weekdayBoxes").style.display = 'none';
  document.getElementById("alarmSnooze").value = 5;
  editingAlarmIndex = null;
  document.getElementById("alarmSaveBtn").innerText = 'Add Alarm';
  document.getElementById("alarmCancelBtn").style.display = 'none';
}

function saveAlarm() {
  const time = document.getElementById("alarmInput").value;
  if (!time) return alert("Set a time for the alarm.");
  const newAlarm = {
    time,
    label: document.getElementById("alarmLabel").value.trim() || "Alarm",
    sound: document.getElementById("alarmSoundChoice").value,
    repeat: document.getElementById("alarmRepeat").checked,
    weekdays: [],
    snooze: Number(document.getElementById("alarmSnooze").value) || 5,
    enabled: true,
    lastTriggered: null,
    snoozeUntil: null
  };
  if (editingAlarmIndex !== null) alarms[editingAlarmIndex] = newAlarm;
  else alarms.push(newAlarm);

  localStorage.setItem("alarms", JSON.stringify(alarms));
  renderAlarms();
  hideAlarmForm();
}

function editAlarm(i) {
  const alarm = alarms[i];
  editingAlarmIndex = i;
  document.getElementById("alarmInput").value = alarm.time;
  document.getElementById("alarmLabel").value = alarm.label;
  document.getElementById("alarmSoundChoice").value = alarm.sound;
  document.getElementById("alarmRepeat").checked = alarm.repeat;
  document.getElementById("alarmSnooze").value = alarm.snooze;
  document.getElementById("alarmSaveBtn").innerText = 'Update Alarm';
  document.getElementById("alarmCancelBtn").style.display = 'inline-block';
  document.getElementById("alarmForm").style.display = 'block';
  document.getElementById("showAlarmFormButton").style.display = 'none';
}

function removeAlarm(i) {
  alarms.splice(i, 1);
  localStorage.setItem("alarms", JSON.stringify(alarms));
  renderAlarms();
}

function showFullScreenAlarm(alarm) {
  const overlay = document.getElementById("alarmOverlay");
  document.getElementById('alarmOverlayMessage').innerText = `${alarm.label} is ringing!`;
  overlay.style.display = 'flex';
  currentRingingAlarm = alarm;
}

function hideAlarmNotification(){
  document.getElementById("alarmOverlay").style.display = 'none';
}

function stopAlarm() {
  const soundEl = document.getElementById("alarmSound");
  soundEl.pause();
  soundEl.currentTime = 0;
  soundEl.loop = false;
  hideAlarmNotification();
}

function snoozeCurrentAlarm() {
  if (!currentRingingAlarm) return;
  const minutes = Number(document.getElementById('alarmSnooze').value) || 5;
  currentRingingAlarm.snoozeUntil = Date.now() + minutes * 60000;
  localStorage.setItem("alarms", JSON.stringify(alarms));
  stopAlarm();
}

/* ---------- TIMER ---------- */
let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;

function startTimer() {
  const hours = parseInt(document.getElementById('timerHours').value) || 0;
  const minutes = parseInt(document.getElementById('timerMin').value) || 0;
  const seconds = parseInt(document.getElementById('timerSec').value) || 0;

  if (hours === 0 && minutes === 0 && seconds === 0) {
    alert('Please set a time');
    return;
  }

  if (!timerRunning) {
    timerSeconds = hours * 3600 + minutes * 60 + seconds;
    timerRunning = true;
    timerInterval = setInterval(decrementTimer, 1000);
  }
}

function decrementTimer() {
  if (timerSeconds > 0) {
    timerSeconds--;
    updateTimerDisplay();
  } else {
    stopTimer();
    alert('Timer finished!');
  }
}

function updateTimerDisplay() {
  const hours = Math.floor(timerSeconds / 3600);
  const minutes = Math.floor((timerSeconds % 3600) / 60);
  const seconds = timerSeconds % 60;
  document.getElementById('timerDisplay').textContent =
    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function stopTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
}

function restartTimer() {
  stopTimer();
  timerSeconds = 0;
  document.getElementById('timerHours').value = '';
  document.getElementById('timerMin').value = '';
  document.getElementById('timerSec').value = '';
  updateTimerDisplay();
}

/* ---------- STOPWATCH ---------- */
let swInterval = null;
let swMilliseconds = 0;
let swRunning = false;

function startSW() {
  if (!swRunning) {
    swRunning = true;
    swInterval = setInterval(incrementSW, 10);
  }
}

function incrementSW() {
  swMilliseconds += 10;
  updateSWDisplay();
}

function updateSWDisplay() {
  const totalSeconds = Math.floor(swMilliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ms = Math.floor((swMilliseconds % 1000) / 10);

  document.getElementById('swDisplay').textContent =
    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

function stopSW() {
  swRunning = false;
  clearInterval(swInterval);
}

function resetSW() {
  stopSW();
  swMilliseconds = 0;
  document.getElementById('lapList').innerHTML = '';
  updateSWDisplay();
}

function lapSW() {
  if (!swRunning) return;
  const totalSeconds = Math.floor(swMilliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ms = Math.floor((swMilliseconds % 1000) / 10);
  const lapTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;

  const lapList = document.getElementById('lapList');
  const li = document.createElement('li');
  li.textContent = `Lap ${lapList.children.length + 1}: ${lapTime}`;
  lapList.appendChild(li);
}

/* ---------- CLOCK UPDATES ---------- */
setClockNumbers();
updateClockDisplay();
updateAnalogClock();
hideAlarmNotification();
setInterval(updateAnalogClock, 1000);
setInterval(updateClockDisplay, 1000);

// Cleanup stray text nodes under body (fixes random text appearing under page)
document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const strayNodes = Array.from(body.childNodes).filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  strayNodes.forEach(node => node.remove());
});

renderAlarms();

/* ---------- CHECK ALARMS ---------- */
setInterval(() => {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0,5);
  alarms.forEach(alarm => {
    let shouldRing = false;
    if (alarm.snoozeUntil && Date.now() >= alarm.snoozeUntil) {
      shouldRing = true;
      alarm.snoozeUntil = null;
    } else if (alarm.time === currentTime) {
      shouldRing = true;
    }
    if (shouldRing && alarm.lastTriggered !== currentTime) {
      alarm.lastTriggered = currentTime;
      localStorage.setItem("alarms", JSON.stringify(alarms));
      const soundEl = document.getElementById("alarmSound");
      soundEl.src = alarm.sound;
      soundEl.loop = true;
      soundEl.play().catch(()=>{});
      showFullScreenAlarm(alarm);
    }
  });
}, 1000);

/* ---------- WEATHER (Open-Meteo API - Free, No API Key) ---------- */
function autoDetectWeather() {
  document.getElementById('weatherResult').innerHTML = '<p style="color:#38bdf8;">Detecting your location...</p>';
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchWeatherByCoords(position.coords.latitude, position.coords.longitude);
      },
      () => {
        fetchWeatherByCoords(40.7128, -74.0060);
      }
    );
  } else {
    fetchWeatherByCoords(40.7128, -74.0060);
  }
}

async function fetchWeatherByCoords(lat, lon) {
  try {
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
    const geoData = await geoRes.json();
    const name = geoData.address?.city || geoData.address?.town || geoData.address?.village || geoData.address?.county || 'Your Location';
    const country = geoData.address?.country || '';

    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&hourly=temperature_2m,weather_code&forecast_days=4`);
    const weatherData = await weatherRes.json();

    const current = weatherData.current;
    const weatherDescriptions = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Foggy', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
      55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
      71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 80: 'Slight rain showers',
      81: 'Moderate rain showers', 82: 'Violent rain showers', 95: 'Thunderstorm'
    };

    const desc = weatherDescriptions[current.weather_code] || 'Unknown';

    let hourlyForecast = '';
    const hourly = weatherData.hourly;
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    
    for (let i = 0; i < 72 && i < hourly.time.length; i++) {
      const hourTime = new Date(hourly.time[i]);
      if (hourTime < now) continue;
      
      const hourLabel = hourTime.toLocaleTimeString([], { hour: 'numeric' });
      const dayLabel = hourTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      
      hourlyForecast += `
        <div class="forecast-item">
          <div class="forecast-time">${hourLabel}</div>
          <div class="forecast-day">${dayLabel}</div>
          <div class="forecast-icon">${getWeatherEmoji(hourly.weather_code[i])}</div>
          <div class="forecast-temp">${Math.round(hourly.temperature_2m[i])}°</div>
        </div>
      `;
    }

    document.getElementById('weatherResult').innerHTML = `
      <div class="weather-card">
        <h3>${name}, ${country}</h3>
        <div class="weather-icon">${getWeatherEmoji(current.weather_code)}</div>
        <div class="weather-temp">${Math.round(current.temperature_2m)}°F</div>
        <p class="weather-desc">${desc}</p>
        <div class="weather-details">
          <span>Humidity: ${current.relative_humidity_2m}%</span>
          <span>Wind: ${Math.round(current.wind_speed_10m)} mph</span>
        </div>
      </div>
      <h3 style="margin: 25px 0 15px 0;">72-Hour Forecast</h3>
      <div class="forecast-container">
        ${hourlyForecast}
      </div>
    `;
  } catch (error) {
    document.getElementById('weatherResult').innerHTML = '<p style="color:#ef4444;">Error fetching weather data</p>';
  }
}

autoDetectWeather();

function getWeatherEmoji(code) {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌧️';
  if (code <= 65) return '🌧️';
  if (code <= 75) return '❄️';
  if (code <= 82) return '🌦️';
  return '⛈️';
}

autoDetectWeather();

/* ---------- MAP (Leaflet.js - Free, No API Key) ---------- */
let mapLat = 40.7128;
let mapLon = -74.0060;
let mapName = 'New York, USA';
let isSatellite = false;
let map;

const osmLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors, © CARTO' });
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri' });

function initMap() {
  map = L.map('mapDiv', { center: [mapLat, mapLon], zoom: 13, layers: [osmLayer] });
  updateMarker();
}

function updateMarker() {
  map.eachLayer(layer => { if (layer instanceof L.Marker) map.removeLayer(layer); });
  L.marker([mapLat, mapLon]).addTo(map);
  document.getElementById('mapError').innerHTML = `<p style="color:#94a3b8;font-size:0.85rem;">${mapName}</p>`;
}

function autoDetectMapLocation() {
  document.getElementById('mapError').innerHTML = '<p style="color:#38bdf8;">Detecting your location...</p>';
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        mapLat = position.coords.latitude;
        mapLon = position.coords.longitude;
        mapName = 'Your Location';
        if (map) { map.setView([mapLat, mapLon], 15); updateMarker(); }
      },
      () => {
        mapLat = 40.7128; mapLon = -74.0060; mapName = 'New York, USA';
        if (map) { map.setView([mapLat, mapLon], 13); updateMarker(); }
      }
    );
  } else {
    mapLat = 40.7128; mapLon = -74.0060; mapName = 'New York, USA';
    if (map) { map.setView([mapLat, mapLon], 13); updateMarker(); }
  }
}

function myMapLocation() { autoDetectMapLocation(); }

function toggleSatellite() {
  isSatellite = !isSatellite;
  const btn = document.getElementById('satelliteBtn');
  btn.classList.toggle('active', isSatellite);
  btn.textContent = isSatellite ? 'Map View' : 'Satellite';
  if (map) {
    map.removeLayer(isSatellite ? osmLayer : satelliteLayer);
    map.addLayer(isSatellite ? satelliteLayer : osmLayer);
  }
}

async function searchLocation() {
  const location = document.getElementById('locationInput').value.trim();
  if (!location) { autoDetectMapLocation(); return; }
  document.getElementById('mapError').innerHTML = '<p style="color:#38bdf8;">Searching...</p>';
  try {
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`);
    const geoData = await geoRes.json();
    if (!geoData || geoData.length === 0) { document.getElementById('mapError').innerHTML = '<p style="color:#ef4444;">Location not found</p>'; return; }
    mapLat = parseFloat(geoData[0].lat);
    mapLon = parseFloat(geoData[0].lon);
    mapName = geoData[0].display_name;
    if (map) { map.setView([mapLat, mapLon], 15); updateMarker(); }
    document.getElementById('locationInput').value = '';
  } catch (error) { document.getElementById('mapError').innerHTML = '<p style="color:#ef4444;">Error searching location</p>'; }
}

document.getElementById('locationInput').addEventListener('keypress', function(e) { if (e.key === 'Enter') searchLocation(); });

window.addEventListener('load', () => { if (document.getElementById('mapDiv')._leaflet_id) return; initMap(); });
