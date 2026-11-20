# Treatment — "THE HONESTY LAYER"

Style: **Sci-fi Hologram HUD** (Lemo-Opuscar), re-composed for a portrait frame. 1080×1920, 30 fps (brief overrides the style's 24), exactly 45.0 s.
Original concept, not a real product. English voice-over (Kokoro, calm warm male), burned-in HUD subtitles plus `.srt`.

## Brief adaptations to the style
- **Colours.** Cyan `#5FE6FF` carries every line, mesh and plate (the style's single cold hue). The style's single warm accent is split, as the brief asks, into **amber `#FFB547` = intent mismatch** and **soft green `#7CF2B0` = aligned**. Both still follow the style rule: they appear only on a value at the frame it locks (and on the meters that represent those values). No red anywhere.
- **Subjects.** The style's "object on a projector pad" becomes faces scanned into wireframe meshes. The pad survives as the lens's own target reticle under each scanned face. The three depth layers stay: a dot grid behind, the mesh, then the HUD and the lens frame in front.
- **The lens.** The whole film is POV through a glasses lens: curved bezel corners, edge vignette, a slight barrel bow on the frame lines, a 1–2 px red/blue chromatic fringe at the lens edges, and boot flickers.
- **Safe zones.** All key text and faces sit between y 250 and y 1500. Nothing important goes in the bottom 420 px or the right 140 px. Subtitles: dark HUD plate centred at y≈1350, at most 2 lines.

## 1. Three candidate structures
1. **Brief order, one continuous POV** (boot → café → readout → city → reflection → power-down). The scan plane is the only transition, and the camera never "cuts": it pulls back through the lens glass and then turns.
2. **Reflection first**: open on your own face, then reveal the world. This gives away the twist.
3. **Loop screen**: the glasses cycling faces with no story. Too cold for the idea.

**Chosen: 1.** The brief's beats already form setup → scale → turn. Inside the style's no-cut rule, transitions are made from the medium: the readout panel's glass becomes the window the camera pulls back through, and a scan-plane erase turns the street into the reflection.

## 2. Logline and arc
*Glasses that read every hidden expression make a whole city honest. The last face they learn to read is the wearer's own.*
Setup: boot, and one stranger's lie read in a fraction of a second. Scale: a city drifting from 41 % to 87 %. Turn: the wearer's reflection; the brackets hesitate, then lock, and 100 % lands green. Ending: power-down to one line, the title, and a question.

## 3. Benchmark
Film HUD language (layered target boxes, hairline callouts, values computed on screen) and medical face-tracking overlays.
- **Learn:** one colour plus hairlines and lots of space; boxes that snap; numbers that are earned.
- **Don't take:** any franchise HUD layout, icons, fonts or colours; lie-detector or interrogation clichés (no red, no alarms, no "DECEPTION DETECTED").

## 4. Shot list (one continuous POV; t in s)
| # | Time | Picture | Camera | Why |
|---|---|---|---|---|
| 1 | 0.0–4.0 | Black → lens bezel flickers on → dot grid → glyph roll "HONESTY LAYER v1.0 · ONLINE" | static | Hook: the device wakes; the title value rolls |
| 2 | 4.0–13.0 | Café: table edge and cup in wireframe foreground; the man's head scans in top-down as a mesh; brackets lock on brow, eyelids, lip corners, nostrils, pupils; three callouts roll: LIP PRESS 0.18s, BROW FLASH 0.21s, PUPIL +14% | slow push-in, then drift | Close examination; the scan plane reads as real data |
| 3 | 13.0–21.0 | A readout panel slides up below the face: WORDS (his line) ↔ INTENT (micro-signals), with the bar meeting at MATCH 38 % in amber; callouts dock in a rail | nearly static, slow dolly | Reading time: what was said vs. what the face means |
| 4 | 21.0–31.0 | Pull back through the panel glass: the café shrinks into one window of a wireframe night street. 200+ small heads, each with a tiny meter. SOCIETY BASELINE rolls 41 → 63 → 87 %; the meters drift from amber to green | pull back, then lateral dolly down the street | Scale: the habit spreads |
| 5 | 31.0–40.0 | Scan-plane wipe: the street becomes a shop window; the wearer's own reflected face (slightly mirrored, with the glasses visible) scans in. Brackets oversize, hesitate (a 3-frame glitch, used once), then lock. SELF-ALIGNMENT climbs to 100 % in green | eye-level, locked, slow push | The turn: the device reads you |
| 6 | 40.0–45.0 | HUD panels switch off one by one → a single cyan line → the title rolls "THE HONESTY LAYER" → "An idea from My designed dream world" → "Follow for more futures" | static | Power-down ending (style §11) |

## 5. Beat sheet (VO, Kokoro `am_michael`; numbers spelled out for TTS, digits in subtitles)
- 0.6 "In 2035, nobody can lie to you."
- 4.6 the man's line appears (subtitle only, in a speech plate placed near his mouth): "Trust me, the deal is fair."
- 7.2 "Your glasses read the tiny expressions that last less than half a second."
- 13.6 "What someone says, and what their face means, side by side."
- 21.6 "When everyone can see the truth, lying stops being worth it."
- 26.6 "Not by force. Slowly. By habit."
- 32.4 "But the first face it learns to read is yours."
- 41.8 "Would you wear them?"

## 6. Cue map
**Score:** 100 BPM (one bar = 2.4 s), D minor/Dorian ambient. Detuned saw pad throughout, scooped 1–4 kHz.
- 0–4: a single sustained tone and boot blips in key.
- 4–21: pad plus a sparse arpeggio (ping-pong delay) at low level. Locks land on beats.
- 21–31: a low pulse enters (8th-note bass + kick) and builds, adding hats at 25.8 and a second arp layer at 28.2.
- **31.0: the pulse drops out** (the brief's drop-out). Two beats of true silence (31.0–31.6), then only the pad and a single sustained tone under the reflection.
- 37.6: the SELF-ALIGNMENT lock is a wide chord bloom (the style's "drop" used once, softly).
- 40–45: chord holds, then a power-down tone sweeps down at 40.2. Final glyph chatter on the title, fade to silence.

## 7. Sound design table
| Section | Ambience | Foley | Music |
|---|---|---|---|
| Boot | lens hum 40/80/120 Hz | boot blips, glyph chatter | sustained tone |
| Café | café murmur (filtered noise) + cup clink | scan sweep, lock = thump + clack + two-tone beep (×5–6), roll ticks | pad + arp |
| Readout | murmur | panel slide (servo), roll ticks, amber lock | pad + arp |
| City | street wash, distant traffic | whoosh on pull-back, soft ticks as meters turn | pulse builds |
| Reflection | silence → glass room tone | hesitant bracket chirps, one glitch, lock, green chord | pulse out, pad + tone |
| Power-down | hum fades | panel clicks off, power-down tone, final chatter | chord → silence |

## 8. Type & subtitles
Rajdhani (Light for big values and the title, SemiBold for labels), Share Tech Mono for micro data. All caps in the HUD. Subtitles are sentence case on a dark HUD plate with corner ticks and voiceprint bars, centred at y≈1350, at most 2 lines, near-white Rajdhani Medium 44 px.
