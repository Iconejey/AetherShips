// -- INTRO --
// C#m
// C#m
// E
// A
// F#m
// B

setcpm(20);

const intro_pad = note("<{[c#3, e3] ~} {[c#3, e3, g#3] ~} {[b2, e3, g#3] ~} {[a2, c#3, e3] ~} {[f#2, a2, c#3] ~ [b2, d#3, f#3] ~}>")
	.slow(2)
	.sound("gm_synth_strings_2")
	.transpose(12)
	.room(1).rsize(3)
	.lpf(800)
	.attack(2)
	.release("3.5")
	.postgain(0.5);

const intro_per = stack(
	s("bd:4").beat("0, 6, <15 ~>", 16).lpf(100).decay(0.1).sustain(0.1).postgain("<0@2 0.005@8>"),
	s("oh").beat("10", 16).attack(1).release(0.2).postgain("<0@1 1@9>"),
	s("rim:4").beat("4, 12", 16).postgain(0.2).postgain("<0@1 .1@9>"),
	s("hh:2").beat("0, 2, 8, 10, 14", 16).delay(0.01).postgain("<0@1 1@9>")
)
	.room(0.3).rsize(4)
	.lpf(800)
	.pan(sine)

const intro_magic = note("<~ ~ g#5*16 e5*16 {c#5*8 f#5*8}>")
	.transpose(12)
	.pan("[1 0]*8")
	.gain("1 .75 .50 .25")
	.room(1).rsize(4)
	.slow(2)
	.sound("gm_celesta:4")
	.lpf(5000)
	.postgain(0.3);

const intro = stack(intro_pad, intro_per, intro_magic);

// -- VERSE 1 --
// C#m
// E
// F#m
// AM7
// B
// EM7
// E

const verse1_bass = note("<{c#3 ~} {e3 ~} {f#3 ~} {a2 ~ b2 ~} {e3 ~}>")
    .slow(2)
    .sound("supersaw")
    .transpose(-24)
    .room(1).rsize(3)
    .lpf(200)
    .release("<4@6 2.5@4>");

const verse1_pad = note("<{[c#3, e3] ~} {[b2, e3, g#3] ~} {[c#3, f#3, a3] ~} {[a2, c#3, e3, g#3] ~ [b2, d#3, f#3] ~} {[g#2, b2, d#3, g#3] ~ [e3, g#3, b3] ~}>")
	.slow(2)
	.sound("gm_synth_strings_2")
	.transpose(12)
	.room(1)
	.size(3)
	.lpf(800)
	.attack(2)
	.release("<3.5@6 2.5@4>")
	.postgain(0.2);

const verse1_per = stack(
	s("bd:4").beat("0, 6, <15 ~>", 16).lpf(200).decay(0.1).sustain(0.1),
	s("oh").beat("10", 16).attack(1).release(0.2).postgain(0.5),
	s("rim:0").beat("4, 12", 16).room(0.2).rsize(1).postgain(0.5),
	s("hh:2").beat("0, 2, 8, 10, 14", 16).delay(0.01).postgain(0.5)
);

const verse1_mel = note("<0 1 2 3 4>".pick([
    "c#4 e4 d#4 f#4",
    "b3@2 g#4 [f#4 c#5]",
    "c#4@3 e4",
    "g#3@3 b3",
    "g#3 ~"
]))
	.sound("sine")
	.room(1)
	.slow(2)
	.decay(3)
	.postgain(0.5);

const verse1_woosh_wind = note("<~@9 c>")
    .sound("pink")
	.lpf(1000)
	.room(1).rsize(4)
	.attack(3)
	.release(0)
	.decay(0)
	.postgain(.5);

const verse1_woosh_pan = note("<~@9 g#4>")
    .sound("gm_synth_strings_2")
	.room(1).rsize(4)
	.lpf(800)
	.attack(3)
	.release(0)
	.decay(0)
	.postgain(.5);

const verse1 = stack(verse1_bass, verse1_pad, verse1_per, verse1_mel, verse1_woosh_wind, verse1_woosh_pan);

// -- PRE BRIDGE --
// C#m
// A
// E
// B
// A
// E
// A
// B
// A

const pre_bridge_bass = note("<{c#3 ~} {a2 ~} {e2 ~} ~ {b2 ~} {a2 ~} {e2 ~} {a2 ~} {b2 ~} {a2 ~} ~ ~>")
    .sound("supersaw")
    .room(1).rsize(3)
    .lpf(200)
    .release("<4@6 2.5@4>")
    .postgain(.8);

const pre_bridge_pad = note("<[c#3, e3, g#3] [a2, c#3, e3] [b2, e3, g#3] [c#3, e3, g#3] [b2, d#3, f#3] [a2, c#3, e3] [b2, e3, g#3] [a2, c#3, e3] [b2, d#3, f#3] [a2, c#3, e3] ~ ~>")
    .sound("gm_synth_strings_2")
    .transpose(12)
    .room(1).rsize(3)
    .lpf(900)
    .attack(.1)
    .release(.1)
    .postgain(0.1);

const pre_bridge_per = note("<0@10 ~@2>".pick([
	"~ ~ ~ c",
]))
  .s("rim:0")
  .room(1).rsize(4)
  .delay(.2).delaytime(0.1)
  .attack(.05)
  .decay(.2)
  .release(10)
  .postgain(0.1);

const pre_bridge_mel = note("<0 1 2 3 0 1 2 3 0 1 ~@2>".pick([
    "g#3 e4 g#3 b3",
    "c#4 c#4 e4 f#4",
    "g#4 g#4 f#4 e4",
    "e4 e4 f#4 g#4",
]))
    .sound("gm_contrabass")
    .lpf(900)
    .transpose(12)
    .room(1).rsize(1)
    .attack(.1)
    .sustain(.4)
    .decay(.1)
    .release(1)
    .postgain(1);

const pre_bridge_woosh_wind = note("<~@5 c>")
    .sound("pink")
    .slow(2)
	.lpf(1000)
	.room(1).rsize(4)
	.attack(7)
	.release(0)
	.decay(0)
	.postgain(.5);

const pre_bridge_woosh_magic = note("<~@11 g#5>")
    .sound("gm_celesta:4")
	.room(1).rsize(4)
	.attack(5)
	.release(0)
	.decay(0)
	.postgain(.7);

const pre_bridge = stack(
	pre_bridge_bass,
	pre_bridge_pad,
	pre_bridge_per,
	pre_bridge_mel,
	pre_bridge_woosh_wind,
	pre_bridge_woosh_magic,
);

// -- BRIDGE --
// C#m
// E
// A
// B
// EM7

const bridge_pad = note("<[c#3, e3, g#3] [b2, e3, g#3] [a2, c#3, e3] [b2, d#3, f#3]>")
    .sound("gm_synth_strings_2")
	.slow(2)
    .room(1).rsize(3)
    .lpf(600)
    .attack(.1)
    .release(.1)
    .postgain(0.2);

const bridge_echo = note("<0 1 2 ~ 0 3 ~ ~>".pick([
	"c#4",
	"d#4 f#4",
	"g#4",
	"d#4",
]))
	.sound("gm_celesta:4")
    .room(1).size(4)
    .lpf(1200)
    .sustain(.5)
    .release(.5);

const bridge_mel = note("<0 ~ 0 1 2 3 4 5>".pick([
	"c#4",
	"~ [f#4 c#4]",
	"e4",
	"d#4",
	"g#4 f#4",
	"e4 d#4",
]))
	.transpose(12)
	.sound("gm_celesta:4")
    .room(1).size(4)
    .lpf(1200)
    .sustain(.5)
    .release(1)
    .postgain(.5);

const bridge = stack(
	bridge_pad,
	bridge_echo,
	bridge_mel,
);

// -- VERSE 2 --
// C#m
// C#m
// E
// A
// B

const verse2_bass = note("<{c#3 ~} {c#3 ~} {e3 ~} {a3 ~ b3 ~} {c#3 ~} {c#3 ~} ~ ~>")
    .slow(2)
    .sound("supersaw")
    .transpose(-24)
    .room(1).rsize(3)
    .lpf(200)
    .release("<4@6 2.5@2 4@8>");

const verse2_pad = note("<{[c#3, e3] ~} {[c#3, e3, g#3] ~} {[b2, e3, g#3] ~} {[a2, c#3, e3] ~ [b2, d#3, f#3] ~}>")
	.slow(2)
	.sound("gm_synth_strings_2")
	.transpose(12)
	.room(1)
	.size(3)
	.lpf(800)
	.attack(2)
	.release("<3.5@6 2.5@2 3.5@6 2.5 6>")
	.postgain(0.2);

const verse2_per = stack(
	s("bd:4").beat("0, 6, <15 ~>", 16).lpf(200).decay(0.1).sustain(0.1),
	s("oh").beat("10", 16).attack(1).release(0.2).postgain(0.5),
	s("rim:0").beat("4, 12", 16).room(0.2).rsize(1).postgain(0.5),
	s("hh:2").beat("0, 2, 8, 10, 14", 16).delay(0.01).postgain(0.5)
);

const verse2_mel1 = note("<0 1 2 3 0 ~ 4 3>".pick([
    "c#4 ~",
    "g#4 [~ f#4]",
    "g#4 d#4",
    "c#4 [e4 d#4]",
    "~ d#4",
]))
	.sound("sine")
	.transpose(12)
	.room(1).rsize(4)
	.slow(2)
	.decay(3)
    .release("<.1@7 {.1 4}>")
	.postgain(0.2);

const verse2_mel2 = note("<~@5 0 ~ 1>".pick([
    "~ [~ [f#5 c#6]]",
    "~ [~ e5] b4 c#5",
]))
.sound("gm_celesta:4")
.transpose(12)
.room(1).rsize(4)
.slow(2)
.decay(3)
.release("<1@7 {1 4}>")
.postgain(.5);

const verse2_magic = note("<~@4 0 ~ 0@2>".pick([
    "c#5*16",
]))
	.transpose(12)
	.pan("[1 0]*8")
	.gain("1 .75 .50 .25")
	.room(1).rsize(4)
	.slow(2)
	.sound("gm_celesta:4")
	.lpf(5000)
	.postgain(0.5);

const verse2 = stack(
	verse2_bass,
	verse2_pad,
	verse2_per,
	verse2_mel1,
	verse2_mel2,
	verse2_magic,
);

arrange(
    [10, intro],
    [10, verse1],
    [12, pre_bridge],
    [8, bridge],
    [16, verse2],
    [2, note("~")]
);