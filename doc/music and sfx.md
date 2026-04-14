# Music & SFX

> NOTE : The current implementation of music is using Strudel.js. This document describes the new solution that will replace it in the future.

A game without music and sound effects is like space without stars : it can work, but it's not as immersive and enjoyable.

## Audio window

To handle music and sound effects without blocking the main game thread, we use a hidden `BrowserWindow` with an `AudioContext`. A main bus, a music bus, and an sfx bus are created to manage the audio output. The main game communicates with this audio processor via IPC, allowing us to play tracks and sound effects on demand.

## Music (soundtrack)

There are a few music tracks in the `audio/music` folder. The game will play them in random order. The gain and a low pass filter are dynamically adjusted based on the game state (Clear and loud music on start screen and fast driving, more muffled and quieter music during mining or ship edition).

## Sound effects

Sound effects are stored in the `audio/sfx` folder. They are played on demand when the player interacts with the game (mining, building, taking damage, etc.). Always clear and loud.
