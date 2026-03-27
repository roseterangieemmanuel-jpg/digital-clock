let currentTimeZone = 'local';
let alarms = JSON.parse(localStorage.getItem("alarms")) || [];
let worldClockCities = JSON.parse(localStorage.getItem("worldClockCities")) || [];

// Pre-populate with Abidjan as in the user's example if empty
if (worldClockCities.length === 0) {
    addInitialCity('Abidjan', 5.36, -4.00);
}

async function addInitialCity(name, lat, lon) {
    try {
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`);
        const weatherData = await weatherRes.json();
        const timezone = weatherData.timezone;

        const newCity = {
            name: name,
            lat: lat,
            lon: lon,
            timezone: timezone,
            temp: Math.round(weatherData.current.temperature_2m),
            weather_code: weatherData.current.weather_code
        };

        if (!worldClockCities.some(c => c.name === newCity.name)) {
            worldClockCities.push(newCity);
            localStorage.setItem("worldClockCities", JSON.stringify(worldClockCities));
            renderWorldClockList();
        }
    } catch (e) { console.error(e); }
}
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
}

function openMapModal() {
    document.getElementById('mapModal').style.display = 'flex';
    if (!mapLoaded) {
        getMapLocation();
    }
}

function closeMapModal() {
    document.getElementById('mapModal').style.display = 'none';
}

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    const modal = document.getElementById('mapModal');
    if (event.target === modal) {
        closeMapModal();
    }
});

/* ---------- WORLD CLOCK LIST ---------- */
function removeWorldClockCity(index) {
    worldClockCities.splice(index, 1);
    localStorage.setItem("worldClockCities", JSON.stringify(worldClockCities));
    renderWorldClockList();
}

function formatWorldClockTime(timezone) {
    const now = new Date();
    const options = {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now);
    
    let hour = parts.find(p => p.type === 'hour').value;
    let minute = parts.find(p => p.type === 'minute').value;
    let dayPeriod = parts.find(p => p.type === 'dayPeriod').value;
    
    // User wants "!!:34 Am" format. The !! is literal.
    return `!!:${minute} ${dayPeriod.charAt(0).toUpperCase()}${dayPeriod.charAt(1).toLowerCase()}`;
}

function getTimeOffsetDescription(timezone) {
    const now = new Date();
    const localTime = now.getTime();
    
    // Get target time in the target timezone
    const targetString = now.toLocaleString('en-US', { timeZone: timezone });
    const targetDate = new Date(targetString);
    const targetTime = targetDate.getTime();
    
    // Difference in hours
    const diffMs = targetTime - localTime;
    const diffHrs = Math.round(diffMs / (1000 * 60 * 60));
    
    if (diffHrs === 0) return "Same as local";
    if (diffHrs > 0) return `${diffHrs} hours ahead`;
    return `${Math.abs(diffHrs)} hours behind`;
}

function getGMTShort(timezone) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'longOffset'
    });
    const parts = formatter.formatToParts(now);
    const offset = parts.find(p => p.type === 'timeZoneName').value;
    return offset.replace('GMT', 'GMT ').replace('+', '+').replace('-', '-');
}

function renderWorldClockList() {
    const list = document.getElementById("worldClockList");
    if (!list) return;
    
    list.innerHTML = "";
    
    worldClockCities.forEach((city, index) => {
        const now = new Date();
        const cityDate = new Date(now.toLocaleString('en-US', { timeZone: city.timezone }));
        
        let month = cityDate.toLocaleString('en-US', { month: 'short', timeZone: city.timezone });
        const day = cityDate.getDate();
        
        const timeStr = formatWorldClockTime(city.timezone);
        const offsetStr = getTimeOffsetDescription(city.timezone);
        const gmtStr = getGMTShort(city.timezone);
        
        const li = document.createElement("li");
        li.className = "world-clock-item";
        li.style.cursor = "pointer"; // Indicate clickability
        li.onclick = (e) => {
            // Only zoom if not clicking the delete button
            if (!e.target.classList.contains('delete-city-btn')) {
                if (city.lat !== undefined && city.lon !== undefined) {
                    zoomToLocation(city.lat, city.lon);
                }
            }
        };
        
        // Get icon for city based on its temperature/code if available, else default
        const cityIcon = getWeatherIcon(city.weather_code || 0);
        
        li.innerHTML = `
            <div class="world-clock-info">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="world-clock-icon">${cityIcon}</div>
                    <span class="world-clock-city">${city.name}, ${gmtStr}</span>
                </div>
                <span class="world-clock-details">
                    ${city.temp}° ${month} ${day}, ${offsetStr} ${timeStr}
                </span>
            </div>
            <button class="delete-city-btn" onclick="removeWorldClockCity(${index})">Delete</button>
        `;
        list.appendChild(li);
    });
}

/* ---------- ANALOG CLOCK ---------- */
function updateAnalogClock() {
  // Disabled - using 3D Earth instead
}

function setClockNumbers() {
  // Clock numbers removed - using globe instead
}

/* ---------- DIGITAL CLOCK ---------- */
function updateClockDisplay() {
    const now = new Date();
    // Main clock always displays local time as requested
    const time = now.toLocaleTimeString([]);
    const date = now.toLocaleDateString([]);
    
    document.getElementById('clock').innerText = time;
    document.getElementById('dateDisplay').innerText = date;
}

const timeZoneCoords = {
    'local': null,
    'America/New_York': { lat: 40.7128, lon: -74.0060 },
    'America/Chicago': { lat: 41.8781, lon: -87.6298 },
    'America/Denver': { lat: 39.7392, lon: -104.9903 },
    'America/Los_Angeles': { lat: 34.0522, lon: -118.2437 },
    'Europe/London': { lat: 51.5074, lon: -0.1278 },
    'Europe/Paris': { lat: 48.8566, lon: 2.3522 },
    'Asia/Tokyo': { lat: 35.6762, lon: 139.6503 },
    'UTC': { lat: 51.4772, lon: 0.0 }
};

function zoomToLocation(lat, lon) {
    if (!earthMesh || !earthCamera) return;
    
    // Hide auto rotate
    autoRotate = false;
    
    // Use updateMarker which already has rotation animation and marker placement
    if (typeof updateMarker === 'function') {
        updateMarker(lat, lon);
    }
    
    // Zoom in effect
    if (typeof animateZoom === 'function') {
        animateZoom(earthCamera.position.z, 4);
    }
}

function zoomIn() {
    if (earthCamera) {
        earthCamera.position.z = Math.max(2, earthCamera.position.z - 0.8);
    }
}

function zoomOut() {
    if (earthCamera) {
        earthCamera.position.z = Math.min(10, earthCamera.position.z + 0.8);
    }
}

function animateZoom(from, to) {
    let progress = 0;
    const zoomInterval = setInterval(() => {
        progress += 0.03;
        if (progress >= 1) {
            clearInterval(zoomInterval);
            return;
        }
        const eased = 1 - Math.pow(1 - progress, 3);
        earthCamera.position.z = from + (to - from) * eased;
    }, 16);
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
function openTimeZoneModal() {
    document.getElementById('timeZoneModal').style.display = 'flex';
    populateTimeZoneList();
}

function closeTimeZoneModal() {
    document.getElementById('timeZoneModal').style.display = 'none';
}

function populateTimeZoneList() {
    const container = document.getElementById('tzListContainer');
    if (!container) return;
    
    // Clear current
    container.innerHTML = "";
    
    const now = new Date();
    
    // 1. Add Local Time item with its info
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: localTz,
        timeZoneName: 'longOffset',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    const localParts = localFormatter.formatToParts(now);
    const localOffset = localParts.find(p => p.type === 'timeZoneName').value.replace('GMT', 'GMT ').replace('+', '+').replace('-', '-');
    const localTime = localParts.filter(p => p.type !== 'timeZoneName').map(p => p.value).join('').trim();
    
    const localItem = document.createElement('div');
    localItem.className = 'tz-item';
    localItem.setAttribute('data-tz', 'local');
    localItem.innerHTML = `
        <span class="tz-item-info">Local Time (${localTz.split('/').pop().replace(/_/g, ' ')}), ${localOffset}</span>
        <span class="tz-item-time">${localTime}</span>
    `;
    localItem.onclick = () => selectTimeZone('local', 'Local Time');
    container.appendChild(localItem);

    // 2. Add all other timezones
    const timezones = Intl.supportedValuesOf('timeZone');
    
    // Mapping for common timezones to countries for "missing texts"
    const tzToCountry = {
        'Africa/Abidjan': " Cote d'Ivolre",
        'Africa/Accra': " Ghana",
        'Africa/Addis_Ababa': " Ethiopia",
        'Africa/Algiers': " Algeria",
        'Africa/Asmara': " Eritrea",
        'Africa/Bamako': " Mali",
        'Africa/Bangui': " Central African Republic",
        'Africa/Banjul': " Gambia",
        'Africa/Bissau': " Guinea-Bissau",
        'Africa/Blantyre': " Malawi",
        'Africa/Brazzaville': " Congo",
        'Africa/Bujumbura': " Burundi",
        'Africa/Cairo': " Egypt",
        'Africa/Casablanca': " Morocco",
        'Africa/Ceuta': " Spain",
        'Africa/Conakry': " Guinea",
        'Africa/Dakar': " Senegal",
        'Africa/Dar_es_Salaam': " Tanzania",
        'Africa/Djibouti': " Djibouti",
        'Africa/Douala': " Cameroon",
        'Africa/El_Aaiun': " Western Sahara",
        'Africa/Freetown': " Sierra Leone",
        'Africa/Gaborone': " Botswana",
        'Africa/Harare': " Zimbabwe",
        'Africa/Johannesburg': " South Africa",
        'Africa/Juba': " South Sudan",
        'Africa/Kampala': " Uganda",
        'Africa/Khartoum': " Sudan",
        'Africa/Kigali': " Rwanda",
        'Africa/Kinshasa': " DR Congo",
        'Africa/Lagos': " Nigeria",
        'Africa/Libreville': " Gabon",
        'Africa/Lome': " Togo",
        'Africa/Luanda': " Angola",
        'Africa/Lubumbashi': " DR Congo",
        'Africa/Lusaka': " Zambia",
        'Africa/Malabo': " Equatorial Guinea",
        'Africa/Maputo': " Mozambique",
        'Africa/Maseru': " Lesotho",
        'Africa/Mbabane': " Eswatini",
        'Africa/Mogadishu': " Somalia",
        'Africa/Monrovia': " Liberia",
        'Africa/Nairobi': " Kenya",
        'Africa/Ndjamena': " Chad",
        'Africa/Niamey': " Niger",
        'Africa/Nouakchott': " Mauritania",
        'Africa/Ouagadougou': " Burkina Faso",
        'Africa/Porto-Novo': " Benin",
        'Africa/Sao_Tome': " Sao Tome and Principe",
        'Africa/Tripoli': " Libya",
        'Africa/Tunis': " Tunisia",
        'Africa/Windhoek': " Namibia",
        'America/New_York': " USA",
        'America/Los_Angeles': " USA",
        'America/Chicago': " USA",
        'America/Denver': " USA",
        'America/Anchorage': " USA",
        'America/Phoenix': " USA",
        'America/Toronto': " Canada",
        'America/Vancouver': " Canada",
        'America/Mexico_City': " Mexico",
        'America/Sao_Paulo': " Brazil",
        'America/Buenos_Aires': " Argentina",
        'America/Santiago': " Chile",
        'America/Bogota': " Colombia",
        'America/Lima': " Peru",
        'America/Caracas': " Venezuela",
        'Europe/London': " UK",
        'Europe/Paris': " France",
        'Europe/Berlin': " Germany",
        'Europe/Rome': " Italy",
        'Europe/Madrid': " Spain",
        'Europe/Moscow': " Russia",
        'Asia/Tokyo': " Japan",
        'Asia/Seoul': " South Korea",
        'Asia/Shanghai': " China",
        'Asia/Hong_Kong': " Hong Kong",
        'Asia/Singapore': " Singapore",
        'Asia/Dubai': " UAE",
        'Asia/Bangkok': " Thailand",
        'Asia/Jakarta': " Indonesia",
        'Asia/Manila': " Philippines",
        'Asia/Riyadh': " Saudi Arabia",
        'Asia/Kolkata': " India",
        'Australia/Sydney': " Australia",
        'Australia/Melbourne': " Australia",
        'Pacific/Auckland': " New Zealand"
    };
    
    timezones.forEach(tz => {
        const item = document.createElement('div');
        item.className = 'tz-item';
        item.setAttribute('data-tz', tz);
        
        // Get offset e.g., GMT +0:00
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            timeZoneName: 'longOffset',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        const parts = formatter.formatToParts(now);
        const offset = parts.find(p => p.type === 'timeZoneName').value.replace('GMT', 'GMT ').replace('+', '+').replace('-', '-');
        const timeStr = parts.filter(p => p.type !== 'timeZoneName').map(p => p.value).join('').trim();

        // Derive city/region name
        const city = tz.split('/').pop().replace(/_/g, ' ');
        const country = tzToCountry[tz] || (" " + tz.split('/')[0].replace(/_/g, ' '));
        
        item.innerHTML = `
            <span class="tz-item-info">${city}${country}, ${offset}</span>
            <span class="tz-item-time">${timeStr}</span>
        `;
        item.onclick = () => selectTimeZone(tz, `${city}${country}`);
        container.appendChild(item);
    });
}

function filterTimeZoneList() {
    const query = document.getElementById('tzSearchInput').value.toLowerCase();
    const items = document.querySelectorAll('.tz-item');
    items.forEach(item => {
        if (item.textContent.toLowerCase().includes(query)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

async function selectTimeZone(tz, label) {
    closeTimeZoneModal();
    
    // Feedback on button while loading
    const openBtn = document.getElementById('openTimeZoneBtn');
    const originalContent = openBtn.textContent;
    openBtn.textContent = '...';
    openBtn.disabled = true;

    try {
        // To get weather "degree", we need coordinates
        // Extract the city/country name from the timezone string
        const parts = label.split('/');
        const query = parts[parts.length - 1].replace(/_/g, ' ');
        
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const geoData = await geoRes.json();
        
        let lat = 0, lon = 0, cityName = query;
        if (geoData && geoData.length > 0) {
            lat = parseFloat(geoData[0].lat);
            lon = parseFloat(geoData[0].lon);
            cityName = geoData[0].display_name.split(',')[0];
            
            // Zoom the globe to this location
            if (earthScene) {
                zoomToLocation(lat, lon);
            }
        }

        // Get current weather
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`);
        const weatherData = await weatherRes.json();
        const temp = Math.round(weatherData.current.temperature_2m);
        const weather_code = weatherData.current.weather_code;

        const newCity = {
            name: cityName,
            lat: lat,
            lon: lon,
            timezone: tz,
            temp: temp,
            weather_code: weather_code
        };

        // Add to list if not already present
        if (!worldClockCities.some(c => c.timezone === tz && c.name === cityName)) {
            worldClockCities.push(newCity);
            localStorage.setItem("worldClockCities", JSON.stringify(worldClockCities));
            renderWorldClockList();
        }
    } catch (err) {
        console.error("Error adding from A-Z list:", err);
    } finally {
        openBtn.textContent = originalContent;
        openBtn.disabled = false;
    }
}

updateClockDisplay();
renderWorldClockList();
hideAlarmNotification();
setInterval(() => {
    updateClockDisplay();
    renderWorldClockList();
    
    // Also update selection list times if modal is visible
    const modal = document.getElementById('timeZoneModal');
    if (modal && modal.style.display === 'flex') {
        // We only update times of visible items for performance
        const items = document.querySelectorAll('.tz-item');
        const now = new Date();
        items.forEach(item => {
            const tz = item.getAttribute('data-tz');
            if (tz) {
                const timeEl = item.querySelector('.tz-item-time');
                if (timeEl) {
                    const formatter = new Intl.DateTimeFormat('en-US', {
                        timeZone: tz === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : tz,
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    });
                    timeEl.textContent = formatter.format(now);
                }
            }
        });
    }
}, 1000);

// 3D Earth renderer - initialize after DOM loads
document.addEventListener('DOMContentLoaded', init3DEarth);

// Cleanup stray text nodes under body (fixes random text appearing under page)
document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const strayNodes = Array.from(body.childNodes).filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  strayNodes.forEach(node => node.remove());
  
  // Close timezone modal when clicking outside
  window.addEventListener('click', (event) => {
      const modal = document.getElementById('timeZoneModal');
      if (event.target === modal) {
          closeTimeZoneModal();
      }
  });
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
        // Open-Meteo is a free, high-quality weather API that doesn't require an API key.
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
    
    document.getElementById('weatherMainIcon').innerHTML = getWeatherIcon(current.weather_code, true);
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

function getWeatherIcon(code, isMain = false) {
    const iconMap = {
        0: 'c01d', 1: 'c02d', 2: 'c03d', 3: 'c04d',
        45: 'a05d', 48: 'a05d',
        51: 'd01d', 53: 'd02d', 55: 'd03d',
        61: 'r01d', 63: 'r02d', 65: 'r03d',
        71: 's01d', 73: 's02d', 75: 's03d',
        80: 'r04d', 81: 'r05d', 82: 'r06d',
        95: 't01d', 96: 't02d', 99: 't03d'
    };
    const iconCode = iconMap[code] || 'c02d';
    const size = isMain ? 80 : 40;
    return `<img src="https://www.weatherbit.io/static/img/icons/${iconCode}.png" width="${size}" height="${size}" alt="Weather" style="display:block; margin:0 auto;">`;
}

/* ---------- MAP ---------- */
let mapLoaded = false;

function getMapLocation(force = false) {
    if (!navigator.geolocation) {
        showMapError('Geolocation is not supported by your browser');
        return;
    }
    
    if (mapLoaded && !force) return;
    
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

async function searchMapLocation() {
    const query = document.getElementById('mapSearchInput').value;
    if (!query) return;
    
    document.getElementById('mapLoading').style.display = 'block';
    document.getElementById('mapLoading').textContent = 'Searching...';
    document.getElementById('mapError').style.display = 'none';
    document.getElementById('mapContainer').style.display = 'none';
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            initMap(parseFloat(data[0].lat), parseFloat(data[0].lon));
        } else {
            document.getElementById('mapLoading').style.display = 'none';
            showMapError('Location not found. Try a different search.');
        }
    } catch (error) {
        console.error('Search error:', error);
        document.getElementById('mapLoading').style.display = 'none';
        showMapError('An error occurred while searching.');
    } finally {
        document.getElementById('mapLoading').textContent = 'Detecting location and loading map...';
    }
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
    
    const query = `${lat},${lon}`;
    const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&hl=en&z=15&output=embed`;
    document.getElementById('mapFrame').src = mapUrl;
}

// Add enter key listener for map search
document.addEventListener('DOMContentLoaded', () => {
    const mapSearchInput = document.getElementById('mapSearchInput');
    if (mapSearchInput) {
        mapSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchMapLocation();
            }
        });
    }
});

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

/* ---------- 3D EARTH MAP ---------- */
let earthScene, earthCamera, earthRenderer, earthMesh, earthAtmosphere, earthMarker, cloudMesh;
let isDragging = false, previousMousePosition = { x: 0, y: 0 };
let autoRotate = false; // Always false now
let currentLat = 0, currentLon = 0;

function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    return new THREE.Vector3(x, y, z);
}

function init3DEarth() {
    const canvas = document.getElementById('earthCanvas');
    if (!canvas) return;
    
    const cities = [
        { name: 'New York', lat: 40.7128, lon: -74.0060 },
        { name: 'London', lat: 51.5074, lon: -0.1278 },
        { name: 'Paris', lat: 48.8566, lon: 2.3522 },
        { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
        { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
        { name: 'Cairo', lat: 30.0444, lon: 31.2357 },
        { name: 'Rio de Janeiro', lat: -22.9068, lon: -43.1729 },
        { name: 'Moscow', lat: 55.7558, lon: 37.6173 },
        { name: 'Beijing', lat: 39.9042, lon: 116.4074 },
    ];

    function addCityMarkers() {
        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffd700 });
        cities.forEach(city => {
            const markerGeometry = new THREE.SphereGeometry(0.02, 16, 16);
            const cityMarker = new THREE.Mesh(markerGeometry, markerMaterial);
            const position = latLonToVector3(city.lat, city.lon, 1.5);
            cityMarker.position.copy(position);
            earthScene.add(cityMarker);
        });
    }

    const container = canvas.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    earthScene = new THREE.Scene();
    earthCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    earthCamera.position.z = 5;
    
    earthRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    earthRenderer.setSize(width, height);
    earthRenderer.setPixelRatio(window.devicePixelRatio);
    
    // Earth sphere with day/night texture
    const earthGeometry = new THREE.SphereGeometry(1.5, 64, 64);
    const earthMaterial = new THREE.ShaderMaterial({
        uniforms: {
            dayTexture: { value: new THREE.TextureLoader().load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_atmos_2048.jpg') },
            nightTexture: { value: new THREE.TextureLoader().load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_lights_2048.png') },
            sunDirection: { value: new THREE.Vector3(0.5, 0, 0.5) }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vNormal;
            void main() {
                vUv = uv;
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D dayTexture;
            uniform sampler2D nightTexture;
            uniform vec3 sunDirection;
            varying vec2 vUv;
            varying vec3 vNormal;

            void main() {
                vec3 dayColor = texture2D(dayTexture, vUv).rgb;
                vec3 nightColor = texture2D(nightTexture, vUv).rgb;
                
                float intensity = dot(vNormal, normalize(sunDirection));
                vec3 finalColor = mix(nightColor, dayColor, smoothstep(-0.2, 0.2, intensity));
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `
    });
    earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    earthScene.add(earthMesh);

    // Clouds
    const cloudGeometry = new THREE.SphereGeometry(1.52, 64, 64);
    const cloudMaterial = new THREE.MeshPhongMaterial({
        map: new THREE.TextureLoader().load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_clouds_2048.png'),
        transparent: true,
        opacity: 0.4
    });
    cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    earthScene.add(cloudMesh);
    
    // Country & State Borders
    const borderGeometry = new THREE.SphereGeometry(1.51, 64, 64);
    const borderMaterial = new THREE.MeshBasicMaterial({
        map: new THREE.TextureLoader().load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_specular_2048.jpg'),
        transparent: true,
        opacity: 0.8
    });
    const borderMesh = new THREE.Mesh(borderGeometry, borderMaterial);
    earthScene.add(borderMesh);
    
    // Atmosphere glow
    const atmosphereGeometry = new THREE.SphereGeometry(1.6, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vNormal;
            void main() {
                float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
            }
        `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true
    });
    earthAtmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    earthScene.add(earthAtmosphere);
    
    // Location marker
    const markerGeometry = new THREE.SphereGeometry(0.04, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    earthMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    earthMarker.visible = false;
    earthScene.add(earthMarker);
    
    // Marker ring
    const ringGeometry = new THREE.RingGeometry(0.05, 0.07, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
    const markerRing = new THREE.Mesh(ringGeometry, ringMaterial);
    earthMarker.add(markerRing);
    
    // Marker label
    const labelDiv = document.createElement('div');
    labelDiv.id = 'mapLabel';
    labelDiv.style.cssText = 'position:absolute;background:rgba(0,0,0,0.7);color:white;padding:4px 8px;border-radius:4px;font-size:12px;pointer-events:none;display:none;';
    container.appendChild(labelDiv);
    
    // Lights
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(5, 3, 5);
    earthScene.add(sunLight);
    
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    earthScene.add(ambientLight);
    
    addCityMarkers();

    // Get user location and place marker
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            currentLat = position.coords.latitude;
            currentLon = position.coords.longitude;
            updateMarker(currentLat, currentLon);
        }, () => {
            // Default to NYC if location denied
            currentLat = 40.7128;
            currentLon = -74.0060;
            updateMarker(currentLat, currentLon);
        });
    }
    
    // Mouse controls
    canvas.addEventListener('mousedown', (e) => { isDragging = true; });
    canvas.addEventListener('mouseup', () => { isDragging = false; });
    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;
            earthMesh.rotation.y += deltaX * 0.005;
            earthMesh.rotation.x += deltaY * 0.005;
        }
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    
    // Click to get coordinates
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), earthCamera);
        const intersects = raycaster.intersectObjects(earthScene.children);
        
        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            // Check for city marker (golden sphere)
            if (clickedObject.geometry.type === 'SphereGeometry' && clickedObject.material.color && clickedObject.material.color.getHex() === 0xffd700) {
                const city = cities.find(c => {
                    const cityPosition = latLonToVector3(c.lat, c.lon, 1.5);
                    return cityPosition.distanceTo(clickedObject.position) < 0.1;
                });
                if (city) {
                    showCoordinates(city.lat, city.lon, city.name);
                }
            } else {
                // Find point on Earth sphere
                const earthIntersect = intersects.find(intersect => intersect.object === earthMesh);
                if (earthIntersect) {
                    const point = earthIntersect.point;
                    const latLon = vector3ToLatLon(point);
                    currentLat = latLon.lat;
                    currentLon = latLon.lon;
                    updateMarker(currentLat, currentLon);
                    
                    // Show loading in label
                    showCoordinates(currentLat, currentLon, 'Loading location...');
                    
                    // Reverse geocode to get city/country name
                    reverseGeocode(currentLat, currentLon).then(name => {
                        showCoordinates(currentLat, currentLon, name);
                    });
                }
            }
        }
    });
    
    // Mouse wheel zoom
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSpeed = 0.5;
        earthCamera.position.z = Math.max(2, Math.min(10, earthCamera.position.z + (e.deltaY > 0 ? zoomSpeed : -zoomSpeed)));
    }, { passive: false });
    
    // Touch controls
    canvas.addEventListener('touchstart', (e) => { isDragging = true; });
    canvas.addEventListener('touchend', () => { isDragging = false; });
    canvas.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length === 1) {
            const deltaX = e.touches[0].clientX - previousMousePosition.x;
            const deltaY = e.touches[0].clientY - previousMousePosition.y;
            earthMesh.rotation.y += deltaX * 0.005;
            earthMesh.rotation.x += deltaY * 0.005;
        }
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    });
    
    animateEarth();
}

function vector3ToLatLon(vector3) {
    const radius = 1.5;
    const lat = 90 - (Math.acos(vector3.y / radius) * 180 / Math.PI);
    let lon = ((Math.atan2(vector3.x, vector3.z) * 180 / Math.PI) + 180) % 360 - 180;
    return { lat, lon };
}

function updateMarker(lat, lon) {
    if (!earthMarker || !earthMesh) return;
    
    // Disable auto rotate
    autoRotate = false;
    
    earthMarker.visible = true;
    const position = latLonToVector3(lat, lon, 1.55);
    earthMarker.position.copy(position);
    earthMarker.lookAt(0, 0, 0);
    
    // Rotate Earth to show location
    // Note: This is an approximation for centering the globe at (lat, lon)
    const targetLon = -lon * (Math.PI / 180);
    const targetLat = lat * (Math.PI / 180);
    
    // Animate to location with easing
    const startRotation = { x: earthMesh.rotation.x, y: earthMesh.rotation.y };
    let progress = 0;
    
    const animateToLocation = setInterval(() => {
        progress += 0.04;
        if (progress >= 1) {
            clearInterval(animateToLocation);
            return;
        }
        
        const eased = 1 - Math.pow(1 - progress, 3);
        earthMesh.rotation.x = startRotation.x + (targetLat * 0.5 - startRotation.x) * eased;
        earthMesh.rotation.y = startRotation.y + (targetLon - startRotation.y) * eased;
    }, 16);
}

let labelTimeout;
function showCoordinates(lat, lon, name = null) {
    const label = document.getElementById('mapLabel');
    if (label) {
        label.style.display = 'block';
        if (name) {
            label.textContent = name;
        } else {
            label.textContent = `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
        }
        
        // Clear previous timeout to prevent premature hiding
        if (labelTimeout) clearTimeout(labelTimeout);
        labelTimeout = setTimeout(() => { label.style.display = 'none'; }, 6000);
    }
}

async function reverseGeocode(lat, lon) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
        const data = await response.json();
        if (data && data.display_name) {
            const parts = data.display_name.split(',');
            // Return first few parts (e.g. City, Region, Country)
            return parts.slice(0, 3).join(', ');
        }
        return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
    } catch (error) {
        console.error('Reverse geocode error:', error);
        return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
    }
}

function animateEarth() {
    requestAnimationFrame(animateEarth);
    if (autoRotate) {
        earthMesh.rotation.y += 0.0005;
        cloudMesh.rotation.y += 0.0006;
    }
    if (earthRenderer && earthScene && earthCamera) {
        earthRenderer.render(earthScene, earthCamera);
    }
}
