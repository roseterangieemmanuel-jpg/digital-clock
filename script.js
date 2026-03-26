let currentTimeZone = 'local';
let alarms = JSON.parse(localStorage.getItem("alarms")) || [];
let editingAlarmIndex = null;
let currentRingingAlarm = null;
let currentNotificationType = null;

function getClientLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject('Geolocation not supported');
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                reject(error.message);
            },
            { enableHighAccuracy: true, timeout: 60000, maximumAge: 0 }
        );
    });
}

async function autoDetectLocation() {
    document.getElementById('weatherLoading').style.display = 'block';
    document.getElementById('weatherLoading').textContent = 'Getting your location...';
    document.getElementById('weatherError').style.display = 'none';
    document.getElementById('weatherCurrent').style.display = 'none';
    document.getElementById('weatherForecast').style.display = 'none';
    document.getElementById('forecastTitle').style.display = 'none';
    document.getElementById('weatherLocation').textContent = 'Detecting...';
    
    try {
        const clientLoc = await getClientLocation();
        console.log('Client location:', clientLoc.lat, clientLoc.lon, 'Accuracy:', clientLoc.accuracy, 'meters');
        
        document.getElementById('weatherLoading').textContent = 'Fetching weather data...';
        
        const locationName = await reverseGeocode(clientLoc.lat, clientLoc.lon);
        console.log('Location name:', locationName);
        fetchWeather(clientLoc.lat, clientLoc.lon, locationName);
    } catch (error) {
        console.log('GPS error, trying IP location:', error);
        fetchIPLocation();
    }
}

function reverseGeocode(lat, lon) {
    return fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`)
        .then(res => res.json())
        .then(data => {
            console.log('BigDataCloud response:', data);
            
            const parts = [];
            
            if (data.locality) parts.push(data.locality);
            if (data.city) parts.push(data.city);
            if (data.principalSubdivision) parts.push(data.principalSubdivision);
            if (data.countryName) parts.push(data.countryName);
            
            if (parts.length >= 2) {
                return parts.join(', ');
            }
            
            const fallbackParts = [];
            if (data.principalSubdivision) fallbackParts.push(data.principalSubdivision);
            if (data.countryName) fallbackParts.push(data.countryName);
            
            if (fallbackParts.length > 0) {
                return fallbackParts.join(', ');
            }
            if (data.countryName) {
                return data.countryName;
            }
            
            return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        })
        .catch(err => {
            console.error('Reverse geocode error:', err);
            return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        });
}

function fetchIPLocation() {
    fetch('http://ip-api.com/json/?fields=status,lat,lon,city,region,country,countryCode')
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success' && data.lat && data.lon) {
                const locationName = (data.city || data.region || data.country) + (data.countryCode ? ', ' + data.countryCode : '');
                fetchWeather(data.lat, data.lon, locationName);
            } else {
                throw new Error('IP location failed');
            }
        })
        .catch(() => {
            document.getElementById('weatherLoading').style.display = 'none';
            showWeatherError('Unable to get your location.');
        });
}

/* ---------- SECTION NAVIGATION ---------- */
function showSection(sectionId, event) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.menu button').forEach(b => b.classList.remove('active'));
  document.getElementById(sectionId).classList.add('active');
  if (event && event.target) event.target.classList.add('active');
  
  if (sectionId === 'weather' && !weatherLoaded) {
    autoDetectLocation();
  }
  if (sectionId === 'map' && !mapLoaded) {
    getMapLocation();
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
  document.getElementById("alarmSoundChoice").value = "audio/iPhone-Alarm-Original.mp3";
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
  currentNotificationType = 'alarm';
  updateOverlayButtons();
}

function hideAlarmNotification(){
  document.getElementById("alarmOverlay").style.display = 'none';
  currentRingingAlarm = null;
  currentNotificationType = null;
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
  console.log('Snoozing for ' + minutes + ' minutes');
  setTimeout(() => {
    console.log('Snooze timeout triggered, ringing alarm');
    const soundEl = document.getElementById("alarmSound");
    soundEl.src = currentRingingAlarm.sound;
    soundEl.loop = true;
    soundEl.play().catch(() => {});
    showFullScreenAlarm(currentRingingAlarm);
  }, minutes * 60000);
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
    playTimerSound();
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

function playTimerSound() {
  const soundEl = document.getElementById("alarmSound");
  soundEl.src = document.getElementById("timerSoundChoice").value;
  soundEl.loop = true;
  soundEl.play().catch(() => {});
  showTimerFinished();
}

function showTimerFinished() {
  const overlay = document.getElementById("alarmOverlay");
  document.getElementById('alarmOverlayMessage').innerText = 'Timer finished!';
  overlay.style.display = 'flex';
  currentNotificationType = 'timer';
  updateOverlayButtons();
}

function updateOverlayButtons() {
  const stopButton = document.querySelector('#alarmOverlay button.stop-button');
  const secondButton = document.querySelector('#alarmOverlay button:not(.stop-button)');
  
  if (currentNotificationType === 'alarm') {
    stopButton.textContent = 'Stop';
    stopButton.onclick = stopAlarm;
    secondButton.textContent = 'Snooze';
    secondButton.onclick = snoozeCurrentAlarm;
    secondButton.style.display = 'inline-block';
  } else if (currentNotificationType === 'timer') {
    stopButton.textContent = 'Stop';
    stopButton.onclick = stopTimerSound;
    secondButton.style.display = 'none'; // Hide snooze button for timer
  }
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

/* ---------- WEATHER ---------- */
let weatherData = null;
let weatherLoaded = false;

function getWeatherLocation() {
    if (!navigator.geolocation) {
        showWeatherError('Geolocation is not supported by your browser');
        return;
    }
    
    if (weatherLoaded) return;
    
    document.getElementById('weatherLoading').style.display = 'block';
    document.getElementById('weatherError').style.display = 'none';
    document.getElementById('weatherCurrent').style.display = 'none';
    document.getElementById('weatherForecast').style.display = 'none';
    document.getElementById('forecastTitle').style.display = 'none';
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
            document.getElementById('weatherLoading').style.display = 'none';
            showWeatherError('Unable to get your location. Please enable location services.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function showWeatherError(msg) {
    const errorEl = document.getElementById('weatherError');
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
}

async function fetchWeather(lat, lon, locationName = null) {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Weather API error');
        
        weatherData = await response.json();
        displayWeather(weatherData, locationName);
    } catch (error) {
        document.getElementById('weatherLoading').style.display = 'none';
        showWeatherError('Failed to fetch weather data. Please try again.');
    }
}

function displayWeather(data, locationName = null) {
    weatherLoaded = true;
    document.getElementById('weatherLoading').style.display = 'none';
    document.getElementById('weatherError').style.display = 'none';
    document.getElementById('weatherCurrent').style.display = 'block';
    document.getElementById('forecastTitle').style.display = 'block';
    document.getElementById('weatherForecast').style.display = 'flex';
    
    const current = data.current;
    const daily = data.daily;
    
    document.getElementById('weatherTemp').textContent = Math.round(current.temperature_2m);
    document.getElementById('weatherDesc').textContent = getWeatherDescription(current.weather_code);
    document.getElementById('weatherHumidity').textContent = current.relative_humidity_2m;
    document.getElementById('weatherWind').textContent = Math.round(current.wind_speed_10m);
    
    if (locationName) {
        document.getElementById('weatherLocation').textContent = locationName;
    } else {
        document.getElementById('weatherLocation').textContent = data.latitude.toFixed(2) + ', ' + data.longitude.toFixed(2);
    }
    
    const forecastEl = document.getElementById('weatherForecast');
    forecastEl.innerHTML = '';
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(daily.time[i]);
        const dayName = i === 0 ? 'Today' : days[date.getDay()];
        
        const dayDiv = document.createElement('div');
        dayDiv.className = 'forecast-day';
        dayDiv.innerHTML = `
            <div class="forecast-day-name">${dayName}</div>
            <div class="forecast-day-icon">${getWeatherIcon(daily.weather_code[i])}</div>
            <div class="forecast-day-temp">${Math.round(daily.temperature_2m_max[i])}°</div>
            <div style="font-size: 12px; color: var(--muted);">${Math.round(daily.temperature_2m_min[i])}°</div>
        `;
        forecastEl.appendChild(dayDiv);
    }
}

function getWeatherDescription(code) {
    const weatherCodes = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Foggy',
        48: 'Depositing rime fog',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        71: 'Slight snow',
        73: 'Moderate snow',
        75: 'Heavy snow',
        80: 'Slight rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with hail',
        99: 'Thunderstorm with heavy hail'
    };
    return weatherCodes[code] || 'Unknown';
}

function getWeatherIcon(code) {
    if (code === 0) return '☀️';
    if (code >= 1 && code <= 3) return '⛅';
    if (code >= 45 && code <= 48) return '🌫️';
    if (code >= 51 && code <= 55) return '🌧️';
    if (code >= 61 && code <= 65) return '🌧️';
    if (code >= 71 && code <= 75) return '❄️';
    if (code >= 80 && code <= 82) return '🌦️';
    if (code >= 95) return '⛈️';
    return '🌤️';
}

/* ---------- MAP ---------- */
let map = null;
let marker = null;
let mapLoaded = false;

function getMapLocation() {
    if (!navigator.geolocation) {
        showMapError('Geolocation is not supported by your browser');
        return;
    }
    
    if (mapLoaded) return;
    
    document.getElementById('mapLoading').style.display = 'block';
    document.getElementById('mapError').style.display = 'none';
    document.getElementById('mapContainer').style.display = 'none';
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            initMap(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
            document.getElementById('mapLoading').style.display = 'none';
            showMapError('Unable to get your location. Please enable location services.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function showMapError(msg) {
    const errorEl = document.getElementById('mapError');
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
}

function initMap(lat, lon) {
    mapLoaded = true;
    document.getElementById('mapLoading').style.display = 'none';
    document.getElementById('mapError').style.display = 'none';
    document.getElementById('mapContainer').style.display = 'block';
    
    if (map) {
        map.remove();
    }
    
    map = L.map('map').setView([lat, lon], 14);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    if (marker) {
        map.removeLayer(marker);
    }
    
    marker = L.marker([lat, lon]).addTo(map)
        .bindPopup('You are here')
        .openPopup();
}

/* ---------- CHECK ALARMS ---------- */
setInterval(() => {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0,5);
  console.log('Checking alarms at ' + currentTime);
  alarms.forEach(alarm => {
    let shouldRing = false;
    if (alarm.time === currentTime) {
      shouldRing = true;
      console.log('Ringing due to time match: ' + alarm.time);
    }
    if (shouldRing && alarm.lastTriggered !== currentTime) {
      console.log('Triggering alarm ring');
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
