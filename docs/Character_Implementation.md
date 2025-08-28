Character Implementation Guide
Overview
Current focus: Single-player animated Colobus character in Three.js scene. Expandable to more characters/animations later.
Available Assets

Colobus:

Model: /assets/models/characters/Colobus_LOD0.glb
Animations: idle (Colobus_Idle_A.glb), run (Colobus_Run.glb), jump (Colobus_Jump.glb)
Scale: 0.3


Defined in public/characters.json (array for future expansion).

Implementation in Code

Loading: In Game.ts, use GLTFLoader to load model/animations.
Mixer: THREE.AnimationMixer for blending (fadeIn/fadeOut 0.2s).
States: idle (default), run (WASD moving), jump (Space).
Movement: Velocity/direction in updatePlayer; apply to position.y via terrain height.
Camera: Follows behind character.

Expansion Steps

Add to characters.json: New entries with model/animations.
UI: Enhance select in main.ts for multi-choice.
Multiplayer: Sync character ID/animation state via WebSocket.
NPCs: Add wandering logic with random animations.

Testing

Verify: Idle when still, run when moving, jump on space (no clipping).
Debug: Console logs for mixer updates.