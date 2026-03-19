# Coordinates and Scale

When the game scale is 1, blocks are 1 px wide on the screen (user will usually play in scale 5-10). Even though blocks and chunks are only part of entities' structure and not position (which is a floating number), we use them as a metric for coordinates. So moving an entity's `x` or `y` coord by 10 means moving 10 blocks and do moving 10 px on the screen for a game scale of 1.

The game coords are based on the Galaxy. Sectors are 256 chunks wide, and the Galaxy is 32 sectors chunks wide. That means the Galaxy is :

32 × 256 × 32 = 262 144 blocks wide.

The center of the Galaxy is (0, 0).

## Terminal

The terminal shows the player the current sector and their position in the sector. That means :

- The sector is \[x / 1024, y / 1024]
- The position is (x % 1024, y % 1024)