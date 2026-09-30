import { SCHEMA_VERSION } from "./data/constants.js";

export const store = {
  currentUser: null,
  authError: "",
  authBusy: false,
  activeTab: "inicio",
  treinosView: "list",
  treinosFilter: "all",
  treinosEditKey: null,
  perfilOpen: false,
  perfilEditingName: false,
  dadosBackupOpen: false,
  data: {
    order: ["A", "B", "C"],
    workouts: {
      A: {
        name: "Treino A",
        exercises: []
      },
      B: {
        name: "Treino B",
        exercises: []
      },
      C: {
        name: "Treino C",
        exercises: []
      }
    },
    sessions: {},
    body: [],
    schemaVersion: SCHEMA_VERSION,
    activeSession: {
      letter: null,
      state: "idle",
      elapsedMs: 0,
      startedAt: null,
      startedDate: null
    },
    settings: {
      reminder: {
        enabled: false,
        time: "18:00",
        lastNotifiedDate: null
      },
      lastBackupAt: null,
      workoutsCollapsed: false,
      collapsedSections: {},
      restDuration: 90,
      weekStartsMonday: false,
      restTimerActive: null,
      unit: "kg",
      keepAwake: true,
      avatarUrl: null,
      displayName: ""
    }
  },
  loadFailed: false,
  saveInFlight: false,
  exIdCounter: 1,
  restCounter: 1,
  overlay: null,
  updateAvailable: null,
  swRegistration: null,
  historyMonth: new Date(),
  restTimerInterval: null,
  sheetClockInterval: null,
  heroClockInterval: null,
  toastTimer: undefined,
  wakeLock: null,
  storagePersisted: null,
  statsRange: 30,
  _libGroupMap: null,
  autoSaveTimer: null,
  updateBusy: false,
  reloadingForUpdate: false,
  lastBgCheck: 0
};

store.historyMonth.setDate(1);

store.historyMonth.setHours(0, 0, 0, 0);
