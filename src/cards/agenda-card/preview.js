// Mock calendars for the playground, answering Home Assistant's calendar API
// (GET calendars/<entity>?start=&end=). Events are placed relative to now, so
// there's always something on now, later today, and in the days ahead.

const HOUR = 3600e3;

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};
// `days` from today at hh:mm, local time
const at = (days, hh, mm = 0) => {
  const d = addDays(today(), days);
  d.setHours(hh, mm, 0, 0);
  return d;
};

const timed = (summary, start, end, more = {}) => ({
  summary,
  start: { dateTime: start.toISOString() },
  end: { dateTime: end.toISOString() },
  ...more,
});
// All-day events end on the day after their last day, as in Google Calendar
const allDay = (summary, firstDay, days = 1, more = {}) => ({
  summary,
  start: { date: ymd(addDays(today(), firstDay)) },
  end: { date: ymd(addDays(today(), firstDay + days)) },
  ...more,
});

function events(entity) {
  const now = Date.now();
  const hour = (h) => new Date(Math.round(now / HOUR) * HOUR + h * HOUR);
  if (entity === "calendar.personal") {
    return [
      timed("Gym", hour(-3), hour(-2)), // finished, so hidden
      allDay("Bin day", 0, 1, { description: "Recycling and garden waste" }),
      timed("Swimming lessons", new Date(now - 0.5 * HOUR), new Date(now + 0.5 * HOUR), {
        location: "Community pool",
      }),
      timed("Dinner with Sam", hour(2), hour(4), { location: "Café Rio, 12 Main St" }),
      timed("Dentist", at(1, 9), at(1, 10), {
        location: "Smile Dental",
        description: "Bring <b>insurance card</b><br>Dr. Patel, 2nd floor",
      }),
      timed("Quarterly review", at(2, 14), at(2, 15, 30)),
      allDay("Weekend away", 3, 3, { location: "Lake cabin" }),
      timed("School play", at(5, 18), at(5, 19, 30), { location: "Westfield Elementary" }),
      timed("Conference", at(8, 9), at(9, 17), { location: "Convention center" }),
      allDay("Flight to Lisbon", 20), // beyond the default two weeks
    ];
  }
  if (entity === "calendar.birthdays") {
    return [allDay("Anna's birthday", 6), allDay("Dad's birthday", 11)];
  }
  return [];
}

export default {
  entities: {
    "calendar.personal": {
      state: "on",
      attributes: { friendly_name: "Personal", message: "Swimming lessons" },
    },
    "calendar.birthdays": {
      state: "off",
      attributes: { friendly_name: "Birthdays", message: "Anna's birthday" },
    },
  },
  api(method, path) {
    const url = new URL(path, "http://ha/api/");
    const entity = url.pathname.match(/calendars\/(calendar\.[\w]+)/)?.[1];
    if (method !== "GET" || !entity) return undefined;
    const start = new Date(url.searchParams.get("start"));
    const end = new Date(url.searchParams.get("end"));
    const time = (t) => new Date(t.dateTime ?? `${t.date}T00:00`);
    // Like Home Assistant: every event that overlaps the range
    return events(entity).filter((e) => time(e.end) > start && time(e.start) < end);
  },
};
