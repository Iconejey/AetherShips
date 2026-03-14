# Thing

## Galaxy and Sectors

The game takes place in a galaxy divided into a 32x32 grid of sectors (1024 total). Each sector can contain a star system, these being procedurally distributed in a spiral pattern on the grid with greater density at the center. Each star system contains a star and a random number of planets.

## Sector stars

Stars are simple glowing circles with a fixed position at the center of their sector. They are a source of solar energy, which can be collected using solar panels. Approaching a star too closely will cause damage to the ship due to the intense heat, while being too far away will reduce the efficiency of solar panels.

## Entities

Entities are physical objects that exist in the game world and can interact with the player. They have a free position (incuding rotation) but their strucure consists of blocks arranged in three grids acting as layers:

0. Floor, background
1. Walls, interactables (where user moves)
2. Exterior, top.

Some of them are static, such as planets, but most of them have a velocity and can move around. To prevent infinite movement, a slight friction is applied to all entities, causing them to eventually come to a stop if not acted upon by external forces.

## Planets

Planets are entities that contain large amounts of exhaustible, localized, and not very diverse resources. To make things easier, there is no gravity or orbital mechanics in the game, so planets are static and can't be moved by the player.

They are procedurally generated with a random position around their star and a defined type. The type determines the planet's appearance and the resources it contains. The player can mine planets for resources, but once a planet is depleted, it will not regenerate.

The player can also build structures on planets, such as mining stations or factories, to automate resource extraction and processing.

## Asteroids

Asteroids are entities that spawn randomly in sectors. They are smaller than planets and contain fewer resources, but they can be found in any sector, including those without a star. They can also be mined for resources, knowing that they will despawn after a certain time and others will spawn to replace them.

Asteroids can be moved by physical interactions, such as collisions with the player's ship or other entities. They can also be pushed using thrusters or other means of propulsion, allowing the player to change their position or even capture them for mining.

The player can also build structures on asteroids, but at the risk of losing them if the asteroid despawns.

## Ships and stations

Ships and stations are entities that can be built and controlled by the player, or encountered as NPCs. They can move and are used for exploration, combat, and resource gathering.

To move, ships and stations use thrusters that apply force in a specific direction. To allow a ship to turn, thrusters must be placed asymmetrically, so that when they are activated, they create a torque that rotates the ship.

NPC stations are saved in the sector data and won't despawn, while NPC ships are procedurally generated and can spawn and despawn like asteroids.

Abandoned NPC ships also spawn randomly in sectors and can be salvaged for resources and parts, just like asteroids but are rare and heavily damaged.

## Player

The player is a special entity that represents the user's presence in the game world. They can walk around on foot in entities' layer 1 (walls / interactables) or move slowly in space using their suit. They can break and place blocks to mine or build structures. They can also pilot their ships and stations.
