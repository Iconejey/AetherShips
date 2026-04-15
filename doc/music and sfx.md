# Music & SFX

A game without music and sound effects is like space without stars : it can work, but it's not as immersive and enjoyable.

## Audio window

To handle music and sound effects without blocking the main game thread, we use a hidden `BrowserWindow` with an `AudioContext`. A main bus, a music bus, and an sfx bus are created to manage the audio output. The main game communicates with this audio processor via IPC, allowing us to play tracks and sound effects on demand.

## Music (soundtrack)

There are a few music tracks in the `audio/music` folder. The game will play them in random order handled by the audio window (no need for main window to play them. May change later).

The gain and a low pass filter are dynamically adjusted based on the game state using `Game.muffle` (1-100%) with 0 being clear and 100 being fully muffled. The currently defined situations are :

- **On start screen :** 0 (clear)
- **In game :** Inversely proportional to the speed of the driven ship (100% muffled when stationary, 0% muffled at max speed)

## Sound effects

> **Note :** No SFX yet. Will be added in the future.

Sound effects are stored in the `audio/sfx` folder. They are played on demand when the player interacts with the game (mining, building, taking damage, etc.) using `Game.sfx(file_name)` (IPC). No gain or filter adjustments are applied to sound effects for now.
