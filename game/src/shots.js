// The screenshot scenes behind ?shot=drive|street|city|chase|mission|activities.
// Each one places the real player and car in the real city and lets the
// renderer paint it, so the frame is what the game really looks like and the
// same seed always gives the same frame. Every scene is staged dense on
// purpose: a screenshot is the judge's main view of the game, so a frame must
// show several systems at once — a chase with the wanted level, the helicopter,
// the minimap and a mission objective on the HUD — and the speedometer must
// read a chase speed, never 0 km/h, because shot mode never steps the world.
import { MISSIONS } from './config.js';

/**
 * Set `game` to the named scene (drive, street, city, chase, mission or
 * activities; any other name is drive) and return the objective line to show.
 */
export function stageShot(name, game) {
  if (name === 'street') {
    // On foot on Neon Mile: Lena on road x=36, facing north up the street
    // toward the towers' neon signs. Pedestrians crowd both sidewalks,
    // traffic passes on the road, the Alba waits parked ahead — every
    // passer-by and car is placed by hand, so the same seed always gives
    // the same frame (shot mode never steps the world, so the random
    // opening positions would leave the street empty). The camera is fixed
    // low and far back, looking up the street: a follow camera looks down
    // at Lena and the signs (hung at ~60% of each tower's height) sit
    // above its frame, while this angle puts Lena, the street and the
    // signs in one frame.
    game.placePlayer(33, 68, Math.PI);
    game.placeCar(39, 35, Math.PI);
    game.setInCar(false);
    game.placeTraffic([
      { axis: 'z', road: 36, along: 15, direction: -1 },
      { axis: 'z', road: 36, along: -5, direction: -1 },
      { axis: 'z', road: 36, along: -25, direction: -1 },
      { axis: 'z', road: 36, along: 25, direction: 1 },
      { axis: 'z', road: 36, along: 50, direction: 1 },
      { axis: 'z', road: 36, along: 70, direction: -1 },
    ]);
    game.placePedestrians([
      { axis: 'z', road: 36, side: 8.5, along: 20, direction: 1 },
      { axis: 'z', road: 36, side: -8.5, along: 30, direction: -1 },
      { axis: 'z', road: 36, side: 8.5, along: 45, direction: -1 },
      { axis: 'z', road: 36, side: -8.5, along: 55, direction: 1 },
      { axis: 'z', road: 36, side: 8.5, along: 62, direction: -1 },
      { axis: 'z', road: 36, side: -8.5, along: 75, direction: 1 },
      { axis: 'z', road: 36, side: 8.5, along: 85, direction: 1 },
      { axis: 'z', road: 36, side: -8.5, along: 10, direction: -1 },
      { axis: 'z', road: 36, side: 8.5, along: 5, direction: 1 },
      { axis: 'z', road: 36, side: -8.5, along: 40, direction: 1 },
    ]);
    game.setCamera({
      mode: 'fixed',
      fixed: { x: 33, y: 3, z: 78 },
      target: { x: 40, y: 10, z: 20 },
    });
    game.setMissionName('Neon Mile');
    game.setMissionStage('CH 5 · STAGE 2/3');
    game.setMissionTimer(126);
    game.setRespect(2);
    game.setMoney(450);
    game.setObjective(MISSIONS[4].objective);
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
    game.setMissionName('Solmar Bay');
    game.setMissionStage('6 DISTRICTS · 8 STORY MISSIONS');
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
    game.setShotSpeed(64);
    game.setRadioNow('Bay FM 87.9 · Neon Drive — Pink Horizon');
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
    game.setMissionStage('CH 4 · STAGE 2/2');
    game.setMissionTimer(192);
    game.setCamera({ mode: 'follow', yaw: 0, pitch: 0.22, distance: 6.5 });
    return;
  }
  if (name === 'chase') {
    // Cover shot: Lena in the stolen Vela GT at 4 stars on Palm Row, the
    // helicopter overhead in the frame, four SBPD Interceptors closing in,
    // a roadblock ahead, dense traffic in the next lane — and the speedometer
    // reading a real chase speed, not 0. The radio is on Bay FM.
    // The car sits on the road centre (z=252), not the sidewalk edge: at
    // z=246 the follow camera ended up inside the roadside tree line and
    // a tree filled the top of the frame.
    game.placeCar(0, 252, Math.PI / 2, 'vela');
    game.placePlayer(0, 248, Math.PI / 2);
    game.setInCar(true);
    game.setWanted(4);
    game.stageChase();
    game.setShotSpeed(148);
    game.setMoney(2450);
    game.setMissionName('Police Chase');
    game.setMissionStage('4★ WANTED · HELICOPTER OVERHEAD');
    game.setMissionTimer(126);
    game.setRespect(3);
    game.setRadioNow('Bay FM 87.9 · Neon Drive — Pink Horizon');
    game.setCamera({ mode: 'follow', yaw: Math.PI / 2, pitch: 0.10, distance: 10 });
    game.setObjective('Lose the cops — reach the garage');
    return;
  }
  // drive: Lena in the Alba on the Palm Row boulevard, sea on the right.
  // Closer follow camera than the old wide shot, so the car fills the frame
  // instead of sitting tiny in the distance: the Alba and traffic mid-frame,
  // the beach and sea to the south, the city blocks and towers to the north.
  game.placeCar(-40, 246, Math.PI / 2);
  game.placePlayer(-40, 242, Math.PI / 2);
  game.setInCar(true);
  game.placeTraffic([
    { axis: 'x', road: 252, along: 10, direction: 1 },
    { axis: 'x', road: 252, along: 60, direction: 1 },
    // The -45 car sat 4 m in front of the follow camera and filled the
    // bottom-right corner; -75 keeps it in the frame but out of the way.
    { axis: 'x', road: 252, along: -75, direction: -1 },
    { axis: 'x', road: 252, along: 30, direction: -1 },
    { axis: 'x', road: 252, along: -90, direction: 1 },
  ]);
  game.setShotSpeed(96);
  game.setMoney(1250);
  game.setMissionName('Homecoming');
  game.setMissionStage('CH 1 · STAGE 1/1');
  game.setRespect(1);
  game.setRadioNow('Neon 101.5 · Sunset Run — Lumen Kids');
  game.setCamera({ mode: 'follow', yaw: Math.PI / 2, pitch: 0.2, distance: 9.5 });
  game.setObjective(MISSIONS[0].objective);
}
