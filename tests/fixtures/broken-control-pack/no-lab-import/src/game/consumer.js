// ⛔⛔ BROKEN ON PURPOSE. The game-side half of registration 2's control: it pulls a worldengine
// module into the game's closure that the lab's closure does not contain.
import { orphanOpticsOf } from '../worldengine/base/orphanOptics.js';
export const consume = (c) => orphanOpticsOf(c);
