import { SCHEMA_VERSION } from "./data/constants.js";

export const store = {
  currentUser: null,
  authError: "",
  authBusy: false,
  loginUser: "",
  loginMode: null,
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
      weeklyGoal: null,
      restTimerActive: null,
      unit: "kg",
      keepAwake: true,
      beepEnabled: true,
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
  historyExpanded: false,
  restTimerInterval: null,
  sheetClockInterval: null,
  heroClockInterval: null,
  toastTimer: undefined,
  wakeLock: null,
  storagePersisted: null,
  avatarUrl: null,
  backupCount: 0,
  backupList: [],
  autoBackupError: null,
  autoBackupWarned: false,
  storageUsage: null,
  storageUsageAt: 0,
  statsRange: 30,
  _libGroupMap: null,
  autoSaveTimer: null,
  updateBusy: false,
  reloadingForUpdate: false,
  lastBgCheck: 0
};

store.historyMonth.setDate(1);

store.historyMonth.setHours(0, 0, 0, 0);
