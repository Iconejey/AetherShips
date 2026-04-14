# Inspect mode

This game mode allows the player to check and configure various aspects of their ship.

## Rectangle groups

A thruster block is not a thruster. It is a part that can be used to create a thruster. A thruster is defined as a group of thurster blocks arranged in a rectangle. Same goes for capacitors, weapons and other utility blocks.

Entities (such as ships) have a group object that contains groups (arrays) of rectangle coordinates for utility block types.

When user places blocks of a utility type (e.g. thrusters, capacitors, weapons) in a rectangular shape in editor mode, the game automatically detects and adds the rectangle coordinates to the corresponding group.

When the player enters inspect mode, these groups appear highlighted on the ship with icons and color coding to indicate their type.

When the player hovers over a group, a tooltip appears with various information and controls :

### Solar Panels

- **Mass** (info) - The total mass
- **Sunlight** (info) - The percentage of sunlight received
- **Generation** (info) - The current and max electricity generated per second

### Capacitors

- **Mass** (info) - The total mass
- **Capacity** (info) - The current, max and percentage of energy stored

### Refineries

- **Mass** (info) - The total mass
- **Rate** (info) - The number of raw materials processed per second
- **Consumption** (info) - The total electricity consumed per second

### Electric Generators

- **Mass** (info) - The total mass
- **Generation** (info) - The current and max electricity generated per second
- **Consumption** (info) - The Bio-fuel or Uranium consumed per minute

### Greenhouse

- **Mass** (info) - The total mass
- **Sunlight** (info) - The percentage of sunlight received
- **Rate** (info) - The current and max vegetation blocks produced per hour

### Thrusters

- **Mass** (info) - The total mass
- **Power** (info) - The total power
- **Consumption** (info) - The total energy consumed per second at full power (Electricity, Biofuel and/or Uranium)
- **Direction** (control) - An arrow indicating where the thruster points at

### Warp Drive & Warp Gate

- **Mass** (info) - The total mass
- **Range** (info) - The maximum distance the ship can warp to
- **Consumption** (info) - The total energy consumed per sector traveled

### Cannons

- **Mass** (info) - The total mass
- **Damage** (info) - The damage dealt per shot
- **Rate** (info) - The number of shots fired per second
- **Range** (info) - The maximum range
- **Consumption** (info) - The total energy consumed per shot
- **Direction** (control) - An arrow indicating where the cannon points at

### Missile Launchers & Guided Missile Launchers

- **Mass** (info) - The total mass
- **Damage** (info) - The damage dealt per missile at max power
- **Rate** (info) - The number of missiles fired per second at max power
- **Range** (info) - The maximum range
- **Consumption** (info) - The total energy consumed per missile
- **Direction** (control) - An arrow indicating where the missile launcher points at

### Flare Launchers

- **Mass** (info) - The total mass
- **Rate** (info) - The number of flares fired per second
- **Range** (info) - The maximum range
- **Consumption** (info) - The total energy consumed per flare
- **Direction** (control) - An arrow indicating where the flare launcher points at

### Containers

- **Mass** (info) - The total mass
- **Capacity** (info) - The current and max amount of materials stored

### Radars

- **Mass** (info) - The total mass
- **Range** (info) - The maximum range of detection
- **Consumption** (info) - The total energy consumed per second
- **Toggle** (control) - A button to turn the radar on or off

## Line groups

Pipes and racks are not grouped in rectangles. Instead, they are grouped in 2-block wide lines. A conveyor or rack line group is defined as the array of coordinates where the line starts, bends, and ends.

When the player enters inspect mode, these line groups appear highlighted on the ship with icons and color coding to indicate their type.

## Antennas

We don't know how antennas will work yet. Rectangle, line, count, ray-tracing... Still to be determined.
