# Management mode

This game mode allows the player to check and configure various aspects of their ship.

## Rectangle groups

A thruster block is not a thruster. It is a part that can be used to create a thruster. A thruster is defined as a group of thurster blocks arranged in a rectangle. Same goes for capacitors, weapons and other utility blocks.

Utility block types are distinguished using a `"utility": "rect"` or `"utility": "line"` string in `blocks.json`.

Entities (such as ships) have a group object that contains groups (arrays) of rectangle coordinates for utility block types.

When a utility block is added to or removed from an entity, the entity gets flagged for groups update. When user enters management mode, and the driven entity is flagged for groups update, the game runs a rectangle detection algorithm to find all valid rectangles of utility blocks and updates the entity's group object accordingly.

The following rules apply for rectangle validation :

- The rectangle must be at least 2 blocks wide and 2 blocks tall
- The rectangle must be fully filled with blocks of the same utility type (no holes or different block types allowed)
- The rectangle must not be in contact with another rectangle group (even with the same block type)

The old rectangles are compared to the new ones of the same type :

- If a new rectangle matches an old one (same coordinates), no update is needed
- If a new rectangle does not match any old one, it is added to the groups
- If an old rectangle does not match any new one, it is removed from the groups
- If a new rectangle overlaps with one or more old rectangles, the new rectangle's data is merged with the overlapping old rectangles' data, the old rectangles are removed from the groups, and the merged rectangle is added to the groups.

When the player enters management mode, these groups appear highlighted on the ship with icons and color coding to indicate their type.

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

Connectors and racks are not grouped in rectangles. Instead, they are grouped in 1-block wide lines. A line group is defined as an optimized array of node coordinates (we skip intermediate nodes in straight lines).

For example, connector blocks in `(0, 0)`, `(0, 1)`, `(0, 2)`, `(1, 2)`, `(2, 2)` are defined as the following array of nodes :

```js
[
	{ x: 0, y: 0 },
	{ x: 0, y: 2 },
	{ x: 2, y: 2 }
];
```

Unlike rectangle groups, line groups are memory-less constructs in the codebase. They don't carry logic values or data attributes between updates. Instead, they are used for their gragh structure and connectivity properties.

When the player enters management mode, these line groups appear highlighted with circles on nodes and lines connecting them. The circles are color coded to indicate the type of line group (connector or rack).

### Connectors

Connectors act as links between rectangle groups in the game logic. After a connector line group update, we traverse the node coordinates to find all connected rectangle groups. Every rect group will have the list of target IDs of the rect groups it is connected to via connectors.

### Racks

Racks are used to connect other entities to the current one. We'll handle this later.

## Antennas

We don't know how antennas will work yet. Rectangle, line, count, ray-tracing... Still to be determined.
