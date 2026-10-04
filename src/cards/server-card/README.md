# Server

CPU, RAM and SSD use on one card: the current readings at the top, and a chart
of the last hour underneath. It reads the percent-used sensors from Home
Assistant's **System Monitor** integration, and works out RAM and storage in
GB from the sizes you give it.

## Usage

```yaml
type: custom:server-card
memory_size: 8
disk_size: 256
```

## Options

| Option          | Type   | Default                                | Description                                              |
| --------------- | ------ | -------------------------------------- | -------------------------------------------------------- |
| `name`          | string | none                                   | Title above the readings.                                |
| `cpu_entity`    | string | `sensor.system_monitor_processor_use`  | Sensor for CPU use, in percent.                          |
| `memory_entity` | string | `sensor.system_monitor_memory_usage`   | Sensor for RAM use, in percent.                          |
| `disk_entity`   | string | `sensor.system_monitor_disk_usage`     | Sensor for storage use, in percent.                      |
| `memory_size`   | number | none                                   | Total RAM in GB. Without it, RAM shows as a percent.     |
| `disk_size`     | number | none                                   | Total storage in GB. Without it, storage shows as a percent. |
| `minutes`       | number | `60`                                   | How many minutes the chart covers, e.g. `1440` for a day. |
| `interval`      | number | `10`                                   | How often the sensors report, in seconds: 10, 20, 30… Match System Monitor's update interval. |

## Behavior

- RAM and storage show the amount used, e.g. **3.2 GB of 8 GB**. Under 10 they
  show one decimal place; from 1000 GB they show in TB.
- All three lines share one scale: percent of capacity, from 0% at the bottom
  to 100% at the top. So a line's height always means how full it is.
- A line is the accent color up to 60% full, and turns to the danger color by
  90%. Any part of a line that gets close to its limit turns red, and so do its
  reading's key and the dot at its end.
- CPU is a solid line, RAM dashed and storage dotted; the readings at the top
  show which is which.
- Each point on a line is one reading, `interval` seconds apart. Over long
  periods, readings are averaged so a line has at most 360 points (an hour of
  10-second readings).
- The chart moves on every `interval`, even when no reading changes (Home
  Assistant only records a reading when it changes).
- Hover over the chart, or drag a finger across it, to see the values at that time.
- The history comes from Home Assistant when the card loads, and again every
  30 minutes. New readings are added as they arrive.

## Examples

### Different sensors, over a day

```yaml
type: custom:server-card
name: NAS
cpu_entity: sensor.nas_cpu_use
memory_entity: sensor.nas_memory_use
disk_entity: sensor.nas_volume_use
memory_size: 16
disk_size: 4000
minutes: 1440
interval: 30
```
