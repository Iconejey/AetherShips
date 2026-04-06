setcpm(40);

const BASS = true;
const VIOLIN = true;
const MELODY = true;

// Bass
bass: note('<f1@4 g1@4 d1@4 bb1@4 d2@4>')
	// .sound('supersaw')
	.lpf(slider(1299.6, 300, 2000))
	.room(1)
	.attack(slider(0.266, 0, 1))
	.postgain(BASS ? 1 : 0);

// // Bass
// violin: note("<f4@4 g4@4 d4@4 bb4@4 d5@4>")
//   .sound('saw')
//   .lpf(slider(1907.4, 300, 5000))
//   .room(1)
//   .attack(slider(0.216, 0, 1))
//   .postgain(VIOLIN ? .6 : 0)

// casio: chord("<F Csus Dm Gm>").voicing().room(1)._pianoroll()
// casio: chord("<Dm F C Gm>").voicing().room(1)._pianoroll()
// casio: chord("<F@4 G@4 D@4 Bb@4 D@4>").sound("sine").voicing().room(1)._pianoroll()

// Melody
melody: note(
	'<0@4 1@2 2 3 4@4 5@4 6 7 6 6>'.pick(['{f5 a5 f5 c6}*2', '{d5 f5 a5 c6 d5 f5 a5 d6}', '{d5 f5 a5 f6 d5 f5 a5 f6}', '{d5 f5 a5 b5 d5 f5 a5 b5}', '{d5 f5 d5 a5}*2', '{bb4 d5 bb4 f5 bb4 d5 bb4 bb5}', '{e5 g5 e5 e6}', '{e5 g5 e5 g5}'])
)
	// .sound("gm_clavinet")
	// .sound("gm_dulcimer")
	// .sound("gm_electric_bass_finger")
	// .sound("gm_electric_guitar_clean")
	// .sound("gm_electric_guitar_muted")
	// .sound("gm_epiano1")
	// .sound("gm_epiano2")
	// .sound("gm_fretless_bass")
	// .sound("gm_fx_crystal")
	// .sound("vibraphone")
	// .sound("vibraphone_soft")
	// .sound("pulse")
	// .sound("saw")
	// .sound("sin")
	// .sound("sqr")
	// .sound("tri")
	// .sound("zzfx")
	// .sound("wt_digital")
	.attack(slider(0, 0, 1))
	.lpf(slider(5000, 300, 5000))
	.room(1)
	.postgain(MELODY ? 0.6 : 0);
