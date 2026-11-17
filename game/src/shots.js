// The screenshot scenes behind ?shot=drive|street|city|chase. Each one places the
// real player and car in the real city and lets the renderer paint it, so the
// frame is what the game really looks like and the same seed always gives the
// same frame.
import { MISSIONS } from './config.js';

/**
 * Set `game` to the named scene (drive, street, city or chase; any other name
 * is drive) and return the objective line to show.
 */
export function stageShot(name, game) {
  if (name === 'street') {
    game.placePlayer(30, 30, Math.PI);
    game.placeCar(-180, -124, Math.PI);
    game.setInCar(false);
    game.setCamera({ mode: 'follow', yaw: Math.PI, pitch: 0.22, distance: 6.5 });
    game.setObjective(MISSIONS[0].objective);
    return;
  }
  if (name === 'city') {
    game.placePlayer(-176, -136, Math.PI);
    game.placeCar(-40, 246, Math.PI / 2);
    game.setInCar(false);
    game.setCamera({
      mode: 'fixed',
      fixed: { x: -250, y: 75, z: 290 },
      target: { x: 20, y: 5, z: -20 },
    });
    game.setObjective('Explore Solmar Bay');
    return;
  }
  if (name === 'chase') {
    // Cover shot: Lena in the stolen Vela GT at 3 stars on Palm Row, two SBPD
    // Interceptors behind, a roadblock ahead, traffic in the next lane.
    game.placeCar(0, 246, Math.PI / 2, 'vela');
    game.placePlayer(0, 242, Math.PI / 2);
    game.setInCar(true);
    game.setWanted(3);
    game.stageChase();
    game.setCamera({ mode: 'follow', yaw: Math.PI / 2, pitch: 0.22, distance: 10 });
    game.setObjective('Lose the cops — reach the garage');
    return;
  }
  // drive: Lena in the Alba on the Palm Row boulevard, sea on the right.
  game.placeCar(-40, 246, Math.PI / 2);
  game.placePlayer(-40, 242, Math.PI / 2);
  game.setInCar(true);
  game.setCamera({ mode: 'follow', yaw: Math.PI / 2, pitch: 0.18, distance: 9.5 });
  game.setObjective(MISSIONS[0].objective);
}
