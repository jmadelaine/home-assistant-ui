# Agenda

Your upcoming events, today onwards, as a list grouped by day. It reads
`calendar` entities in Home Assistant, such as your Google calendars.

## Setup: Google Calendar

1. In Home Assistant, go to **Settings → Devices & services → Add integration**
   and add **Google Calendar**. Follow its steps to sign in with your Google account.
2. Each of your Google calendars appears as an entity, e.g. `calendar.personal`.
3. List those entities in the card.

The card asks Home Assistant for the events, so it never signs in to Google
itself. Any other calendar in Home Assistant (Local Calendar, CalDAV, iCloud)
works the same way.

## Usage

```yaml
type: custom:agenda-card
entities:
  - calendar.personal
```

## Options

| Option       | Type   | Default  | Description                                                             |
| ------------ | ------ | -------- | ----------------------------------------------------------------------- |
| `entities`   | list   | required | Calendar entities to show. Each is an entity ID, or an `entity` with an optional `name` and `color`. |
| `name`       | string | none     | Title above the events.                                                 |
| `days`       | number | `14`     | How many days ahead to look, starting today.                            |
| `max_events` | number | `6`      | The most events to show.                                                |

## Behavior

- Events are grouped under **Today**, **Tomorrow**, then the date, e.g.
  **Wed, Oct 8 · in 3 days**. All-day events come first in each day.
- An event without a time is an all-day event.
- An event that's on now shows **Now** and when it ends. Events that have
  already finished today don't show.
- An event spanning several days shows once, on the day it starts (or today,
  if it's already started), with **until** and its last day.
- Locations show under the event's name. Tap an event to show its
  description; the arrow marks events that have one.
- With more than one calendar, a dot shows each event's calendar, and a legend
  names them. The first three calendars get distinct colors; any more are gray
  unless you give them a `color`.
- The card checks for new events every 5 minutes, whenever a calendar starts or
  ends an event, and just after midnight.

## Colors

The calendar dots use the shared theme's calendar colors. To change them, set
these in your Home Assistant theme, or give a calendar its own `color`:

| Theme variable     | Calendar | Default (light / dark)  |
| ------------------ | -------- | ----------------------- |
| `calendar-1-color` | first    | `#2a78d6` / `#3987e5`   |
| `calendar-2-color` | second   | `#eb6834` / `#d95926`   |
| `calendar-3-color` | third    | `#1baf7a` / `#199e70`   |

## Examples

### Personal and birthdays

```yaml
type: custom:agenda-card
name: Coming up
entities:
  - calendar.personal
  - entity: calendar.birthdays
    name: Birthdays
```

### This week only

```yaml
type: custom:agenda-card
entities:
  - calendar.personal
days: 7
max_events: 4
```
