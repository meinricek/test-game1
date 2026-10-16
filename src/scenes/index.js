import { BedroomScene } from './BedroomScene.js';
import bedroom from '../data/scenes/bedroom.json';

// Registr scén: id -> třída s geometrií + data (úkoly, interakce, triggery).
// Novou scénu přidáš tak, že vytvoříš třídu (extends BaseScene), JSON v src/data/scenes
// a zapíšeš je sem (a do src/data/story.json).
export const SCENES = {
  bedroom: { Scene: BedroomScene, data: bedroom },
};
