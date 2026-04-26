# Construction Module

## Edition Mode

To edit ships or stations, the player has two options :

- Adding and removing blocks by hand, with a limited range.
- Using the edition mode while driving the ship, which allows for more freedom and precision.

To use edition mode, a ship to have a **construction module**. The size of the construction module determines the radius from which the player can use edition mode within the ship. The player can have multiple construction modules on the same ship, and their ranges will stack.

If a ship is docked on a rack that is connected to a construction module, the player can also use edition mode on that ship, with the range being calculated from the rack instead of the construction module.

The construction module also needs energy and materials to function, so it needs to be connected to at least one **capacitor** and one **material container**.

> **NOTE :** In a creative galaxy, the player can use the edition mode to build ships and stations without needing a construction module any range limitations and with access to all blocks.

## Automatic Construction & Repair

The construction module can also use a **blueprint** to add blocks automatically in two modes :

- **Self :** The construction module will add blocks to the ship it is on, as long as they are within its range. This mode is useful for repairing the ship while flying.

- **Target :** The construction module will add blocks to ships that are docked on a rack that is connected to the construction module. The range will be calculated from the rack instead of the construction module. This mode is useful for building new ships or repairing docked ships. If no ship is docked, the construction module will create a new ship and build it from there.

The automatic construction requires an event to be triggered, either by the player or by an automation system.
