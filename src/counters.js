import { store } from "./store.js";

export function newExId() {
  return "ex" + store.exIdCounter++;
}

export function newRestKey() {
  return "REST" + store.restCounter++;
}

export function initExIdCounter() {
  let max = 0;
  Object.values(store.data.workouts).forEach(w => {
    (w.exercises || []).forEach(ex => {
      const n = parseInt(String(ex.id).replace("ex", ""), 10);
      if (!isNaN(n) && n > max) max = n;
    });
  });
  store.exIdCounter = max + 1;
}

export function initRestCounter() {
  let max = 0;
  store.data.order.forEach(k => {
    const m = /^REST(\d+)$/.exec(k);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  });
  store.restCounter = max + 1;
}
