<script setup>
import { ref, nextTick } from 'vue';
import { LMap, LTileLayer, LMarker } from '@vue-leaflet/vue-leaflet';
import "leaflet/dist/leaflet.css";
import { Geolocation } from "@capacitor/geolocation";

const zoom = ref(13);
const center = ref([51.505, -0.09]);
const showLoading = ref(false);
const userPosition = ref(null);
const searchQuery = ref('');
const searchPosition = ref(null);

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

// Funktion zum Anfordern der Standortberechtigung
async function requestLocationPermission() {
  try {
    // Berechtigungen prüfen
    const status = await Geolocation.checkPermissions();

    if (status.location === "granted") {
      return true;
    }

    // Berechtigungen anfordern, falls nicht erteilt
    const requestStatus = await Geolocation.requestPermissions();
    return requestStatus.location === "granted";
  } catch (error) {
    console.error('Fehler beim Anfordern der Berechtigung:', error);
    return false;
  }
}

// Aktualisierte locateUser Funktion mit Berechtigungsprüfung
async function locateUser() {
  showLoading.value = true;

  try {
    // Prüfen, ob Berechtigung erteilt wurde oder angefordert werden muss
    const hasPermission = await requestLocationPermission();

    if (hasPermission) {
      const pos = await Geolocation.getCurrentPosition();
      userPosition.value = [pos.coords.latitude, pos.coords.longitude];
      center.value = userPosition.value;
      zoom.value = 16;

      // Marker für User Position aktualisieren
      nextTick(() => {
        if (userPosition.value) {
          // Hier könntest du den Marker neu rendern, falls nötig
        }
      });
    } else {
      console.log('Standortberechtigung wurde nicht erteilt');
      // Hier könntest du eine Benutzerfreundliche Meldung anzeigen
    }
  } catch (error) {
    console.error("Fehler bei der Standortbestimmung:", error);
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
      v-model:zoom="zoom"
      v-model:center="center"
      style="height: calc(100vh - 120px); width: 100%;"
      :use-global-leaflet="false"
    >
      <l-tile-layer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        :attribution="attributionContent"
      />
      <l-marker v-if="userPosition" :lat-lng="userPosition" />
      <l-marker v-if="searchPosition" :lat-lng="searchPosition" />
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
}

.search-input {
  flex-grow: 1;
  padding: 12px 20px;
  font-size: 16px;
  border: none;
  border-radius: 4px 0 0 4px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.3);
}

.search-button {
  padding: 0 20px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
  font-size: 16px;
}

.search-button:hover {
  background-color: #45a049;
}

.location-button-container {
  position: absolute;
  top: 10px;
  right: 20px;
  z-index: 1000;
}

.location-button {
  display: flex;
  align-items: center;
  padding: 10px 15px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 22px; /* Halbrund für Button */
  cursor: pointer;
  font-size: 16px;
  gap: 8px;
}

.location-button:hover {
  background-color: #2980b9;
}
</style>
