import { Entity } from './Entity';
import { Transform } from './components/Transform';
import { SceneManager } from './SceneManager';

const sceneManager = new SceneManager();
const player = new Entity();
player.addComponent(new Transform());

sceneManager.addEntity(player);

const transform = player.getComponent(Transform);
if (transform) {
  transform.x = 10;
  console.log('Player x position:', transform.x);
}

// Later, to remove the player from the scene:
sceneManager.removeEntity(player); 