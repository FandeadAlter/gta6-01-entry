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
  if (name === 'activities') {
    // Side activities on Palm Row: Lena in the Harbor Taxi with a passenger
    // aboard, the gold fare beacon ahead, a sun postcard on the roadside,
    // traffic in the next lane, the fare line on the HUD. The taxi starts
    // well back from the destination, so the beacon reads at a distance.
    game.placeCar(-100, 246, Math.PI / 2, 'taxi');
    game.placePlayer(-100, 242, Math.PI / 2);
    game.setInCar(true);
    game.placeTraffic([
      { axis: 'x', road: 252, along: 10, direction: 1 },
      { axis: 'x', road: 252, along: 55, direction: 1 },
      { axis: 'x', road: 252, along: -70, direction: -1 },
    ]);
    game.stageActivities();
    game.setCamera({ mode: 'follow', yaw: Math.PI / 2, pitch: 0.18, distance: 9.5 });
    return;
  }
  if (name === 'mission') {
    // Mission 4, "Harbor Lights": a shootout at the Old Harbor dock — Lena
    // on foot with the pistol, three of Kaine's men ahead, health and armor
    // on the HUD, the objective and Rosa's line in the frame.
    // Lena on the road south of the intersection, facing north straight at
    // the gunmen on the open intersection — no building between camera and fight.
    game.placePlayer(-180, -192, 0);
    game.placeCar(-180, -124, Math.PI);
    game.setInCar(false);
    game.stageMissionScene();
    game.setCamera({ mode: 'follow', yaw: 0, pitch: 0.22, distance: 6.5 });
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
  game.placeTraffic([
    { axis: 'x', road: 252, along: 10, direction: 1 },
    { axis: 'x', road: 252, along: 60, direction: 1 },
  ]);
  game.setCamera({ mode: 'follow', yaw: Math.PI / 2, pitch: 0.18, distance: 9.5 });
  game.setObjective(MISSIONS[0].objective);
}
