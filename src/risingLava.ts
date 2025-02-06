import {
  Entity,
  RigidBodyType,
  ColliderShape,
  PlayerEntity,
  Audio,
  World
} from 'hytopia';

// Rising Lava Configuration
export const LAVA_RISE_VELOCITY = 0.5;        // How fast lava rises
export const LAVA_RISE_DELAY = 1;             // Time before lava starts rising (secs)
export const LAVA_Y = -17;                    // Y center point coordinate for rising lava
export const LAVA_MAX_HEIGHT = 17;            // Maximum height lava center point can rise to

// Lava Dimensions
export const LAVA_HALF_EXTENT_X = 11;         // Half width of lava area (x units from center point)
export const LAVA_HALF_EXTENT_Y = 17;         // Half height of lava area (y units from center point)
export const LAVA_HALF_EXTENT_Z = 11;         // Half depth of lava area (z units from center point)

export function initiateRisingLava(
  world: World, 
  gameState: string,
  playerHeatIntervals: Record<number, NodeJS.Timer>,
  playerInLava: Record<number, boolean>,
  playerHeatLevel: Record<number, number>,
  ACTIVE_PLAYERS: Set<PlayerEntity>,
  LAVA_HEAT_INCREASE: number,
  LAVA_HEAT_INCREASE_RATE: number,
  endGame: (world: World) => void,
  LAVA_START_X: number,
  LAVA_START_Z: number
) {
  // Create Rising Lava Platform Entity
  const risingLava = new Entity({
    blockTextureUri: 'blocks/lava/lava.png',
    blockHalfExtents: { 
      x: LAVA_HALF_EXTENT_X, 
      y: LAVA_HALF_EXTENT_Y, 
      z: LAVA_HALF_EXTENT_Z 
    },
    rigidBodyOptions: {
      type: RigidBodyType.KINEMATIC_VELOCITY,
      linearVelocity: { x: 0, y: 0.5, z: 0 },
      colliders: [
        {
          shape: ColliderShape.BLOCK,
          halfExtents: { 
            x: LAVA_HALF_EXTENT_X, 
            y: LAVA_HALF_EXTENT_Y, 
            z: LAVA_HALF_EXTENT_Z 
          },
          isSensor: true,
        },
      ],
    },
  });

  // Create Rising Lava Platform Movement
  risingLava.onTick = () => {
    if (risingLava.position.y >= LAVA_MAX_HEIGHT) {
      risingLava.setLinearVelocity({ x: 0, y: 0, z: 0 });
      if (gameState === 'inProgress') {
        setTimeout(() => endGame(world), LAVA_RISE_DELAY * 1000);
      }
    } else {
      risingLava.setLinearVelocity({ x: 0, y: LAVA_RISE_VELOCITY, z: 0 });
    }
  };

  // Create Rising Lava Collision
  risingLava.onEntityCollision = (risingLava: Entity, other: Entity, started: boolean) => {
    if (!(other instanceof PlayerEntity)) return;
    
    const playerEntity = other as PlayerEntity;
    
    if (started) {
      if (playerHeatIntervals[playerEntity.id!]) {
        clearInterval(playerHeatIntervals[playerEntity.id!]);
        delete playerHeatIntervals[playerEntity.id!];
      }
      
      playerHeatIntervals[playerEntity.id!] = setInterval(() => {
        if (playerInLava[playerEntity.id!] && ACTIVE_PLAYERS.has(playerEntity)) {
          playerHeatLevel[playerEntity.id!] += LAVA_HEAT_INCREASE;
          
          // Send near overheat warning when heat level is high
          if (playerHeatLevel[playerEntity.id!] > 750) {
            playerEntity.player.ui.sendData({
              type: 'nearOverheat',
              active: true
            });
          }
        } else {
          clearInterval(playerHeatIntervals[playerEntity.id!]);
          delete playerHeatIntervals[playerEntity.id!];
        }
      }, LAVA_HEAT_INCREASE_RATE);

      // Send lava state when player enters
      playerEntity.player.ui.sendData({
        type: 'inLava',
        active: true
      });
    } else {
      // Send lava state when player exits
      playerEntity.player.ui.sendData({
        type: 'inLava',
        active: false
      });
      
      // Clear near overheat warning if heat level drops
      if (playerHeatLevel[playerEntity.id!] <= 750) {
        playerEntity.player.ui.sendData({
          type: 'nearOverheat',
          active: false
        });
      }
    }

    playerInLava[playerEntity.id!] = started;
  };

  // Spawn Rising Lava Platform
  risingLava.spawn(world, { x: LAVA_START_X + 1, y: LAVA_Y, z: LAVA_START_Z + 1 });

  return risingLava;
}

export function drainLava(
  world: World,
  LAVA_START_X: number,
  LAVA_START_Z: number
) {
  world.entityManager.getAllEntities().forEach(entity => {
    if (entity.blockTextureUri?.includes('lava.png')) {
      entity.setLinearVelocity({ x: 0, y: -3.0, z: 0 }); // Set downward velocity
      entity.onTick = () => { // Update tick function to stop at original height                         
        if (entity.position.y <= LAVA_Y) { // Using the exported LAVA_Y constant
          entity.setLinearVelocity({ x: 0, y: 0, z: 0 });
          entity.setPosition({ x: LAVA_START_X, y: LAVA_Y, z: LAVA_START_Z });
        }
      };
    }
  });
} 