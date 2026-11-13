# Posing guide: FGPOWER exercise figures

A spec is a small JSON file, specs/<slug>.json. The renderer draws our 3D figure with real equipment: start and end frames
and a looping video. The picture must show EXACTLY the movement in the instructions.

## Tools (run from scripts/exercise-art)
    node check.mjs specs/x.json ...                 instant, no browser: "ok" or errors. Fix every E line, and the rom: warnings.
    node prop-doc.mjs leg-press barbell             where the body goes on that equipment, and example specs
    node render.mjs specs/x.json ... --out out-NAME --closeups   writes out-NAME/<slug>/sheet.png (frames) and closeups.png
    node motion-strips.mjs <slug> ... --out out-NAME   the whole rep on one sheet: 7 moments of the loop, a side view of the start
                                                    and the deepest moment, the lift and tempo, check.mjs's errors and warnings
    node lifts.mjs [specs/x.json]                   which way each loop's lift goes, and its length (MOTION.md)
    python3 contact-sheet.py out-NAME out-NAME/sheet --cols 3 --per 12 --only a,b,c    one page with many exercises
    render.mjs --loop 8 writes a preview loop.webp at 8 fps; --final the app's start.webp, end.webp and loop.mp4 (20 fps).
Every render also writes <slug>/view.json: the camera's fit, what prep.js changed (below) and the loop's timeline.

MOTION.md is the standard of a perfect rep per movement pattern: the range (rom: warnings), the tempo, what check.mjs measures over
the whole loop, what to look at in a motion strip, and the usual fix for each new check (hover, grip, contact, slide, balance, rom).
Read it before posing a new family.

## World
Metres. Floor y = 0, Y up. At yaw 0 the figure faces +Z, so +X is the figure's LEFT.
Hip joints (+-0.11, 0.92); shoulder joints (+-0.19, 1.38). Upper arm 0.279, forearm 0.241, thigh 0.432, shin 0.428.
Standing root.pos is about [0, 0.92, 0]. Ankle 0.07 above the sole. Ball of the foot 0.13 ahead of the ankle, heel 0.05 behind.
REACH OF A GRIP: a grip's pos is the bar, 0.107 beyond the wrist. Arm and wrist straight, the bar is 0.62 from the shoulder joint
(0.52 is the WRIST's reach). A lockout, a curl's bottom or a hang puts the bar 0.60-0.62 from the shoulder joint; at 0.52 the elbow
bends about 60 degrees (check.mjs then warns rom:...lockout / .bottom / .hang).

## Spec
    {"slug":"x","camera":{"az":60,"el":8},"muscles":["chest","triceps"],"props":[...],"frames":{"start":{...},"end":{...}}}
A hold has only start. Optional frames mid, mid2, mid3 are visited in order: use one whenever a straight blend would be wrong,
because hands and feet travel in straight lines between frames (a curl's hand needs a mid on its arc, or use fk arms).
Optional: "muscleSide":"L"|"R" (one-sided moves; the working limb is the figure's LEFT), "floats":true (nothing on the floor),
"tempo":{"lift":"there"|"back"|"even","up":1,"down":1.8,"squeeze":0.35,"stretch":0.2} (MOTION.md: the loop already lowers slower
than it lifts and pauses at the ends; lift is read from the lit muscles, write it only when lifts.mjs gets it wrong),
"timing":{"there":3,"holdEnd":1,"back":1,"holdStart":0} only where tempo is the point of the exercise (wins over tempo).
"magnet":false turns the grip magnet off for the whole spec (see below).
muscles: taxonomy ids of the primary muscles, at most 3 or 4: chest abdominals obliques lats traps rhomboids middle-back
spinal-erectors glutes abductors adductors quadriceps hamstrings calves biceps triceps forearms shoulders anterior-deltoid
lateral-deltoid posterior-deltoid. neck and full-body draw nothing.

## Frame
root: {pos:[x,y,z] between the hip joints, yaw, pitch, roll}. pitch 0 upright, +90 prone (head toward +Z), -90 supine (head toward
-Z), below -90 hips above shoulders (a bridge is about -122), plank about +70. yaw + turns toward the figure's left. roll + tips the
top toward its right.
spine: {flex (+ forward), side, twist, weights:[5 numbers lower to upper]}. neck: {flex (+ chin down), side, twist}. Keep the gaze natural.
legL/legR: {pos, anchor:"sole"|"ball"|"heel"|"ankle", pitch (+ heel up), yaw (+ turns the left foot out, the right foot in), toes, pole}
 or {fk:{flex,abd,rot,knee},rel:"pelvis"|"world",foot:{pitch}}. pole is where the knee points.
armL/armR by position: {pos, rel:"world"|"chest"|"pelvis"|"head", pole (where the elbow points), hand, fingers, palm, grip, contact, scap:{elev,prot}}
 or by angles: {fk:{flex (90 forward raise),abd (90 side raise),rot,elbow},rel:"chest",hand,pron}. Use fk for anything turning around a joint.
Keep one mode per limb across frames. scap prot negative pinches the shoulder blades (rows).

## Hands: this is what people look at
hand: "relaxed" (default in the air), "flat" (with contact:true; pos is the point on the surface under the palm, fingers and palm are
directions, palm points into the surface), "rest" (laid on the body: fingers together, softly curved; prep.js gives it by itself),
"open", "fist", "grip", "hook", "pinch", "ball". A hand with contact:true must touch something (check.mjs contact:arm).
"grip": grip is the bar's radius: barbell 0.014, ez 0.014, dumbbell 0.016, cable handle 0.015, thick bar 0.025, rope 0.018. pos is the
point on the bar's axis in the middle of the hand. fingers is where the fingers would point if the hand opened, palm the way the palm
faces, both perpendicular to the bar. For the right hand negate x in pos, fingers, palm and pole.
Auto-roll: grip/hook hands (and contact hands with curl over 0.55) turn about the bar, flat contact hands turn on the surface,
just enough to keep the wrist within its limits; the bar stays where pos puts it. "roll":<deg> forces it (+ fingers toward the
palm for a grip, toward the thumb for a flat hand), "autoRoll":false turns it off. It cannot fix a wrist leaning toward the
little finger or the thumb on a bar: point the bar's axis (fingers x palm) more across the forearm, or change the pole.
Recipes for the left hand in world frame, figure facing +Z:
  deadlift, row, shrug, overhand at the side: fingers [0,-1,0] palm [0,0,-1]
  curl bottom, underhand: fingers [0,-1,0.1] palm [0,0.1,1]. curl top: fingers [0,0.5,0.85] palm [0,0.85,-0.5]
  hammer, neutral dumbbell at the side: fingers [0,-1,0] palm [-1,0,0]
  lateral raise, palm down: fingers [1,0,0] palm [0,-1,0]
  overhead press, overhand: fingers [0,0.55,-0.83] palm [0,0.83,0.55]
  bench press (supine, head toward -Z): fingers [0,0.5,-0.85] palm [0,0.85,0.5]
  pull-up overhand: fingers [0,1,0] palm [0,0,1]. chin-up underhand: fingers [0,1,0] palm [0,0,-1]
  push-up, floor: contact:true hand:"flat" fingers [0,0,1] palm [0,-1,0]

## Props
Everything real is there: node prop-doc.mjs <type>. Each type has a worked example, specs/_gallery/<type>.json, with the exact numbers:
START FROM IT, do not guess the machine's geometry. Props in the spec's "props" list stay still, unless they have hand, hands, foot,
feet or follow: those follow the body in every frame (hand:"L" dumbbell, hands:true barbell, follow:true machine). A barbell with
hands:true sits in the two grips by itself. "props" inside a frame are rebuilt per frame and interpolate: same items, same order.

## Camera
az 0 in front, 90 at the figure's left, 180 behind; el is height. Chest and front work az 35-55, el 3-6. Back, glutes, rear work az
115-150, el 12-25. Side-to-side moves az 15-30. Nothing between the camera and the body, and the moving limb and the bar must read clearly.
The fit (page.js setView) frames the performer over the whole loop with what it holds or moves (bars, dumbbells, a frame's own props);
benches, racks, walls, door frames, machines and cable stations count only within about 14 cm of the performer, so a tall rack or
a wall runs out of the frame instead of shrinking the figure. frameIgnore:true is no longer needed for that (it still drops a prop
from the fit entirely).

## What the engine does to a spec (prep.js, before the check and the render)
GRIP MAGNET. A closed hand ("grip"/"hook", or curl over 0.55 with fingers and palm) that holds no prop of its own and comes within
8 cm of a graspable cylinder (a machine's handle from its grip registry, any bar, rod or rung 0.9-3 cm thick) is put on it: its grip
centre onto the handle's axis (4 cm inside its ends), its grip axis along the handle, the fingers continuing the forearm when it was
declared across. An fk arm gets a world `nudge` of its wrist. A snap that would bend the wrist or the elbow past its range or leave
the arm short is undone in every key frame: check.mjs then says hover:armL (off the handle) or grip:armL (across it), which is the
pose to fix. "magnet":false on an arm or the spec turns it off. view.json lists every snap.
FREE GRIPS. A closed hand holding a dumbbell, a plate or a cable's single D-handle alone (hand:"L") keeps its wrist in a comfortable
band (extension up to 20, flexion 15, ulnar 10, radial 6; forearm twist 104): the arm stays as declared, the hand straightens at the
wrist and the weight follows. Kettlebells, landmines and bars in both hands keep the declared hand; so do wrist exercises (muscles
include "forearms") and an arm with "freeGrip":false.
RESTING HANDS. An open hand whose palm lies on the body (palm toward the skin; within 3.5 cm, 6 cm if the arm is declared relative to
the body (rel pelvis/chest/head), 12 cm with contact:true there) is laid on it in every key frame: hand "rest", palm against the skin,
fingers along it (turned on the skin if they would sink into a thigh), unless that bends the wrist or the other hand is under it.
"rest":false on an arm keeps the declared hand. To put hands on the hips: armL {pos (palm point, rel "pelvis"), rel:"pelvis",
contact:true, fingers, palm}; the engine finds the skin.
ARM MACHINES (machine-curl, machine-preacher, machine-triceps) take their lever's reach from the hands now, like the pec deck: a
closed fk hand is a grip, and the handle is where its fingers close.

## Right means
1. It is the exercise in the instructions: same joints, same contacts, same direction, true range of motion (MOTION.md's standard:
   presses lock out, curls start from straight arms, squats reach parallel, pull-ups clear the bar).
2. Hands hold the bar, feet on the floor or plate, seat on the seat, back on the pad. Nothing floats, nothing passes through anything,
   in every moment of the loop (check.mjs samples it), not only in the key frames.
3. Joints bend the right way. Knees over toes. A neutral spine stays straight. Legs in a plank are straight.
4. It moves like a person: planted feet and hands do not slide (a step lifts the foot: a mid frame), the centre of mass stays over
   the feet when nothing else holds the body, and the loop reads as a rep (motion-strips.mjs shows it).

## Wrists (2026-11-07)

check.mjs uses a real wrist's range: ulnar 35, radial 25, extension 80 (90 for a flat hand on a surface, contact:true), flexion 70. Under load a power grip sits near neutral (under 20). rig.js searches the hand's roll about the bar and the elbow's swivel (+-35 around the shoulder-to-wrist axis) for the straightest wrist, keeping the declared look as far as it can; `roll`/`swivel` (degrees) force them, `autoRoll:false`/`autoPole:false` opt out, `report.angles.handRoll*`/`elbowSwivel*` show what was used. Write the pose so the search has little to do: forearm roughly perpendicular to the bar or handle, the hand directly above the elbow in presses (forearm vertical under the weight), hands under the shoulders in pushes. check.mjs also samples the loop 24 times and flags `twitch:*` when a hand or forearm turns over 30 degrees between neighbouring samples: blend fingers/palm smoothly between key frames (no vector that flips sign).

