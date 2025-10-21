import fs from 'fs';
import path from 'path';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Polyfills for Node.js
Object.defineProperty(global, 'window', { value: global, writable: true, configurable: true });
Object.defineProperty(global, 'document', { value: {
  createElement: (tag) => ({
    getContext: () => ({}),
    toDataURL: () => '',
  }),
  getElementById: () => ({})
}, writable: true, configurable: true });
Object.defineProperty(global, 'navigator', { value: { userAgent: 'node' }, writable: true, configurable: true });
Object.defineProperty(global, 'self', { value: global, writable: true, configurable: true });
Object.defineProperty(global, 'URL', { value: {
  createObjectURL: (blob) => 'blob:dummy',
  revokeObjectURL: () => {},
}, writable: true, configurable: true });
Object.defineProperty(global, 'webkitURL', { value: global.URL, writable: true, configurable: true });
global.Image = class Image {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this.src = '';
  }
};
global.requestAnimationFrame = (cb) => setImmediate(cb);
global.cancelAnimationFrame = clearImmediate;

const baseAssetsDir = path.join(process.cwd(), 'public/assets');
const dirs = ['models', 'animations', 'textures'];
const loader = new GLTFLoader();

const results = { models: {}, animations: {}, textures: [] };

// Log start
console.log('Starting asset metadata extraction...');
console.log('Base dir:', baseAssetsDir);

// Recursive file walker
function walkDir(dirPath, dirKey, callback) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  entries.forEach(entry => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, dirKey, callback);  // Recurse
    } else {
      callback(dirKey, entry.name, fullPath);
    }
  });
}

// Process file based on type
function processFile(dirKey, file, filePath) {
  const ext = path.extname(file).toLowerCase();
  console.log(`Found file: ${file} in ${dirKey} (ext: ${ext})`);
  if (ext === '.gltf') {
    try {
      const text = fs.readFileSync(filePath, 'utf8');
      loader.parse(text, path.dirname(filePath), (gltf) => {
        extractMetadata(gltf, dirKey, filePath);
        checkFinish();
      }, undefined, (error) => {
        console.error(`Error parsing GLTF ${file}:`, error.message);
        results[dirKey][filePath.replace(baseAssetsDir, '')] = { error: error.message };
        checkFinish();
      });
    } catch (err) {
      console.error(`Error reading/parsing GLTF ${file}:`, err.message);
      results[dirKey][filePath.replace(baseAssetsDir, '')] = { error: err.message };
      checkFinish();
    }
  } else if (['.glb', '.fbx'].includes(ext)) {
    try {
      const data = fs.readFileSync(filePath).buffer;
      loader.parse(data, path.dirname(filePath), (gltf) => {
        extractMetadata(gltf, dirKey, filePath);
        checkFinish();
      }, undefined, (error) => {
        console.error(`Error parsing ${ext.toUpperCase()} ${file}:`, error.message);
        results[dirKey][filePath.replace(baseAssetsDir, '')] = { error: error.message };
        checkFinish();
      });
    } catch (err) {
      console.error(`Error reading ${file}:`, err.message);
      results[dirKey][filePath.replace(baseAssetsDir, '')] = { error: err.message };
      checkFinish();
    }
  } else if (dirKey === 'textures' && ext.match(/\.(png|jpg|jpeg|webp|ktx|dds)$/i)) {
    results.textures.push({
      file: filePath.replace(baseAssetsDir, ''),
      type: ext.slice(1),
      size: (fs.statSync(filePath).size / 1024).toFixed(2) + ' KB'
    });
    checkFinish();
  } else {
    console.log(`Skipping ${file} in ${dirKey}`);
    checkFinish();
  }
}

// Extract metadata from loaded GLTF
function extractMetadata(gltf, dirKey, filePath) {
  const anims = gltf.animations.map(anim => ({
    name: anim.name || 'Unnamed',
    duration: anim.duration,
    tracks: anim.tracks.length
  }));
  let meshes = 0;
  let bones = 0;
  gltf.scene.traverse((child) => {
    if (child.isMesh) meshes++;
    if (child.isBone) bones++;
  });
  results[dirKey][filePath.replace(baseAssetsDir, '')] = {
    meshes,
    bones,
    hasAnimations: anims.length > 0,
    animations: anims
  };
}

// Count expected for finish
let totalExpected = 0;
let totalProcessed = 0;
let hasPrinted = false;

// Process each top dir
dirs.forEach(dirKey => {
  const dirPath = path.join(baseAssetsDir, dirKey);
  if (fs.existsSync(dirPath)) {
    console.log(`Processing dir: ${dirKey}`);
    walkDir(dirPath, dirKey, (k, f, p) => {
      totalExpected++;
      processFile(k, f, p);
    });
  } else {
    console.log(`Dir not found: ${dirKey}`);
    results[dirKey] = { error: 'Directory not found' };
    checkFinish();
  }
});

function checkFinish() {
  totalProcessed++;
  console.log(`Processed ${totalProcessed}/${totalExpected}`);
  if (totalProcessed >= totalExpected && !hasPrinted) {
    console.log('Final results:');
    console.log(JSON.stringify(results, null, 2));
    fs.writeFileSync('assets_metadata.json', JSON.stringify(results, null, 2));
    console.log('Output written to assets_metadata.json');
    hasPrinted = true;
  }
}