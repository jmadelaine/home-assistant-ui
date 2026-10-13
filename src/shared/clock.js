// One clock for every card that shows seconds, so they all change together,
// as each second of the system clock begins.

const listeners = new Set();
let timeout;

function schedule() {
  // A few ms past the second, so Date.now() is safely in the new one
  timeout = setTimeout(
    () => {
      const now = Date.now();
      for (const fn of listeners) fn(now);
      if (listeners.size) schedule();
      else timeout = undefined;
    },
    1000 - (Date.now() % 1000) + 5,
  );
}

// Calls `fn(now)` at the start of every second. Returns a function that stops it.
export function everySecond(fn) {
  listeners.add(fn);
  if (!timeout) schedule();
  return () => {
    listeners.delete(fn);
    if (!listeners.size) {
      clearTimeout(timeout);
      timeout = undefined;
    }
  };
}
