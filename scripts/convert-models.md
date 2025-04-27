# Converting FBX Models to GLB/GLTF

Our game uses GLB format for 3D models as it's more efficient and better supported in web browsers. Here's how to convert the FBX files to GLB:

## Option 1: Using FBX2glTF (Recommended)

1. Install FBX2glTF:
   ```bash
   # On macOS with Homebrew
   brew install fbx2gltf

   # On other platforms, download from:
   # https://github.com/facebookincubator/FBX2glTF/releases
   ```

2. Convert models:
   ```bash
   # Convert a single file
   fbx2gltf ./public/assets/models/CommonTree_Snow_1.fbx --binary --output ./public/assets/models/CommonTree_Snow_1.glb

   # Convert all files in the models directory
   for f in ./public/assets/models/*.fbx; do
     fbx2gltf "$f" --binary --output "${f%.fbx}.glb"
   done
   ```

## Option 2: Using Blender

1. Open Blender
2. Go to File > Import > FBX
3. Import your FBX file
4. Go to File > Export > glTF 2.0
5. Choose these settings:
   - Format: GLB
   - Transform: -Z Forward, Y Up
   - Check "Apply Modifiers"
   - Check "Export Materials"
   - Check "Compress"

## Option 3: Online Converters

You can use online services like:
- https://products.aspose.app/3d/conversion/fbx-to-glb
- https://www.mixamo.com/#/

Note: Be careful with online services and check their terms of service regarding your 3D assets.

## Post-Conversion Steps

1. After converting, update the model paths in `world.config.ts` to use .glb extension
2. Test each model in the game to ensure proper:
   - Scale
   - Materials
   - Animations (if any)
   - Shadow casting/receiving 