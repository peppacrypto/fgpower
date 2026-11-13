# Motion standard: FGPOWER exercise figures

The owner's rule (2026-11-10): "elas têm que ser condizentes com uma execução humana completamente perfeita". A figure is judged as a
coach judges a rep: the whole loop, not the start and end stills. This file is that standard. The engine uses it in three places:

- `motion.js` moves the loop on a coached tempo (below).
- `check.mjs` (qa-lib.mjs, `checkLoop`) measures what can be measured on 24 samples of the loop: errors where it is physically wrong,
  warnings (`rom:*`, `balance`) where it is a coach's judgement.
- `node motion-strips.mjs <slug> ...` draws one review sheet per exercise: 7 moments over the loop's time from the spec's camera, a
  side view of the start and of the deepest moment, the lift and the tempo, and check.mjs's errors and warnings. Review everything
  in the "look at it" column there.

Patterns are the catalog's `movementPattern` (prisma/seed-data/exercises.generated.json; `catalog.mjs` reads it). A partial range on
purpose (rack pulls, half squats, pin presses, isometric holds, negatives) is left out of the range checks by its slug.

## The reach every poser needs

A grip's `pos` is the bar's axis, not the wrist: the bar sits 10.7 cm beyond the wrist (10 along the fingers, 3.6 out of the palm).
With the arm and the wrist straight the bar is **0.62 m from the shoulder joint** (0.52 to the wrist + 0.10 to the bar). A bar placed
at 0.52 m bends the elbow about 60 degrees: that is why many presses never lock out and many curls start half bent (the `rom:*`
warnings found 160 such specs on 2026-11-13). Lockout and long-arm positions: bar 0.60-0.62 m from the shoulder joint.

## How a loop moves (tempo)

A spec runs start -> mid.. -> end and the loop comes back the same way. Each segment between key frames is a lift (concentric: the
lit muscles shorten), a lowering (eccentric: they lengthen) or neither. `motion.js` reads that from the lit muscles' lengths at the
key frames (joint angles that stretch each muscle of the taxonomy); the frame where they are shortest is the top of the lift. When
the muscles say little, or the exercise is a stretch or cardio, the loop is even: the same speed both ways. `node lifts.mjs` lists
what it decided for every spec ("(inferred)" or "(spec)").

| category | lift (up) | lowering (down) | pause where the muscles are shortest | where they are longest |
|---|---|---|---|---|
| strength (default) | 1.0 s | 1.8 s | 0.35 s | 0.2 s |
| plyometrics | 0.45 | 0.6 | 0.12 | 0.18 |
| olympic lifts | 0.7 | 1.3 | 0.3 | 0.2 |
| stretching (even) | 1.6 each way | | hold 1.0 s in the stretch (end) | 0.4 at the start |
| cardio (even) | 0.6 each way | | none | none |
| static holds with an end frame | 1.5 each way | | 0.6 | 0.6 |

Every move follows a minimum-jerk curve (the smooth start and stop of a human reach), mapped onto the segments by their share of the
path. A loop with several parts per pass (alternating sides, a step up and down) keeps these proportions inside 4.8 s. The final
render is 20 fps (about 67 frames for a strength rep, 3.35 s); `render.mjs --final` encodes at CRF 27 and again at 29, then 31, only
if a loop would pass 80 KB.

Spec field (all optional): `"tempo": { "lift": "there"|"back"|"even", "up": 1.0, "down": 1.8, "squeeze": 0.35, "stretch": 0.2, "even":
1.3, "hold": 0.3, "maxLoop": 4.8 }`. `lift`: "there" = start -> end is the lift, "back" = end -> start is the lift, "even" = no lift.
Write it when the inference is wrong (lifts.mjs, or the strip's timeline line) or when tempo is the point of the exercise. The older
`"timing": { "there", "holdEnd", "back", "holdStart" }` (seconds) still sets the whole loop by hand and wins over both.

## What check.mjs measures over the whole loop

| key | level | what |
|---|---|---|
| `slide:<limb>` | E | a heel, a ball of the foot, a palm or a grip on a still bar stays planted (within 2 cm of the floor or a still prop) in consecutive samples yet slides over 3 cm along it. A step must lift the foot: give the step a mid frame with the foot in the air. A limb a prop follows (towel, glider: `foot`/`hand` keys) or resting on a towel/slider that a frame moves is free to slide. |
| `balance` | E / W | only the feet bear weight (no other skin within 2.5 cm of the floor or a prop, no hand on a surface or a handle) and the centre of mass (body by de Leva's segment masses, plus held dumbbells, kettlebells and loaded bars) is outside the base of support (the contact points of the soles and toes): over 8 cm an error, 4 to 8 cm a warning. A body part that only just floats (within 5 cm of where it should rest, typically an in-between lifting a back or the hips) makes it a warning. Machines (follow), cables, bands, straps and sleds in the hands, plyometrics, Olympic lifts and cardio are left out. |
| `contact:arm<s>` | E | an open hand declared on a surface (`contact: true`) whose palm centre is over 3.5 cm from the floor, every prop and the skin. |
| `hover:arm<s>` | E | a closed hand that no prop follows is 1.5 to 25 cm from the axis of the nearest graspable (grasp.js): it should be on that handle. |
| `grip:arm<s>` | E | a closed hand on a machine's handle (the grip registry) with its grip axis over 40 degrees across the handle (bars and rods were already checked). |
| in-betweens | E | the body against itself and the props (`self:`, `prop:`, `thru:`) is now also checked at every eighth of the path (t.13, t.38, t.63, t.88): a hand that crosses a thigh, a cable through an arm, the head into the chest between key frames. |
| `twitch:*` | E | unchanged (24 samples). |
| `rom:<pattern>.<what>` | W | the range of motion against the standard below. A warning because it is a coach's call; the owner's standard is the full textbook range, so fix it unless the exercise is partial on purpose (then the slug says so, or `qaAllow`). |

## The standard per movement pattern

Angles in degrees; 0 is a straight joint; hip flexion 0 standing, 90 seated. "Measured" is what check.mjs warns about.

| pattern | a textbook rep | measured (rom: warning when not met) | look at it (motion strip) |
|---|---|---|---|
| squat | feet flat, knees track the toes, the bar over mid-foot; down until the thighs are at least parallel, back flat; up to standing tall. Hack squat and leg press as deep as the machine allows (hack: glutes toward the heels, the owner's request); split squats as lunges. | bottom: hip joint no higher than the knee joint + 3 cm (free squats); knees at least 95 (leg press, belt) or 110 (hack); top: knees under 25; spine flexion under 25 | heels down, knees out over the toes, bar path vertical over mid-foot, chest up, depth even on both sides |
| hinge (deadlift, RDL, good morning, back extension) | flat back throughout, the bar close to the legs, hips back; RDL to mid-shin with soft knees; lockout standing tall, hips through | bottom: hip flexion at least 60; top: hip flexion under 15; spine flexion under 20; back extensions and good mornings: hip range at least 45 | the bar touching or brushing the legs, shoulders over the bar at the start, no lumbar rounding, no hyperextension at lockout |
| lunge (lunges, split squats, step-ups) | long step, torso upright, front knee about 90 over the foot, back knee just off the floor; step-ups finish standing tall on the box | bottom: front knee at least 80; trunk flexion under 20; step-ups: the stepping knee under 20 on top | the back knee's path, the front heel down, a stepping foot that lifts (slide: catches a gliding one) |
| horizontal push (bench, push-up, dips for the chest) | bar or chest down to touch, elbows about 45 to the trunk, lockout with straight arms; shoulder blades set | bottom: elbows at least 75; top: elbows under 25 (flyes and crossovers left out) | bar to the lower chest, wrists over the elbows, the body a straight plank in push-ups, no flaring elbows |
| vertical push (overhead press, pike push-up) | from the shoulders (bar about chin height) to lockout overhead, arms by the ears, ribs down | top: elbows under 25 and the upper arm at least 145 up (presses); bottom: elbows at least 70 | bar path close to the face, head through at lockout, no lean back |
| horizontal pull (rows) | from long arms (shoulder blades forward) to the handle at the body, elbows past the trunk, blades squeezed; the trunk still | end: elbows at least 75; start: elbows under 35 | no jerking with the trunk, elbows along the body, a neutral spine in bent-over rows |
| vertical pull (pull-up, pulldown) | from a dead hang (long arms) to the chin over the bar / the bar to the upper chest; no swinging | bottom: elbows under 30; top: elbows at least 90; pull-ups and chin-ups: the head joint 7 cm or more above the hands at the top (chin over the bar) | shoulders down at the top, no kip unless named, legs quiet |
| elbow flexion (curls) | from straight arms to the forearm against the upper arm, the elbow still at the side | bottom: elbows under 30 (preacher, spider: 35); top: elbows at least 105 | elbows not drifting forward, wrists neutral, no swing |
| elbow extension (triceps) | from the forearms past 90 to straight arms, upper arms still | end: elbows under 20; bottom: elbows at least 75 | upper arm fixed (pushdowns: by the sides; overhead: by the ears), wrists neutral |
| shoulder abduction (lateral, front raises) | arms long (elbows soft), up to shoulder height (overhead for the named overhead raises), down to the sides | top: upper arm at least 75 up (150 for overhead raises); bottom: under 35; elbows under 45 | no shrug, the trunk still, little fingers not above the thumbs at the top |
| shoulder extension (pullovers, straight-arm pulldowns, rear-delt raises, face pulls) | pullovers and pulldowns: arms long, from overhead to the hips; rear-delt raises and pull-aparts: arms out to the sides in line with the shoulders | pullovers: the arms sweep at least 50; rear-delt work: the arms open at least 40 and the elbows stay under 45 | the chest still on the bench or pad, no shrug, the head neutral |
| knee flexion (leg curls) | from straight legs to the heels toward the glutes, the hips down on the pad | end: knees at least 90; start: knees under 30 (Nordics and glute-ham raises left out) | hips not lifting, feet neutral |
| knee extension (leg extension) | from about 90 to straight legs, the back on the pad | top: knees under 15; bottom: knees at least 75 | no swinging, the back on the pad |
| plantar flexion (calf raises) | from the heels low (full stretch) to high on the toes, knees still | ankle range at least 25 | over the balls of the feet, no bouncing, the body upright (balance: catches a figure behind its toes) |
| hip extension (hip thrust, bridges, kickbacks) | from the hips down to knees, hips and shoulders in one line, a squeeze at the top; the shins vertical at the top | top: hip flexion under 10; bottom: at least 40 (kickbacks left out of the bottom) | the upper back on the bench or floor in every frame (balance: catches a floating back), ribs down, no lumbar arch |
| hip abduction | the leg out to about 35-45, the pelvis still | the leg opens at least 25 | no hip hike, no trunk lean |
| trunk flexion (crunches, sit-ups, leg raises) | the spine rolls up (shoulder blades off the floor) / the legs to about 90 | the spine curls at least 20 or the hips fold at least 35 | the lower back down in crunches, no pulling on the neck |
| anti-extension (planks, rollouts) | shoulders, hips and ankles in one line; rollouts as far as the back stays flat | hips within 25 of piked and 15 of sagged | the head neutral, the shoulders over the elbows or hands |
| rotation, anti-rotation | the chest turns well round with the hips steady / the trunk does not turn | the trunk turns at least 20 (rotation) | the hips square, the arms long |
| carry | walking tall, shoulders level | the trunk leans under 15 | grip, no shrug, short steps |
| olympic, plyometrics (jumps) | triple extension (ankles, knees, hips straight) at take-off, a soft landing on the balls of the feet with the knees over the toes | no rule yet: review | take-off fully extended, landing knees bent, feet leave and land together |
| stretching | a held end position that stretches the named muscle, the rest of the body neutral | no rule: review | the stretch is the one in the name, no strain at the neck, the supporting hand or foot planted |

## Errors and the usual fix (cookbook for the new checks)

Same format as plan/cookbook-errors.txt; append this section there. Rule as ever: fix the spec or its generator, never loosen a limit.

ENGINE (prep.js, before the check and the render): closed hands within 8 cm of a handle snap onto it (axis along it); dumbbell, plate
 and D-handle hands keep the wrist straight-ish; open hands on the body are laid on the skin (hand "rest"). view.json lists what it did.
THE REACH (root cause of most rom: warnings): a grip's pos is the BAR, 0.107 beyond the wrist; arm and wrist straight, the bar is
 0.62 m from the shoulder joint (0.52 is the wrist's reach). Lockouts, curl bottoms, hangs: bar 0.60-0.62 m from the shoulder joint.
HOVER  hover:armL  a closed hand, nothing in it, 1.5-25 cm from the nearest handle's axis (the magnet reaches 8 cm, or its snap was
  undone because the wrist or the elbow could not follow). Example: calf-machine-shoulder-shrug 15.6 cm from the yoke's handles,
  lying-machine-squat 7.1 cm above its handles. Fix: pos ON the handle's axis (prop-doc.mjs, specs/_gallery/<type>.json), 4 cm inside
  its ends, fingers x palm along the handle; then the elbow (pole) so the forearm meets the handle square.
GRIP (machine handles)  grip:armL "closes across the handle X: 59 deg". Example: lying-leg-curls, dip-machine (its handle runs along
  the lever: the forearm must not). Fix: fingers/palm from the handle's direction (fingers x palm along it), the elbow so the forearm
  is not along the handle.
CONTACT  contact:armL "declared on a surface (contact) but its palm is 9.7 cm from ...". A flat or resting hand floats. Example:
  sofa-hip-thrust 14.6 cm, weighted-sissy-squat's balance hand 8.2 cm from the rack. Fix: pos is the palm's point ON the surface (the
  floor y 0, the prop's top, or the skin with rel "pelvis"/"chest"/"head": the engine lays a body hand within 12 cm onto the skin);
  or drop contact if the hand is in the air on purpose.
SLIDE  slide:legR "the R foot's ball stays planted on the floor from t0 to t.7, yet slides 47.9 cm". A foot or a palm glides along
  the floor between key frames (a lunge's step that skates). Fix: a step needs a mid frame with that foot in the air (5-10 cm); a
  foot or hand that stays keeps the same pos and anchor in every key frame. Towels and gliders ride the limb: foot:"L"/hand:"L" on
  the prop, or a towel in the frame's props under it.
BALANCE  balance (E over 8 cm, W 4-8 cm). Only the feet bear weight and the centre of mass is outside them. Usually a part that should
  rest floats: lower-back-smr (back 8-12 cm above the roller), natural-glute-ham-raise (knees 3-5 cm above the mat), a hip thrust's
  upper back in front of the bench edge. Fix that contact (root.pos, pitch). Standing: hips back, the load over the mid-foot.
  W "only just floats": an in-between lifts a back off the floor: add a mid frame.
IN-BETWEENS  self:/prop:/thru: at t.13 t.38 t.63 t.88. The straight blend between key frames cuts through the body or a prop (a cable
  through an arm, a dumbbell through the thighs, the head into the chest). Fix: a mid frame on the real path, or move a key frame.
ROM  rom:<pattern>.<what> (warnings; the owner's standard, fix them). E.g. rom:horizontal-push.lockout "the elbows stay bent 58 deg at
  the top", rom:elbow-flexion.bottom "stay bent 52 deg at the bottom", rom:squat.depth, rom:vertical-pull.chin. Fix: the range in the
  table above; bent lockouts: THE REACH. A partial rep on purpose: say it in the slug (half, quarter, partial, rack-pull, pin,
  isometric, hold, negative) or qaAllow {"rom:...": "why"}.

## For a human eye (not measured here)

- The bar path (over mid-foot in squats, deadlifts and presses; the J curve of a bench press).
- Knees tracking the toes; heels down; feet still unless the exercise steps.
- The head and the gaze neutral; no neck strain in crunches.
- The shoulder blades: set in presses, retracted at the end of rows, down in pull-ups.
- Symmetry (both sides to the same depth) in bilateral lifts.
- The right muscles lit (spec.muscles), and the one-sided ones on the working side (muscleSide).
- The tempo reads like a rep: a deliberate lowering, a firm lift, a brief pause at each end (the strip's timeline line says which).
