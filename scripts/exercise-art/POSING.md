# Posing guide: FGPOWER exercise figures

You turn an exercise description into a pose spec, a small JSON file. The renderer draws one mannequin with simple
props, in a consistent style, as start and end pictures plus a there-and-back loop. Your job is that the picture shows
**exactly the movement in the instructions**: someone who has never done it should copy it correctly from the image.

Run commands from `scripts/exercise-art`. First build the body once: `node build-body.mjs && node build-body.mjs --real-head`. The app's figures use the dark look: pass `--look studio` to `render.mjs`, or run `export-figures.mjs`.

## Tools

```
node check.mjs                      # prints the figure's landmarks and limb lengths
node check.mjs specs/x.json         # solves without drawing (instant, no browser). Use it constantly while tuning
node render.mjs specs/x.json [--loop 20] [--out out]   # draws. Writes out/x/start.png, end.png, sheet.png, report.json
```

- `check` reports `MISS` (a hand or foot cannot reach its target, in metres), `TWIST` (forearm wrung past 110 degrees,
  change the pole or the palm), `SINKS` (body below the floor), `FLOATS` (nothing touches the floor), elbow and knee
  angles (0 is straight) and joint positions. Fix all of these before rendering.
- `render` queues behind a lock, so only one browser runs at a time. Pass several specs in one call to save time.
- **You must read `out/<slug>/sheet.png` with the Read tool and look at it.** Numbers do not catch a wrong pose. A pose
  is done only after you have looked at the picture and it matches the description.
- With `--loop 20`, also look at `out/<slug>/loopmid.png`, the halfway frame of the movement.
- Every exercise's spec is in `specs/`. Start from the closest one. `rig.js` documents every field at its top.

## World

Metres. The floor is y = 0, Y is up. At yaw 0 the figure faces **+Z**, so **+X is the figure's LEFT**.

Figure: 1.73 m tall. Shoulder joints (±0.20, 1.38), hip joints (±0.11, 0.93), hip to shoulder 0.45. Upper arm 0.25,
forearm 0.27, thigh 0.42, shin 0.44. Ankle 0.07 above the sole. Ball of the foot 0.13 ahead of the ankle, heel 0.05
behind it. Arm from shoulder to palm surface is about 0.55 when straight. Leg from hip to ankle is 0.86 when straight.

## Angles

| Field | Meaning |
|---|---|
| `root.pitch` | 0 upright. +90 prone (front down, head toward +Z). -90 supine (front up, head toward -Z). Below -90 the hips are above the shoulders (a bridge is about -122). A plank is about +70 |
| `root.yaw` | Turns the figure toward its left. 90 makes it face +X, toward the side camera |
| `root.roll` | Tips the top toward the figure's right. `yaw 90, roll 76` is lying on the right side, head toward +Z, facing the camera (side plank) |
| `spine.flex` | + bends forward, - arches back. `weights` (5 numbers, lower to upper) localises it: a crunch curls the upper spine, `[0,0.1,0.3,0.3,0.3]` |
| `neck.flex` | + chin down, - chin up. Use it to keep the gaze natural: when the trunk leans, the head should not stare at the floor or the ceiling |
| foot `pitch` | 0 flat. + heel up, toes down. - toes up. Same sign as root pitch. A plank foot on its toes is about 60. Lying with toes up is -90. Kneeling with the top of the foot on the floor is about 172 |
| foot `yaw` | Turns the foot outward for the left foot when +, inward for the right foot when +. Natural turnout in a squat: left 14, right -14 |

## Specs

```json
{
  "slug": "pushups",
  "camera": {"az": 52, "el": 5},
  "muscles": ["chest", "triceps", "anterior-deltoid"],
  "props": [{"type": "chair", "pos": [0, 0, -0.31]}],
  "frames": {"start": {...}, "end": {...}}
}
```

- **Limbs.** Hands and feet that touch something are set by position (inverse kinematics). A free arm or leg can use
  `fk` angles. Keep the same mode for a limb in all frames, or the loop breaks.
- **Hands on a surface:** `{"pos":[x,y,z],"contact":true,"fingers":[...],"palm":[...],"curl":-0.3}`. `pos` is the point
  on the surface under the palm, `palm` points into the surface. `curl` -0.3 lays the fingers flat, 0.25 relaxed,
  0.5 loose, 0.75 a grip.
- **Elbows and knees:** `pole` is the direction the joint points. Elbows in a push-up: out and back. Knees default to
  the front of the body. Set the pole whenever a joint looks wrong: it fixes most ugly poses.
- **Feet:** `{"pos":[x,y,z],"anchor":"sole"|"ball"|"heel"|"ankle","pitch":0,"yaw":0,"toes":0}`. `anchor` says which part
  of the foot sits at `pos`. `toes` is the toes' world pitch; 0 keeps them flat on the floor when the heel rises.
- **Standing on a prop** (a step, a chair): add `"floats": true` at the top of the spec, or `check` reports FLOATS.
- **Static holds** (`loop: "hold"` in the design): give only `start`, no `end`.
- **Optional `mid`, `mid2`, `mid3` frames:** the loop goes through them in order, evenly spaced. Use them when a straight
  blend would look wrong, for example a foot that must lift while stepping back.
- **Lying on the floor:** the root height for a body flat on its back or front is about y 0.09 to 0.10, not more. `check`
  prints `trunk`, the trunk's height off the floor: it must be about 0 in any pose where the back, belly or hips rest on
  the floor. Fingers touching the floor hide a floating body, so read this number.
- **Tempo:** `"timing": {"there": 4, "holdEnd": 2, "back": 1, "holdStart": 0}` (seconds) makes the loop show that tempo,
  start to end and back. Use it only where the tempo is the point of the exercise, because it makes the file bigger.
- **One side:** `"muscleSide": "L"` or `"R"` paints the muscles on that side of the figure only. Use it for unilateral moves,
  so a free or relaxed limb shows no colour.
- **Unilateral moves:** the working limb is the figure's LEFT, nearest the side camera.

## Props

Positions are the point on the floor under the centre. Keep props where the design says.

A towel rope has one fixed length: `check` prints it per frame, and it must be the same in every frame. The hands travel together when the design says so.

Props at the spec's top level stay still. **A prop that moves goes inside each frame** as `"props": [...]`, with the same
items in the same order in every frame; it interpolates through the loop. Use this for a towel sliding under a heel or a
towel rope following the hands.

| Type | Size and use |
|---|---|
| `chair` | Seat top y 0.48, 0.42 square. At yaw 0 the back is at -Z and the seat's front edge at pos.z + 0.21, so a sitter faces +Z. `seatH` changes the height |
| `sofa` | Seat top y 0.42, front edge at pos.z + 0.36, back at -Z. `width` default 1.5; widen it when an armrest hides the body |
| `wall` | A slab 0.08 thick centred on pos.z, running past the frame. A figure on its +Z side meets its face at pos.z + 0.04, a figure on its -Z side at pos.z - 0.04. `width` shortens it if the long skirting line distracts |
| `step` | `height` 0.17, `depth` 0.28, `width` 0.7. A stair or thick book |
| `towel` | Flat on the floor, `width` 0.3, `depth` 0.42, under a foot or hand |
| `towel-strip` | A towel twisted into a rope, for pulling: from world point `a` to `b`, or through a list `points` (for example hand, foot, other hand). Keep the ends in the hands |
| `door-frame` | Two posts and a lintel, `width` 0.8, in the plane z = pos.z at yaw 0 |
| `door-corner` | A wall with a doorway. `pos` is the floor point of the corner to hook. At yaw 0 the wall runs along Z through pos.x, thickness 0.12: one segment goes from the corner toward -Z, the opening (`opening`, default 0.8) starts at the corner toward +Z, then the wall carries on, with a lintel at `headY` (default 2.1). Yaw 180 flips it. Use it for every move that hooks a door corner. Put the wall BEHIND the figure as seen from the camera |
| `table` | Top y 0.75. Only if the design names it |

## Camera

`az` 0 is in front of the figure, 90 at the figure's left side, 180 behind. `el` is the height of the camera.

- Default: `az` 60-75, `el` 5-10. The figure looks left, the far arm and leg stay visible.
- The picture must show the movement first. The target muscles should also be visible where possible:
  - Chest and front-of-body work: `az` 35-55, `el` 3-6.
  - Back, glutes and rear-of-body work: `az` 115-150, `el` 12-25.
  - Lateral raises and side-to-side moves: `az` 15-30.
- **Nothing may stand between the camera and the body.** A wall in front of the figure (+Z) needs `az` above 90. A wall
  behind it (-Z) needs `az` below 85. Door frames work best at exactly `az` 90, where the posts line up.
- Same camera for all frames (it is per spec, so this is automatic). The framing covers the whole movement.

## Muscles

`muscles` lists FGPOWER taxonomy ids, painted in the muscle colour: `chest`, `lats`, `traps`, `rhomboids`, `middle-back`,
`spinal-erectors`, `shoulders`, `anterior-deltoid`, `lateral-deltoid`, `posterior-deltoid`, `biceps`, `triceps`,
`forearms`, `quadriceps`, `hamstrings`, `calves`, `adductors`, `abductors`, `glutes`, `abdominals`, `obliques`.
Use the exercise's **primary** muscles from the design, at most 3 or 4 ids: too much colour says nothing. `neck` and
`full-body` draw nothing.

## What makes a pose right

1. The start and end positions match the instructions and `art.json`: same joints, same contacts, same direction.
2. Contacts are real: hands on the surface, feet on the floor, seat on the chair, back on the wall. Nothing floats and
   nothing passes through a prop or the floor. Body parts do not pass through each other.
3. Joints bend the right way and stay in natural ranges. Knees track over the toes. Elbows do not flip. Wrists are not
   bent past about 90 degrees, except a hand flat under a straight arm.
4. Trunk and neck are as the exercise demands: a neutral spine stays straight, a plank does not sag or pike.
5. The range of motion is true to the exercise: the bottom of a push-up has the chest near the floor; a squat reaches
   the depth described.
6. Legs in a plank or push-up are straight (knee under 10) and the line from shoulder to ankle is straight.
7. If two moves in a ladder differ, their pictures show the difference clearly.

If the instructions are ambiguous or a move cannot be shown honestly with this figure, pose your best reading and
report the doubt. Do not edit `rig.js`, `page.js`, `paint.js`, `render.mjs` or `build-body.mjs`: they are shared. If the
tool itself limits you, report it.
