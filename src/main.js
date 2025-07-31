import { createApp } from "vue";
import App from "./App.vue";
import { ref } from "vue";
import { Geolocation } from "@capacitor/geolocation";
import { Preferences } from "@capacitor/preferences";
import L from "leaflet";

// Initialisiere reaktive Variablen
const showLoading = ref(false);
const userPosition = ref(null);
const center = ref([51.505, -0.09]);
const zoom = ref(13);

createApp(App)
  .use({
    install(app) {
      app.config.globalProperties.$geolocation = Geolocation;
      app.config.globalProperties.$preferences = Preferences;
      app.config.globalProperties.$leaflet = L;
      app.config.globalProperties.$showLoading = showLoading;
      app.config.globalProperties.$userPosition = userPosition;
      app.config.globalProperties.$center = center;
      app.config.globalProperties.$zoom = zoom;
    },
  })
  .mount("#app");

async function requestLocationPermission() {
  try {
    const status = await Permissions.requestPermissions({
      permissions: ["location"],
    });

    return status.location === "granted";
  } catch (error) {
    console.error("Fehler beim Anfordern der Berechtigung:", error);
    return false;
  }
}

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
    } else {
      console.log("Standortberechtigung wurde nicht erteilt");
      // Hier könntest du eine Benutzerfreundliche Meldung anzeigen
    }
  } catch (error) {
    console.error("Fehler bei der Standortbestimmung:", error);
  } finally {
    showLoading.value = false;
  }
}

// Lade gespeicherten Zustand
Preferences.get({ key: "mapState" }).then((saved) => {
  if (saved.value) {
    const { zoom: savedZoom, center: savedCenter } = JSON.parse(saved.value);
    zoom.value = savedZoom;
    center.value = savedCenter;
  }
});

// Speichere Zustand bei Änderung
watch(
  [() => zoom.value, () => center.value],
  () => {
    Preferences.set({
      key: "mapState",
      value: JSON.stringify({ zoom: zoom.value, center: center.value }),
    });
  },
  { deep: true },
);
