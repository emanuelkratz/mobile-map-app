<script setup>
import { ref, onMounted, watch } from 'vue';
import { LMap, LTileLayer, LMarker } from '@vue-leaflet/vue-leaflet';
import "leaflet/dist/leaflet.css";
import { Geolocation } from "@capacitor/geolocation";
import { Preferences } from "@capacitor/preferences";
import L from 'leaflet';

const zoom = ref(13);
const center = ref([51.505, -0.09]);
const showLoading = ref(false);
const userPosition = ref(null);
const searchQuery = ref('');
const searchPosition = ref(null);
const mapRef = ref(null);

// Marker-Icons
const userIcon = new L.Icon({
  iconUrl: '/user-marker.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41],
});

const searchIcon = new L.Icon({
  iconUrl: '/search-marker.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41],
});

// Karte Zustand speichern, wenn sich center oder zoom ändern
watch(
  [center, zoom],
  async ([newCenter, newZoom]) => {
    await Preferences.set({
      key: 'mapState',
      value: JSON.stringify({ center: newCenter, zoom: newZoom }),
    });
  },
  { deep: true }
);

// Lade gespeicherten Zustand beim Start
onMounted(async () => {
  const { value } = await Preferences.get({ key: 'mapState' });
  if (value) {
    try {
      const savedState = JSON.parse(value);
      if (savedState.center && savedState.zoom) {
        center.value = savedState.center;
        zoom.value = savedState.zoom;
      }
    } catch (e) {
      console.error('Fehler beim Parsen des gespeicherten Map-Status', e);
    }
  }
});

// Geocoding mit Nominatim (OpenStreetMap)
async function geocodeAddress(address) {
  showLoading.value = true;
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
    if (!response.ok) throw new Error('Geocoding failed');

    const data = await response.json();
    if (data.length > 0) {
      const { lat, lon } = data[0];
      return [parseFloat(lat), parseFloat(lon)];
    }
    return null;
  } catch (error) {
    console.error('Error during geocoding:', error);
    return null;
  } finally {
    showLoading.value = false;
  }
}

async function handleSearch() {
  if (!searchQuery.value.trim()) return;
  const coords = await geocodeAddress(searchQuery.value);
  if (coords) {
    center.value = coords;
    zoom.value = 17;
    searchPosition.value = coords;
  }
}

async function requestLocationPermission() {
  try {
    const status = await Geolocation.checkPermissions();
    if (status.location === "granted") return true;
    const requestStatus = await Geolocation.requestPermissions();
    return requestStatus.location === "granted";
  } catch (error) {
    console.error('Fehler beim Anfordern der Berechtigung:', error);
    return false;
  }
}


async function locateUser() {
  showLoading.value = true;
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      console.log('Keine Berechtigung');
      return;
    }
    const pos = await Geolocation.getCurrentPosition();
    userPosition.value = [pos.coords.latitude, pos.coords.longitude];
    zoom.value = 16;
    if (mapRef.value) {
      mapRef.value.mapObject.setView(userPosition.value, zoom.value);
    } else {
      center.value = userPosition.value; // Fallback
    }
  } catch (e) {
    console.error(e);
  } finally {
    showLoading.value = false;
  }
}

const attributionContent = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
</script>

<template>
  <div class="app-container">
    <div class="search-container">
      <input
        v-model="searchQuery"
        @keyup.enter="handleSearch"
        placeholder="Adresse oder Koordinaten eingeben..."
        class="search-input"
      />
      <button @click="handleSearch" class="search-button">Suchen</button>
    </div>

    <div class="location-button-container">
      <button @click="locateUser" class="location-button">
        <span>📍</span> Meinen Standort finden
      </button>
    </div>

  <l-map
    ref="mapRef"
    v-model:zoom="zoom"
    v-model:center="center"
    :use-global-leaflet="false"
    style="height: 100vh; width: 100%;"
  >
    <l-tile-layer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; OpenStreetMap contributors'
    />
      <l-marker v-if="userPosition" :lat-lng="userPosition" :icon="userIcon" />
      <l-marker v-if="searchPosition" :lat-lng="searchPosition" :icon="searchIcon" />
  </l-map>
  </div>

  <ion-loading :is-open="showLoading" message="Lade..." />
</template>

<style scoped>
.app-container {
  position: relative;
  height: 100vh;
  width: 100%;
}

.search-container {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  width: 80%;
  max-width: 600px;
  background-color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(5px);
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
}

.search-input {
  flex-grow: 1;
  padding: 12px 20px;
  font-size: 16px;
  border: none;
  border-radius: 8px 0 0 8px;
}

.search-button {
  padding: 0 20px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 0 8px 8px 0;
  cursor: pointer;
  font-size: 16px;
}

.search-button:hover {
  background-color: #45a049;
}

.location-button-container {
  position: absolute;
  top: 70px;
  right: 20px;
  z-index: 1000;
}

.location-button {
  display: flex;
  align-items: center;
  padding: 10px 15px;
  background-color: rgba(52, 152, 219, 0.85);
  color: white;
  border: none;
  border-radius: 22px;
  cursor: pointer;
  font-size: 16px;
  gap: 8px;
  backdrop-filter: blur(4px);
}

.location-button:hover {
  background-color: rgba(41, 128, 185, 0.95);
}
</style>
