<script setup lang="ts">
import { IonLoading } from '@ionic/vue'
defineOptions({
  components: { IonLoading }
})
import { NativeGeocoder } from '@capgo/nativegeocoder';
import { Capacitor } from '@capacitor/core';
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

// watch([center, zoom], …)
onMounted(async () => {
  const { value } = await Preferences.get({ key: 'mapState' });
  if (value) {
    const { center: c, zoom: z } = JSON.parse(value);
    center.value = c; zoom.value = z;
  }
});

const isWeb = Capacitor.getPlatform() === 'web';

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  showLoading.value = true;
  try {
    console.log('[GEOCODE] Anfrage für:', address);

    // 1) Web-Fallback (nur im Browser)
    if (isWeb) {
      console.log('[GEOCODE] Web-Fallback via OSM');
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`,
        {
          headers: {
            'User-Agent': 'KartenApp/1.0 (mail@beispiel.de)'
          }
        }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      console.log('[GEOCODE] OSM-Daten:', data);
      if (Array.isArray(data) && data.length > 0) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      }
      return null;
    }

    // 2) Native-Geocoding auf Device/Emulator
    const raw = await NativeGeocoder.forwardGeocode({
      addressString:  address,
      maxResults:     5,
      defaultLocale: 'de'
    });
    console.log('[GEOCODE] Native-Rohdaten (stringified):', JSON.stringify(raw));

    // Normalisiere in ein Array von Treffern
    let hits: any[] = [];
    if (Array.isArray(raw)) {
      hits = raw;
    } else if (raw && Array.isArray((raw as any).addresses)) {
      hits = (raw as any).addresses;
    } else if (raw && Array.isArray((raw as any).coordinates)) {
      hits = (raw as any).coordinates;
    } else {
      console.warn('[GEOCODE] Unbekanntes Format, ignoriere raw');
    }
    console.log('[GEOCODE] Parsed Treffer:', hits);

    // 3) Ersten Treffer auswerten
    if (hits.length > 0) {
      const first = hits[0] as any;
      // Unterstütze unterschiedliche Property-Namen:
      const lat = first.latitude ?? first.lat ?? (Array.isArray(first) ? first[0] : null);
      const lng = first.longitude ?? first.lon ?? (Array.isArray(first) ? first[1] : null);
      if (lat != null && lng != null) {
        console.log('[GEOCODE] Gefundene Koords:', lat, lng);
        return [Number(lat), Number(lng)];
      }
      console.warn('[GEOCODE] Treffer ohne lat/lng:', first);
    }

    console.warn('[GEOCODE] Keine gültigen Treffer für Adresse');
    return null;

  } catch (error) {
    console.error('[GEOCODE] Exception:', error);
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
    userPosition.value = [pos.coords.latitude, pos.coords.longitude]
    // Immer das Center-Ref aktualisieren
    center.value = userPosition.value;
    zoom.value = 16;
  } catch (e) {
    console.error(e);
  } finally {
    showLoading.value = false;
  }
}

const attributionContent = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
// 1) Beim Start gespeicherte Position & Zoom laden
onMounted(async () => {
  const { value: c } = await Preferences.get({ key: 'center' })
  const { value: z } = await Preferences.get({ key: 'zoom' })
  if (c) center.value = JSON.parse(c)
  if (z) zoom.value   = Number(z)
})

// 2) Änderungen speichern
watch(center, (newC) => {
  Preferences.set({ key: 'center', value: JSON.stringify(newC) })
})
watch(zoom, (newZ) => {
  Preferences.set({ key: 'zoom',   value: String(newZ) })
})

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
