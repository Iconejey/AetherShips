# Obtaining Blocks

Block types are listed in [blocks.md](blocks.md), but here we list how they can be obtained by the player.

The different ways include :

- Mining raw resources from planets, asteroids and wrecks
- Refining raw resources into refined materials and components
- Crafting
- Farming
- Trading with NPC stations (available for every block, so we won't mention it in the list)

## Mining

This is the main way to obtain raw resources from planets, asteroids and wrecks. The player can harvest some blocks by hand, but for most blocks they will need to use a mining drill on a ship.

In games, biomes usually refer to the types of terrain found on a zone in the map. In Aetherships, biomes are the types of planets and asteroids you can find. A biome determines the appearance and the resources it contains.

Some biomes are more common than others, some can be for planets only, asteroids only, or both. The player can find biomes with different frequencies in different regions of the galaxy, with some biomes being more common in certain regions.

### Resources by biome

| Resource     | Plant     | Arid      | Ice       | Tectonic | Crystal   | Radioactive |
| ------------ | --------- | --------- | --------- | -------- | --------- | ----------- |
| Vegetation   | Exclusive | -         | -         | -        | -         | -           |
| Dirt         | Abundant  | Present   | -         | Rare     | -         | -           |
| Sand         | -         | Exclusive | -         | -        | -         | -           |
| Iron         | Primary   | Rare      | -         | Present  | -         | -           |
| Coal         | Exclusive | -         | -         | -        | -         | -           |
| Copper       | -         | Primary   | -         | Present  | -         | -           |
| Lead         | -         | Primary   | -         | -        | Present   | -           |
| Ice          | -         | -         | Exclusive | -        | -         | -           |
| Titanium     | -         | -         | Rare      | Rare     | -         | -           |
| Crystals     | -         | -         | Rare      | -        | Abundant  | -           |
| Uranium      | -         | -         | -         | Rare     | -         | Abundant    |
| **Location** | Planets   | Both      | Both      | Planets  | Asteroids | Asteroids   |

_Rock can be found in all biomes._

### Regions

Some biomes are more common in certain regions of the galaxy, so the player can choose to explore those regions if they are looking for specific resources :

| Biome       | Planets     | Asteroids  |
| ----------- | ----------- | ---------- |
| Plant       | Middle ring | -          |
| Arid        | Middle ring | Everywhere |
| Ice         | Outer ring  | Everywhere |
| Tectonic    | Inner ring  | -          |
| Crystal     | -           | Outer ring |
| Radioactive | -           | Inner ring |

### Wrecks

Wrecks are the remains of destroyed ships. They spawn randomly in the outer ring of the galaxy, and can be mined for resources. They have the advantage of being made of blocks that are not found on planets or asteroids and that would require lots of crafting, refining and trading to obtain otherwise.

### Drilling

The player can use a mining drill on a ship to mine blocks from planets, asteroids and wrecks. Not all blocks can be mined with all drills. Some blocks require higher tier drills to be mined.

Drills can be tier 1, 2 or 3, and we consider tier 0 to be mined by hand :

| Block type   | Drill tier required |
| ------------ | ------------------- |
| Rock         | 1                   |
| Iron Ore     | 1                   |
| Copper Ore   | 1                   |
| Titanium Ore | 2                   |
| Lead Ore     | 2                   |
| Uranium Ore  | 3                   |
| Coal         | 1                   |
| Sand         | 0                   |
| Raw Crystal  | 2                   |
| Dirt         | 0                   |
| Vegetation   | 0                   |
| Ice          | 0                   |

Non-raw blocks all require a tier 3 drill to be mined, unless they are part of a player-built structure, in which case they can be mined by hand.

# Refining

Refining is the process of transforming raw resources into refined materials. The player can refine blocks using a refinery on a ship, as long as it is connected to at least a source of energy and a container for input and output materials :

## Material refinery

| Block type       | Energy | Water | Materials               |
| ---------------- | ------ | ----- | ----------------------- |
| 1 Silicon        | 1      | 1     | 1 Sand + 1 Rock         |
| 1 Glass          | 1      | 2     | 4 Sand                  |
| 1 Iron Ingot     | 2      | 3     | 4 Iron Ore              |
| 1 Copper Ingot   | 2      | 3     | 4 Copper Ore            |
| 1 Titanium Ingot | 2      | 4     | 4 Titanium Ore          |
| 1 Carbon         | 2      | 4     | 4 Coal                  |
| 1 Steel          | 3      | 4     | 2 Iron Ingot + 1 Carbon |
| 1 Cut Crystal    | 4      | 4     | 4 Raw Crystal           |

## Bio-refinery

| Block type    | Energy | Water | Materials     |
| ------------- | ------ | ----- | ------------- |
| 1 Coal        | 1      | 1     | 8 Vegetation  |
| 1 Bio-Plastic | 1      | 2     | 16 Vegetation |

_Refineries can also be used to produce water, bio-fuel and refined uranium which are NOT blocks, but resources that can be stored in containers._

# Crafting

Crafting is the process of combining blocks to create new blocks. The player can craft blocks using a crafting station on a ship :

| Block type                       | Tier | Energy        | Materials                                                                                                                      |
| -------------------------------- | ---- | ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Copper Wire                      | 1    | 1             | 1 Copper Ingot                                                                                                                 |
| Electronic Component             | 1    | 4             | 2 Copper Wire + 1 Silicon                                                                                                      |
| Processor                        | 2    | 8             | 2 Electronic Component + 2 Cut Crystal + 2 Bio-Plastic                                                                         |
| Lead Plate                       | 1    | 4             | 2 Lead Ingot                                                                                                                   |
| Iron Hull                        | 1    | 1             | 4 Iron Ingot                                                                                                                   |
| Steel Hull                       | 2    | 2             | 1 Iron Hull + 4 Steel                                                                                                          |
| Titanium Hull                    | 3    | 3             | 2 Steel Hull + 4 Titanium Ingot                                                                                                |
| Alloy Hull                       | 4    | 4             | 2 Titanium Hull + 2 Steel + 2 Titanium Ingot + 2 Carbon                                                                        |
| Glass Window                     | 1    | 1             | 2 Glass + 1 Iron Hull                                                                                                          |
| Lamp                             | 1    | 1             | 2 Glass + 1 Electronic Component                                                                                               |
| Radiation Shield                 | 2    | 2             | 2 Lead Plate + 1 Cut Crystal                                                                                                   |
| Door                             | 1    | 1             | 2 Iron Ingot + 1 Electronic Component                                                                                          |
| Control Panel                    | 2    | 4             | 2 Electronic Component + 1 Processor + 2 Bio-Plastic                                                                           |
| Solar Panel - Tier 1             | 1    | 2             | 4 Silicon + 2 Glass + 1 Electronic Component + 1 Cut Crystal                                                                   |
| Solar Panel - Tier 2             | 2    | 4             | 3 Solar Panel Tier 1 + 2 Cut Crystal + 2 Electronic Component                                                                  |
| Solar Panel - Tier 3             | 3    | 8             | 3 Solar Panel Tier 2 + 4 Cut Crystal + 4 Electronic Component                                                                  |
| Solar Panel - Tier 4             | 4    | 16            | 3 Solar Panel Tier 3 + 8 Cut Crystal + 8 Electronic Component                                                                  |
| Basic Capacitor                  | 1    | 2             | 2 Copper Wire + 4 lead Plate + 2 Bio-Plastic                                                                                   |
| High-Density Capacitor           | 2    | 4             | 3 Basic Capacitor + 4 Lead Plate + 2 Cut Crystal + 1 Titanium Ingot                                                            |
| Material Refinery                | 2    | 8             | 4 Steel + 4 Glass + 2 Electronic Component + 2 Cut Crystal                                                                     |
| Bio-Refinery                     | 2    | 8             | 1 Material Refinery + 4 Bio-Plastic + 2 Carbon + 2 Silicon                                                                     |
| Uranium Refinery                 | 3    | 16            | 2 Material Refinery + 4 Lead Plate + 4 Cut Crystal + 2 Processor + 2 Titanium Ingot                                            |
| Crafting Station - Tier 1        | 1    | 4             | 4 Steel + 4 Glass + 2 Electronic Component + 2 Cut Crystal                                                                     |
| Crafting Station - Tier 2        | 2    | 8             | 3 Crafting Station Tier 1 + 4 Steel + 4 Bio-Plastic                                                                            |
| Crafting Station - Tier 3        | 3    | 16            | 3 Crafting Station Tier 2 + 4 Alloy Hull + 2 Carbon + 1 Processor                                                              |
| Bio-Fuel Electric Generator      | 2    | 8             | 4 Iron Ingot + 4 Bio-Plastic + 1 Electronic Component + 16 Copper Wire                                                         |
| Uranium Electric Generator       | 3    | 16            | 4 Iron Ingot + 4 Lead Plate + 2 Processor + 2 Cut Crystal + 2 Bio-Plastic + 16 Copper Wire                                     |
| Greenhouse                       | 2    | 8             | 4 Glass Window + 4 Steel + 2 Lamp + 2 Electronic Component + 2 Bio-Plastic                                                     |
| Electric Thruster                | 1    | 4             | 4 Steel + 2 Electronic Component + 4 Carbon + 2 Bio-Plastic                                                                    |
| Bio-Fuel Thruster                | 1    | 4             | 4 Steel + 1 Electronic Component + 1 Carbon                                                                                    |
| Uranium Thruster                 | 3    | 8             | 4 Alloy Hull + 2 Electric Thruster + 2 Processor + 4 Lead Plate                                                                |
| Warp Drive                       | 3    | 16            | 4 Alloy Hull + 1 Processor + 4 Uranium Ingot + 4 Lead Plate + 4 Cut Crystal + 4 Bio-Plastic + 16 Copper Wire                   |
| Warp Gate                        | 4    | 32            | 1 Warp Drive + 4 Alloy Hull + 1 processor                                                                                      |
| Drill - Tier 1                   | 1    | 4             | 4 Steel + 4 Carbon + 2 Electronic Component                                                                                    |
| Drill - Tier 2                   | 2    | 8             | 3 Drill Tier 1 + 4 Titanium Ingot + 4 Bio-Plastic                                                                              |
| Drill - Tier 3                   | 3    | 16            | 3 Drill Tier 2 + 4 Alloy Hull + 1 Processor + 4 Cut Crystal + 4 Lead Plate                                                     |
| Cannon - Tier 1                  | 1    | 4             | 4 Steel + 2 Electronic Component + 4 Carbon                                                                                    |
| Cannon - Tier 2                  | 2    | 8             | 3 Cannon Tier 1 + 4 Alloy Hull + 1 Processor + 4 Carbon                                                                        |
| Cannon - Tier 3                  | 3    | 16            | 3 Cannon Tier 2 + 4 Alloy Hull + 1 Processor + 4 Cut Crystal                                                                   |
| Cannon - Tier 4                  | 3    | 32            | 3 Cannon Tier 3 + 4 Alloy Hull + 1 Processor + 4 Uranium Ingot + 4 Lead Plate + 4 Cut Crystal + 4 Bio-Plastic + 16 Copper Wire |
| Explosive Charge - Tier 1        | 1    | 2             | 2 Steel + 2 Carbon                                                                                                             |
| Explosive Charge - Tier 2        | 2    | 4             | 3 Explosive Charge Tier 1 + 2 Bio-Plastic                                                                                      |
| Explosive Charge - Tier 3        | 3    | 8 + 1 uranium | 3 Explosive Charge Tier 2 + 1 Processor + 2 Cut Crystal                                                                        |
| Missile Launcher - Tier 1        | 1    | 4             | 4 Steel + 2 Electronic Component + 2 Carbon                                                                                    |
| Missile Launcher - Tier 2        | 2    | 8             | 3 Missile Launcher Tier 1 + 4 Alloy Hull + 1 Processor                                                                         |
| Missile Launcher - Tier 3        | 3    | 16            | 3 Missile Launcher Tier 2 + 4 Alloy Hull + 1 Processor + 4 Cut Crystal                                                         |
| Guided Missile Launcher - Tier 1 | 2    | 8             | 1 Missile Launcher Tier 1 + 2 Processor + 2 Electronic Component                                                               |
| Guided Missile Launcher - Tier 2 | 3    | 16            | 3 Guided Missile Launcher Tier 1 + 4 Alloy Hull + 2 Processor                                                                  |
| Guided Missile Launcher - Tier 3 | 4    | 32            | 3 Guided Missile Launcher Tier 2 + 4 Alloy Hull + 2 Processor + 4 Uranium Ingot                                                |
| Flare Launcher                   | 1    | 2             | 2 Steel + 1 Electronic Component + 2 Carbon                                                                                    |
| Material Container               | 1    | 2             | 4 Iron Hull + 2 Steel                                                                                                          |
| Water Tank                       | 1    | 2             | 4 Iron Hull + 2 Glass                                                                                                          |
| Bio-Fuel Tank                    | 1    | 2             | 4 Iron Hull + 2 Glass + 2 Bio-Plastic                                                                                          |
| Uranium Container                | 2    | 4             | 4 Bio-Fuel Tank + 4 Lead Plate + 2 Processor                                                                                   |
| Connector                        | 1    | 1             | 2 Steel + 1 Electronic Component                                                                                               |
| Rack                             | 1    | 1             | 2 Steel + 2 Iron Ingot + 2 Electronic Component                                                                                |
| Construction Module              | 2    | 8             | 4 Steel Hull + 2 Processor + 4 Electronic Component + 4 Glass Window                                                           |
| Drone Computer                   | 2    | 8             | 16 Processor + 4 Electronic Component + 4 Bio-Plastic                                                                          |
| Radar                            | 2    | 4             | 4 Steel + 4 Electronic Component + 2 Cut Crystal + 4 Copper Wire                                                               |
| Antenna                          | 1    | 2             | 2 Steel + 2 Electronic Component + 8 Copper Wire                                                                               |
