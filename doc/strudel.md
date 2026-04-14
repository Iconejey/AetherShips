# Strudel

> IMPORTANT : This feature has been implemented and is functional, but not the best sounding. It will soon be replaced (disabled but not removed) by ogg/wav files for better sound quality.

This project uses Strudel.js, a JavaScript library created for music live coding. We will use this library for the background music in the game as it allows :

- **Ultra-light-weight** : The library itself is not heavy and the music is just a few Kbs of code using a few lazy-loaded samples (noting that mathematical sounds like sine waves litterally take no space at all). Compared to .wav or .mp3 files, this is a factor of 10x to 100x smaller (bye bye Gbs of music files !).

- **Dynamic** : The music can be changed on the fly, allowing for dynamic soundtracks that can adapt to the player's actions or the game's state. Loading screen will have a heavy bass because why not, normal gameplay will have a more chill vibe, and combat will have a more intense soundtrack.

- **Loops** : Strudel.js is designed for live coding and looping, which means that the music can seamlessly repeat without any noticeable gaps or breaks.

- **I'm not a musician** : Apart from a MIDI keyboard and some basic music theory, I don't have all the skills and tools to create professional music. Strudel.js allows me to put some chords and melodies together with instruments and effects and get a decent soundtrack.

## Soundtracks

Soundtrack codes are stored in the `js/strudel` folder with a `.strudel.js` extension. We have one full soundtrack and a draft at the moment.

## Implementation

We refer to [The CodeBerg repo](https://codeberg.org/uzu/strudel) and [NPM page](https://www.npmjs.com/org/strudel) for the Strudel.js integration.

To avoid blocking the main game thread while fully supporting the WebAudio API and DOM requirements of Strudel, we load the Strudel engine in a **hidden `BrowserWindow`** (`hidden-audio.html`). The main game dynamically communicates with this background audio processor via IPC (`window.audio.playTrack()`).

This setup evaluates standard `.strudel.js` scripts natively, meaning you can copy-paste code directly from the Strudel Web REPL without any modifications!
