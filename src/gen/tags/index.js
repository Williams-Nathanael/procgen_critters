// Tag registry. To add a new entity type: create ./<name>.js (see AUTHORING.md),
// import it here and add it to the list. It then stacks with every other tag.
import salamander from './salamander.js';
import amphibian from './amphibian.js';
import arthropod from './arthropod.js';
import fungus from './fungus.js';
import mammal from './mammal.js';
import dragon from './dragon.js';
import plant from './plant.js';
import jansson from './jansson.js';

export const TAGS = Object.fromEntries([salamander, amphibian, arthropod, fungus, mammal, dragon, plant, jansson].map(t => [t.id, t]));
export const TAG_NAMES = Object.keys(TAGS);
export const SLOTS = ['chassis', 'head', 'limbs', 'tail', 'dorsal', 'crown', 'surface'];
