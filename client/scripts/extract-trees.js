/**
 * Extract individual tree models from combined GLB file
 *
 * Usage: node scripts/extract-trees.js
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as THREE from 'three';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Polyfill browser globals for Node.js environment
global.self = global;
global.document = {
  createElement: () => ({}),
  createElementNS: () => ({})
};
global.window = global;
if (typeof HTMLImageElement === 'undefined') {
  global.HTMLImageElement = class {};
}
if (typeof HTMLCanvasElement === 'undefined') {
  global.HTMLCanvasElement = class {};
}
// FileReader polyfill for Node.js
if (typeof FileReader === 'undefined') {
  global.FileReader = class {
    readAsDataURL(blob) {
      // For Node.js, we'll handle this differently
      this.result = '';
      if (this.onload) {
        this.onload({ target: this });
      }
    }
  };
}
// Blob polyfill
if (typeof Blob === 'undefined') {
  global.Blob = class {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
    }
  };
}
global.URL = {
  createObjectURL: () => 'blob:mock',
  revokeObjectURL: () => {}
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INPUT_FILE = join(__dirname, '../public/assets/models/environment/low poly trees for itch.glb');
const OUTPUT_DIR = join(__dirname, '../public/assets/models/environment/extracted_trees');

async function extractTrees() {
  console.log('🌲 Loading GLB file...');

  // Read the GLB file
  const glbData = await readFile(INPUT_FILE);
  const arrayBuffer = glbData.buffer.slice(glbData.byteOffset, glbData.byteOffset + glbData.byteLength);

  // Load with GLTFLoader
  const loader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, '', (gltf) => {
      console.log('✅ GLB loaded successfully');
      console.log(`📦 Found ${gltf.scene.children.length} root objects`);

      // List all objects
      let meshCount = 0;
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          meshCount++;
          console.log(`  - ${child.name || 'Unnamed'} (Mesh)`);
        } else if (child.isGroup || child.isObject3D) {
          console.log(`  - ${child.name || 'Unnamed'} (${child.type})`);
        }
      });
      console.log(`🌳 Total meshes found: ${meshCount}`);

      // Export each top-level object as separate GLB
      exportIndividualTrees(gltf.scene).then(resolve).catch(reject);
    }, reject);
  });
}

async function exportIndividualTrees(scene) {
  const exporter = new GLTFExporter();
  const promises = [];

  // Create output directory if needed
  try {
    await mkdir(OUTPUT_DIR, { recursive: true });
  } catch (err) {
    // Directory already exists, ignore
  }

  console.log('\n🔨 Exporting individual trees...');

  // Export each child as a separate file
  scene.children.forEach((child, index) => {
    const treeScene = new THREE.Scene();
    const clonedChild = child.clone();
    treeScene.add(clonedChild);

    const treeName = child.name || `Tree_${String(index + 1).padStart(2, '0')}`;
    const outputPath = join(OUTPUT_DIR, `${treeName}.glb`);

    const promise = new Promise((resolve, reject) => {
      exporter.parse(
        treeScene,
        async (result) => {
          try {
            const buffer = Buffer.from(result);
            await writeFile(outputPath, buffer);
            console.log(`  ✅ Exported: ${treeName}.glb (${(buffer.length / 1024).toFixed(1)} KB)`);
            resolve();
          } catch (error) {
            console.error(`  ❌ Failed to export ${treeName}:`, error);
            reject(error);
          }
        },
        (error) => {
          console.error(`  ❌ Export error for ${treeName}:`, error);
          reject(error);
        },
        { binary: true }
      );
    });

    promises.push(promise);
  });

  await Promise.all(promises);
  console.log('\n🎉 All trees extracted successfully!');
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
}

// Run the extraction
extractTrees().catch(error => {
  console.error('❌ Extraction failed:', error);
  process.exit(1);
});
