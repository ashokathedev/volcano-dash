import {
  Entity,
  RigidBodyType,
  ColliderShape,
  BlockType,
  PlayerEntity,
  World,
  SceneUI,
  Audio,
  type PlayerCameraOrientation
} from 'hytopia';

// Types for tracking state
interface PowerUpState {
  playerScoreMultipliers: Record<number, number>;
  playerSuperChargesUsed: Record<number, Set<string>>;
  playerChargingState: Record<number, boolean>;
  playerScore: Record<number, number>;
}

export function spawnHeatCluster(
  world: World, 
  position: { x: number, y: number, z: number }, 
  clusterId: string,
  state: PowerUpState
) {
  const heatCluster = new Entity({
    name: 'Heat Cluster',
    modelUri: 'models/volcano-dash/energyCluster.gltf',
    modelLoopedAnimations: ['idle'],
    modelScale: 1.5,
    opacity: 0.5,
    rigidBodyOptions: {
      type: RigidBodyType.KINEMATIC_POSITION,
      colliders: [
        {
          shape: ColliderShape.CYLINDER,
          radius: 1,
          halfHeight: 1,
          isSensor: true,
          onCollision: (other: BlockType | Entity, started: boolean) => {
            if (other instanceof PlayerEntity) {
              const playerId = other.id!;
              
              // Initialize multiplier if needed
              if (!state.playerScoreMultipliers[playerId]) {
                state.playerScoreMultipliers[playerId] = 1;
              }

              if (started) {
                state.playerScoreMultipliers[playerId] = 10;
                other.player.ui.sendData({
                  type: 'multiplierActive',
                  multiplier: 10
                });
                
                // Send heat cluster notification
                other.player.ui.sendData({
                  type: 'heatClusterStatus',
                  active: true,
                  message: 'Stay in the heat cluster to absorb energy faster'
                });
              } else {
                state.playerScoreMultipliers[playerId] = 1;
                other.player.ui.sendData({
                  type: 'multiplierInactive'
                });
                // Clear heat cluster notification
                other.player.ui.sendData({
                  type: 'heatClusterStatus',
                  active: false
                });
              }
            }
          }
        }
      ],
    },
  });

  heatCluster.spawn(world, position);
  heatCluster.setTintColor({ r: 255, g: 100, b: 0 });
}

export function spawnSuperCharge(
  world: World, 
  position: { x: number, y: number, z: number }, 
  chargeId: string,
  state: PowerUpState
) {
  const superCharge = new Entity({
    name: 'Super Charge',
    modelUri: 'models/volcano-dash/superChargeStation.gltf',
    modelLoopedAnimations: ['idle'],
    modelScale: 1,
    rigidBodyOptions: {
      type: RigidBodyType.KINEMATIC_POSITION,
      colliders: [
        {
          shape: ColliderShape.CYLINDER,
          radius: 1,
          halfHeight: 1,
          isSensor: true,
          onCollision: (other: BlockType | Entity, started: boolean) => {
            if (other instanceof PlayerEntity) {
              const playerEntity = other;
              const playerId = playerEntity.id!;
              
              if (!state.playerSuperChargesUsed[playerId]) {
                state.playerSuperChargesUsed[playerId] = new Set();
              }

              if (started) {
                if (state.playerSuperChargesUsed[playerId].has(chargeId)) {
                  playerEntity.player.ui.sendData({
                    type: 'superChargeState',
                    state: 'alreadyUsed'
                  });
                  return;
                }

                playerEntity.player.ui.sendData({
                  type: 'superChargeState',
                  state: 'enter'
                });

                let isCharging = false;
                let chargeInterval: NodeJS.Timer | null = null;

                const originalHandler = playerEntity.controller!.onTickWithPlayerInput;

                playerEntity.controller!.onTickWithPlayerInput = (
                  entity: PlayerEntity, 
                  input: Partial<Record<string | number | symbol, boolean>>,
                  cameraOrientation: PlayerCameraOrientation,
                  deltaTimeMs: number
                ) => {
                  if (originalHandler) {
                    originalHandler(entity, input, cameraOrientation, deltaTimeMs);
                  }

                  if (input.f && !isCharging && !state.playerSuperChargesUsed[playerId].has(chargeId) && !state.playerChargingState[playerId]) {
                    isCharging = true;
                    state.playerChargingState[playerId] = true;
                    superCharge.stopModelAnimations(['idle']);
                    superCharge.startModelLoopedAnimations(['charging']);
                    let chargeTime = 0;
                    
                    chargeInterval = setInterval(() => {
                      chargeTime += 100;
                      const progress = Math.min((chargeTime / 3000) * 100, 100);
                      
                      playerEntity.player.ui.sendData({
                        type: 'superChargeState',
                        state: 'charging',
                        progress: progress
                      });
                      
                      if (progress >= 100) {
                        if (chargeInterval) {
                          clearInterval(chargeInterval);
                          chargeInterval = null;
                        }
                        state.playerScore[playerId] = Math.floor(state.playerScore[playerId] * 2);
                        state.playerSuperChargesUsed[playerId].add(chargeId);
                        isCharging = false;
                        state.playerChargingState[playerId] = false;
                        superCharge.stopModelAnimations(['charging']);
                        superCharge.startModelLoopedAnimations(['idle']);
                        
                        playerEntity.player.ui.sendData({
                          type: 'superChargeState',
                          state: 'complete'
                        });
                      }
                    }, 100);
                  } else if (!input.f && isCharging) {
                    if (chargeInterval) {
                      clearInterval(chargeInterval);
                      chargeInterval = null;
                    }
                    isCharging = false;
                    state.playerChargingState[playerId] = false;
                    superCharge.stopModelAnimations(['charging']);
                    superCharge.startModelLoopedAnimations(['idle']);
                    
                    playerEntity.player.ui.sendData({
                      type: 'superChargeState',
                      state: 'reset'
                    });
                  }
                };
              } else {
                playerEntity.player.ui.sendData({
                  type: 'superChargeState',
                  state: 'exit'
                });
              }
            }
          }
        }
      ],
    }
  });

  superCharge.spawn(world, position);
} 