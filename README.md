# Spacetime-Based Renderer

A lean WebXR starter built with Three.js to explore relativistic visuals (gravitational lensing, black holes) in VR. Designed to run on Rift S via desktop Chrome/Edge WebXR with Oculus runtime.

## Requirements
- Recommended: Node 18+ (Vite 5 and modern tooling). Node 14.15 on this machine can install dependencies but will log syntax warnings when running Vite; upgrade to avoid runtime issues.
- A PC VR setup with Oculus runtime + Chrome/Edge for VR testing.

## Getting started
```bash
npm install
npm run dev   # starts Vite dev server
npm run build # type-checks + production build (requires Node 18+ to avoid syntax errors)
```

## Controls
- Right hand: trigger to select black holes or the watch UI. Laser visually bends near masses.
- Left hand: watch UI (on the left grip) to add/remove black holes and change mass.
- Two-hand: hold grips on both controllers to scale/rotate the scene around the midpoint of your hands.
- Desktop fallback: OrbitControls work when not in an XR session (mouse drag to orbit, scroll to zoom).

## Implementation notes
- Sky dome uses a custom lensed shader: per-pixel, screen-space bend toward up to 4 black holes using a simple deflection formula; procedural starfield for background.
- Black holes: horizon sphere + transparent accretion disk mesh. Mass changes rescale these meshes and feed shader uniforms.
- Watch UI: canvas texture on a plane attached to the left controller grip; buttons for mass +/- , add/remove, and cycling selection.
- Laser: numerical bending per segment with Newtonian-like pull toward masses for a quick visual of lensing.
- Two-hand transform: scales and rotates the world root uniformly based on controller midpoint and vector.

## Testing/next steps
- Automated: add unit tests for math helpers (e.g., bending force, deflection curve), and snapshot tests for WatchUI canvas drawing. Wire up Vitest to keep it light.
- Manual VR: exercise add/remove/select, mass adjustments, two-hand scaling; confirm laser bending responds near horizons.
- Visual fidelity: increase ray steps or adopt a true geodesic integrator for lensing; add performance HUD.
- Interaction polish: haptic pulses on selection, better UI feedback (hover states, toggle for accretion disk visibility), and gaze/desktop fallback UI.
