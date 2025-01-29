/**
 Volcano 
 */

import {
  CollisionGroup,
  ColliderShape,
  BlockType,
  Entity,
  SceneUI,
  startServer,
  Player,
  PlayerEntity,
  RigidBodyType,
  SimpleEntityController,
  World,
  Collider,
  Audio,
  PlayerCamera,
  PlayerCameraMode,
  SceneUIManager,
} from 'hytopia';

// Declare playerNames at the very top, before any other code
declare global {
  var playerNames: Record<number, string>;
}
if (!global.playerNames) {
  global.playerNames = {};
}

import worldMap from './assets/maps/terrain.json';

// Game Config

  const GAME_CONFIG = {
    START_DELAY: 15,
    POSITIONS: {
      ARENA: { x: 14, y: 5, z: -12}, // Arena Spawn Point
      JOIN_NPC: { x: -20, y: 5, z: 4 }, // Join NPC Spawn Point
      LOBBY: { x: 0, y: 4, z: 0 }, // Lobby ReSpawn Point
      GAME_JOIN: { x: -33, y: 4, z: 1 }, // Game Join Spawn Point
    },
    SUPER_CHARGES: [
      { id: 'charge1', position: { x: 15, y: 7, z: 10 } },
      { id: 'charge2', position: { x: -10, y: 2, z: -10 } },
      { id: 'charge3', position: { x: 15, y: 2, z: -15 } }
    ],
    HEAT_CLUSTERS: [
      { id: 'cluster1', position: { x: 15, y: 8, z: -4 } }, // Level A Front
      { id: 'cluster2', position: { x: 15, y: 8, z: -22 } }, // Level A Back
      { id: 'cluster3', position: { x: 0, y: 2, z: 0 } } 
    ]
  };

// Game State

const QUEUED_PLAYER_ENTITIES = new Set<PlayerEntity>(); 
const GAME_PLAYER_ENTITIES = new Set<PlayerEntity>();
const ACTIVE_PLAYERS = new Set<PlayerEntity>();  // Track players still in the game
const playerHeatIntervals: Record<number, NodeJS.Timer> = {};
const playerNames: Record<number, string> = {};

let gameState: 'awaitingPlayers' | 'starting' | 'inProgress' = 'awaitingPlayers';
let gameCountdownStartTime: number | null = null;
let gameStartTime: number | null = null;
let gameUiState: object = {};

// Add these to your player state tracking
const playerScoreMultipliers: Record<number, number> = {};
const playerSuperChargesUsed: Record<number, Set<string>> = {};

// Add this at the top with other global variables
const superChargeProgresses: Record<string, number> = {};

// Add these to track both leaderboard types
const lastShiftLeaders: Array<{name: string, score: number}> = [];
const allTimeLeaders: Array<{name: string, score: number}> = [];

startServer(world => {
  
  // Enable debug rendering of the physics simulation.
  // world.simulation.enableDebugRendering(true);

  // Load Map

  world.loadMap(worldMap); //load map
  world.onPlayerJoin = player => onPlayerJoin(world, player);
  world.onPlayerLeave = player => onPlayerLeave(world, player);
  spawnJoinNpc(world);
  
  // Spawn heat clusters at each position
  GAME_CONFIG.HEAT_CLUSTERS.forEach(cluster => {
    spawnHeatCluster(world, cluster.position, cluster.id);
  });

  // Spawn super charges at each position
  GAME_CONFIG.SUPER_CHARGES.forEach(charge => {
    spawnSuperCharge(world, charge.position, charge.id);
  });

  // Constants 
  const arenaSpawnPoint = GAME_CONFIG.POSITIONS.ARENA; // Spawn point for players in lava arena
const lobbySpawnPoint = { x: -33, y: 4, z: 1 }; // Spawn point for lobby
const maxHeatLevel = 1000;
const lavaHeatIncrease = 20;
const lavaHeatIncreaseRate = 100;
const chamberHeatIncrease = 1;
const chamberHeatIncreaseRate = 100;
const scoreRate = 1;
const scoreInterval = 10;

// Simple game state tracking via globals.
const playerHeatLevel: Record<number, number> = {};
const playerInLava: Record<number, boolean> = {};
const playerScore: Record<number, number> = {};
let playerTopScore: Record<number, number> = {};
let playerCount = 0; // Number of players in the game


// LAVA ARENA VARIABLES **************************************************************************************

const lavaStartX = 14;
const lavaStartZ = -14;
const lavaY = -12;
const lavaMaxHeight = 5;
const lavaRiseSpeed = 2000; // 1000ms = 1 second
let currentFillHeight = lavaY;

// Add these new variables
const LAVA_HALF_EXTENT_X = 11;
const LAVA_HALF_EXTENT_Y = 12;
const LAVA_HALF_EXTENT_Z = 11;

//let inLava = false;


// Player Functions **************************************************************************************

function onPlayerJoin(world: World, player: Player) {
    const playerEntity = new PlayerEntity({
      player,
      name: 'Player',
      modelUri: 'models/players/player.gltf',
      modelLoopedAnimations: ['idle'],
      modelScale: 0.5,
    });

    console.log('Player joined with username:', player.username);

    // Update the interval that sends player state
    const stateInterval = setInterval(() => {
      if (!playerEntity.isSpawned || !playerEntity.id) {
        clearInterval(stateInterval);
        return;
      }

      player.ui.sendData({
        type: 'updatePlayerState',
        heatLevel: playerHeatLevel[playerEntity.id] ?? 1,
        inLava: playerInLava[playerEntity.id] ?? false,
        score: playerScore[playerEntity.id] ?? 0,
        topScore: playerTopScore[playerEntity.id] ?? 0,
        playerName: player.username, // Use the built-in username
        playerId: playerEntity.id,
        lastShiftLeaders,
        allTimeLeaders
      });
    }, 100);

    // Load the UI
    player.ui.load('ui/index.html');

    // Setup a first person camera for the player
  
    player.camera.setMode(PlayerCameraMode.FIRST_PERSON); // set first person mode 
    player.camera.setOffset({ x: 0, y: 0.4, z: 0 }); // shift camera up on Y axis so we see from "head" perspective. 
    player.camera.setModelHiddenNodes(['head', 'neck']); // hide the head node from the model so we don't see it in the camera
    player.camera.setForwardOffset(0.3); // Shift the camera forward so we are looking slightly in front of player
  

     // Increment player count

    playerCount++;

    // Respawn player at heatLevel max

    playerEntity.onTick = () => {
      if (playerHeatLevel[playerEntity.id!] >= maxHeatLevel) {
        overHeat(playerEntity);
      }
    };

    // Spawn to lobby
    playerEntity.spawn(world, GAME_CONFIG.POSITIONS.LOBBY);
  }

  //   * Despawn the player's entity and perform any other + cleanup when they leave the game. 
  function onPlayerLeave(world: World, player: Player) {
    world.entityManager.getAllPlayerEntities().forEach((entity: PlayerEntity) => {
      if (QUEUED_PLAYER_ENTITIES.has(entity)) {
        QUEUED_PLAYER_ENTITIES.delete(entity);
      }
      // Clear any existing heat intervals
      if (playerHeatIntervals[entity.id!]) {
        clearInterval(playerHeatIntervals[entity.id!]);
        delete playerHeatIntervals[entity.id!];
      }
      if (entity.id !== undefined) {
        console.log(`Cleaning up player ${entity.id}, name was:`, playerNames[entity.id]);
        delete playerNames[entity.id];
      }
      delete playerScoreMultipliers[entity.id!];
      delete playerSuperChargesUsed[entity.id!];
      overHeat(entity);
      entity.despawn();
    });
    
    playerCount--;
  }

  function spawnJoinNpc(world: World) {
    const joinNpc = new Entity({
      name: 'Join NPC',
      modelUri: 'models/npcs/mindflayer.gltf',
      modelLoopedAnimations: ['idle'],
      modelScale: 0.6,
      rigidBodyOptions: {
        enabledPositions: { x: false, y: true, z: false },
        enabledRotations: { x: true, y: true, z: true },
        colliders: [
          Collider.optionsFromModelUri('models/npcs/mindflayer.gltf', 0.6),
          {
            shape: ColliderShape.CYLINDER,
            radius: 2,
            halfHeight: 2,
            isSensor: true,
            onCollision: (other: BlockType | Entity, started: boolean) => {
              if (other instanceof PlayerEntity && started) {
                addPlayerEntityToQueue(world, other);
              }
            }
          }
        ],
      },
    });
  
    joinNpc.spawn(world, GAME_CONFIG.POSITIONS.JOIN_NPC, { x: 0, y: 3, z: 0, w: 3 });
  
    const npcMessageUI = new SceneUI({
      templateId: 'join-npc-message',
        attachedToEntity: joinNpc,
       offset: { x: 0, y: 2.5, z: 0 },
     });
   
     npcMessageUI.load(world);
  }

  // Heat Cluster ***************************************************************

function spawnHeatCluster(world: World, position: { x: number, y: number, z: number }, clusterId: string) {
  const heatCluster = new Entity({
    name: 'Heat Cluster',
    modelUri: 'models/structures/jump-pad.gltf',
    modelLoopedAnimations: ['idle'],
    modelScale: 1,
    rigidBodyOptions: {
      type: RigidBodyType.KINEMATIC_POSITION,
      colliders: [
        {
          shape: ColliderShape.CYLINDER,
          radius: 2,
          halfHeight: 2,
          isSensor: true,
          onCollision: (other: BlockType | Entity, started: boolean) => {
            if (other instanceof PlayerEntity) {
              const playerId = other.id!;
              
              // Initialize multiplier if needed
              if (!playerScoreMultipliers[playerId]) {
                playerScoreMultipliers[playerId] = 1;
              }

              if (started) {
                console.log(`Player ${playerId} entered heat cluster. Setting multiplier to 10`);
                playerScoreMultipliers[playerId] = 10;
                other.player.ui.sendData({
                  type: 'multiplierActive',
                  multiplier: 10
                });
              } else {
                console.log(`Player ${playerId} left heat cluster. Resetting multiplier to 1`);
                playerScoreMultipliers[playerId] = 1;
                other.player.ui.sendData({
                  type: 'multiplierInactive'
                });
              }
              
              // Debug log current multiplier
              console.log(`Current multiplier for player ${playerId}: ${playerScoreMultipliers[playerId]}`);
            }
          }
        }
      ],
    },
  });

  heatCluster.spawn(world, position);

  const heatClusterUI = new SceneUI({
    templateId: 'heatCluster',
    attachedToEntity: heatCluster,
    offset: { x: 0, y: 2.5, z: 0 },
  });
 
  heatClusterUI.load(world);
}

  function addPlayerEntityToQueue(world: World, playerEntity: PlayerEntity) {
    if (QUEUED_PLAYER_ENTITIES.has(playerEntity)) return;
    
    QUEUED_PLAYER_ENTITIES.add(playerEntity);
    //console.log("Player added to queue. Queue size:", QUEUED_PLAYER_ENTITIES.size); // Debug log
    world.chatManager.sendPlayerMessage(playerEntity.player, 'You have joined the next game queue!', '00FF00');
  
    if (gameState === 'awaitingPlayers' && QUEUED_PLAYER_ENTITIES.size >= 1) {
      queueGame(world);
    }
  
    const queuedSceneUi = new SceneUI({
      templateId: 'player-queued',
      attachedToEntity: playerEntity,
      offset: { x: 0, y: 1, z: 0 },
    });
  
    queuedSceneUi.load(world);
  }
  
  function queueGame(world: World) {
    gameState = 'starting';
    gameCountdownStartTime = Date.now();

    console.log("Queue game started, countdown beginning..."); // Debug log

    // Start countdown updates
    const countdownInterval = setInterval(() => {
      const now = Date.now();
      const timeLeft = GAME_CONFIG.START_DELAY * 1000 - (now - (gameCountdownStartTime || 0));
      const secondsLeft = Math.max(0, Math.ceil(timeLeft / 1000));
      
      console.log("Countdown update, seconds left:", secondsLeft); // Debug log
      
      QUEUED_PLAYER_ENTITIES.forEach(playerEntity => {
        playerEntity.player.ui.sendData({
          type: 'countdownUpdate',
          seconds: secondsLeft,
          shouldFade: secondsLeft <= 2  // Add flag for fading
        });
      });

      if (secondsLeft <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);

    setTimeout(() => {
      QUEUED_PLAYER_ENTITIES.forEach(playerEntity => {
        playerEntity.setPosition(GAME_CONFIG.POSITIONS.ARENA);
        GAME_PLAYER_ENTITIES.add(playerEntity);

        world.sceneUIManager.getAllEntityAttachedSceneUIs(playerEntity).forEach(sceneUi => {
          sceneUi.unload();
        });
      });

      QUEUED_PLAYER_ENTITIES.clear();
      startGame(world);
    }, GAME_CONFIG.START_DELAY * 1000);
  }


  // Start Game (Shift) Function *******************************************************************************************************

function spawnSuperCharge(world: World, position: { x: number, y: number, z: number }, chargeId: string) {
  const superCharge = new Entity({
    name: 'Super Charge',
    modelUri: 'models/items/clock.gltf',
    modelLoopedAnimations: ['idle'],
    modelScale: 0.8,
    rigidBodyOptions: {
      type: RigidBodyType.KINEMATIC_POSITION,
      colliders: [
        {
          shape: ColliderShape.CYLINDER,
          radius: 2,
          halfHeight: 2,
          isSensor: true,
          onCollision: (other: BlockType | Entity, started: boolean) => {
            if (other instanceof PlayerEntity) {
              const playerEntity = other;
              const playerId = playerEntity.id!;
              
              if (!playerSuperChargesUsed[playerId]) {
                playerSuperChargesUsed[playerId] = new Set();
              }

              if (started) {
                if (playerSuperChargesUsed[playerId].has(chargeId)) {
                  playerEntity.player.ui.sendData({
                    type: 'superChargeState',
                    state: 'alreadyUsed'
                  });
                  return;
                }

                console.log('Sending enter state');
                playerEntity.player.ui.sendData({
                  type: 'superChargeState',
                  state: 'enter'
                });

                let isCharging = false;
                let chargeInterval: NodeJS.Timer | null = null;
                let lastInputHadF = false;
                
                playerEntity.controller!.onTickWithPlayerInput = (entity, input) => {
                  if (input.f && !isCharging && !playerSuperChargesUsed[playerId].has(chargeId)) {
                    // Start charging when F is first pressed
                    console.log('F pressed, starting charge');
                    isCharging = true;
                    let chargeTime = 0;
                    
                    chargeInterval = setInterval(() => {
                      chargeTime += 100;
                      const progress = Math.min((chargeTime / 3000) * 100, 100);
                      
                      console.log(`Charging: ${progress}%`);
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
                        playerScore[playerId] *= 2;
                        playerSuperChargesUsed[playerId].add(chargeId);
                        isCharging = false;
                        
                        console.log('Charge complete');
                        playerEntity.player.ui.sendData({
                          type: 'superChargeState',
                          state: 'complete'
                        });
                        
                        playerEntity.controller!.onTickWithPlayerInput = undefined;
                      }
                    }, 100);
                  } else if (!input.f && isCharging) {
                    // Reset if F is released during charging
                    console.log('F released, resetting charge');
                    if (chargeInterval) {
                      clearInterval(chargeInterval);
                      chargeInterval = null;
                    }
                    isCharging = false;
                    
                    playerEntity.player.ui.sendData({
                      type: 'superChargeState',
                      state: 'reset'
                    });
                  }
                  lastInputHadF = input.f === true;
                };
              } else {
                console.log('Sending exit state');
                if (playerEntity.controller) {
                  playerEntity.controller.onTickWithPlayerInput = undefined;
                }
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

function startGame (world: World) {

  
  
  gameState = 'inProgress';
  gameStartTime = Date.now();

  //console.log("Game player entities size:", GAME_PLAYER_ENTITIES.size); // Debug check

  // Initialize active players
  GAME_PLAYER_ENTITIES.forEach(playerEntity => {
    ACTIVE_PLAYERS.add(playerEntity);
   // console.log("Added player to active players:", playerEntity.player.username); // Debug each add
    
    // Reset player state for new game
    playerHeatLevel[playerEntity.id!] = 1;
    playerInLava[playerEntity.id!] = false;
    if (playerHeatIntervals[playerEntity.id!]) {
      clearInterval(playerHeatIntervals[playerEntity.id!]);
      delete playerHeatIntervals[playerEntity.id!];
    }
  });

 // console.log("Active players after initialization:", ACTIVE_PLAYERS.size); // Debug final count

  // Reset player score to 0
  ACTIVE_PLAYERS.forEach(playerEntity => {
    const playerId = playerEntity.id!;
    playerScore[playerId] = 0;
    playerScoreMultipliers[playerId] = 1; // Reset multiplier at game start
  });

 // console.log("Starting game with players:", ACTIVE_PLAYERS.size); // Debug log

  // Start score accumulation
  updateScore();

  // Start chamber heat accumulation
  function updateChamberHeat() {
    const chamberHeatInterval = setInterval(() => {
      if (ACTIVE_PLAYERS.size > 0 && gameState === 'inProgress') {
        ACTIVE_PLAYERS.forEach(playerEntity => {
          playerHeatLevel[playerEntity.id!] += chamberHeatIncrease;
          console.log(`Chamber Heat Rising for ${playerEntity.player.username}! Current Heat Level: ${playerHeatLevel[playerEntity.id!]}`);
          
          // Check for overheat
          if (playerHeatLevel[playerEntity.id!] >= maxHeatLevel) {
            overHeat(playerEntity);
          }
        });
      } else {
        clearInterval(chamberHeatInterval);
      }
    }, chamberHeatIncreaseRate);
  }

  updateChamberHeat();

  function updateScore() {
   const scoreIntervaltoClear = setInterval(() => {
     if (ACTIVE_PLAYERS.size > 0 && gameState === 'inProgress') {
       ACTIVE_PLAYERS.forEach(playerEntity => {
         const playerId = playerEntity.id!;
         if (!playerScore[playerId]) {
           playerScore[playerId] = 0;
         }
         if (!playerScoreMultipliers[playerId]) {
           playerScoreMultipliers[playerId] = 1;
         }
         
         // Add debug log for score updates
         const scoreIncrease = scoreRate * playerScoreMultipliers[playerId];
         playerScore[playerId] += scoreIncrease;
         console.log(`Player ${playerId} score update: +${scoreIncrease} (multiplier: ${playerScoreMultipliers[playerId]})`);
       });
     } else {
       clearInterval(scoreIntervaltoClear);
     }
   }, scoreInterval);
  }

  // RISING LAVA  ***********************************************************************************************************************

   // Rising lava Platform Entity

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


// Create Rising Lava Platform Function

risingLava.onTick = () => {
  if (risingLava.position.y >= lavaMaxHeight) {
    risingLava.setLinearVelocity({ x: 0, y: 0, z: 0 });
    if (gameState === 'inProgress') {
      setTimeout(() => endGame(world), 10000); // 10 seconds delay
    }
  } else {
    risingLava.setLinearVelocity({ x: 0, y: 0.5, z: 0 }); // Rise until reaching max height
  }
};

// Create Rising Lava Collision Function

risingLava.onEntityCollision = (risingLava: Entity, other: Entity, started: boolean) => {
  // Only proceed if the colliding entity is a PlayerEntity
  if (!(other instanceof PlayerEntity)) return;
  
  const playerEntity = other as PlayerEntity;
  console.log(`Collision event for player ${playerEntity.player.username} (ID: ${playerEntity.id}), started: ${started}`);

  // Initialize heat level if needed
  if (!playerHeatLevel[playerEntity.id!]) {
    playerHeatLevel[playerEntity.id!] = 1;
  }

  // When player enters lava
  if (started) {
    console.log(`Player ${playerEntity.player.username} entered lava`);
    
    if (playerHeatIntervals[playerEntity.id!]) {
      clearInterval(playerHeatIntervals[playerEntity.id!]);
      delete playerHeatIntervals[playerEntity.id!];
    }
    
    playerHeatIntervals[playerEntity.id!] = setInterval(() => {
      if (playerInLava[playerEntity.id!] && ACTIVE_PLAYERS.has(playerEntity)) {
        playerHeatLevel[playerEntity.id!] += lavaHeatIncrease;
        console.log(`Heat Level Rising for ${playerEntity.player.username}! Current Heat Level: ${playerHeatLevel[playerEntity.id!]}`);
      } else {
        clearInterval(playerHeatIntervals[playerEntity.id!]);
        delete playerHeatIntervals[playerEntity.id!];
      }
    }, lavaHeatIncreaseRate);
  } else {
    console.log(`Player ${playerEntity.player.username} exited lava`);
  }

  playerInLava[playerEntity.id!] = started;
}; 

// Spawn Rising Lava Platform

risingLava.spawn(world, { x: lavaStartX+1, y: lavaY, z: lavaStartZ+1 });

  GAME_CONFIG.SUPER_CHARGES.forEach(charge => {
    spawnSuperCharge(world, charge.position, charge.id);
  });

  GAME_CONFIG.HEAT_CLUSTERS.forEach(cluster => {
    spawnHeatCluster(world, cluster.position, cluster.id);
  });

  // Clear last shift leaderboard
  lastShiftLeaders.length = 0;
}

// End Game Function *******************************************************************************************************

function endGame(world: World) {
  console.log('Game ending, current state:', gameState);
  if (gameState !== 'inProgress') return;
  
  gameState = 'awaitingPlayers';

  // Update leaderboards for all active players
  ACTIVE_PLAYERS.forEach(playerEntity => {
    console.log('Checking player for leaderboard update:', playerEntity.player.username);
    console.log('Player score:', playerScore[playerEntity.id!]);
    if (playerScore[playerEntity.id!] > 0) {
      console.log('Calling updateLeaderboards from endGame');
      updateLeaderboards(playerEntity);
    }
  });

  // Send end game message with final leaderboards
  ACTIVE_PLAYERS.forEach(playerEntity => {
    playerEntity.player.ui.sendData({
      type: 'shiftEnd',
      message: 'This Shift has Ended. Stand by for Transport.',
      lastShiftLeaders,
      allTimeLeaders
    });
  });

  // Start draining the lava
  world.entityManager.getAllEntities().forEach(entity => {
    if (entity.blockTextureUri?.includes('lava.png')) {
      // Set downward velocity (2x faster than rise speed)
      entity.setLinearVelocity({ x: 0, y: -3.0, z: 0 });
      
      // Update tick function to stop at original height
      entity.onTick = () => {
        if (entity.position.y <= lavaY) {
          entity.setLinearVelocity({ x: 0, y: 0, z: 0 });
          entity.setPosition({ x: lavaStartX, y: lavaY, z: lavaStartZ });
        }
      };
    }
  });

  // Update top scores and move players after 10 seconds
  setTimeout(() => {
    ACTIVE_PLAYERS.forEach(playerEntity => {
      console.log('End game - Current Score:', playerScore[playerEntity.id!]);
      console.log('End game - Top Score:', playerTopScore[playerEntity.id!]);
      
      if (playerScore[playerEntity.id!] > (playerTopScore[playerEntity.id!] || 0)) {
        playerTopScore[playerEntity.id!] = playerScore[playerEntity.id!];
        console.log('Updated end game top score to:', playerTopScore[playerEntity.id!]);
      }

      // Move player back to lobby
      playerEntity.setPosition(GAME_CONFIG.POSITIONS.LOBBY);
      playerHeatLevel[playerEntity.id!] = 1;
      playerInLava[playerEntity.id!] = false;
      
      // Clear any existing heat intervals
      if (playerHeatIntervals[playerEntity.id!]) {
        clearInterval(playerHeatIntervals[playerEntity.id!]);
        delete playerHeatIntervals[playerEntity.id!];
      }
    });

    // Clear game players set
    GAME_PLAYER_ENTITIES.clear();
    ACTIVE_PLAYERS.clear();  // Clear active players to stop score accumulation

    // Check for queued players to start next game
    if (QUEUED_PLAYER_ENTITIES.size >= 1) {
      queueGame(world);
    }
  }, 10000);
}


  // PLAYER RESPAWN FUNCTION *************************************************************

  function overHeat(playerEntity: PlayerEntity) {
      console.log('Player overheated:', playerEntity.player.username);
      console.log('Current score:', playerScore[playerEntity.id!]);
      
      // Clear the heat interval if it exists
      if (playerHeatIntervals[playerEntity.id!]) {
          clearInterval(playerHeatIntervals[playerEntity.id!]);
          delete playerHeatIntervals[playerEntity.id!];
      }

      playerEntity.setLinearVelocity({ x: 0, y: 0, z: 0 });
      playerEntity.setPosition(GAME_CONFIG.POSITIONS.LOBBY);
      playerHeatLevel[playerEntity.id!] = 1;
      playerInLava[playerEntity.id!] = false;
      ACTIVE_PLAYERS.delete(playerEntity);  // Remove from active players
      
      console.log('Before update - Current Score:', playerScore[playerEntity.id!]);
      console.log('Before update - Top Score:', playerTopScore[playerEntity.id!]);
      
      if (playerScore[playerEntity.id!] > (playerTopScore[playerEntity.id!] || 0)) {
          playerTopScore[playerEntity.id!] = playerScore[playerEntity.id!];
          console.log('Updated top score to:', playerTopScore[playerEntity.id!]);
      }

      // Send immediate UI update
      playerEntity.player.ui.sendData({
          type: 'updatePlayerState',
          heatLevel: playerHeatLevel[playerEntity.id!],
          inLava: playerInLava[playerEntity.id!],
          score: playerScore[playerEntity.id!],
          topScore: playerTopScore[playerEntity.id!]
      });

      if (playerScore[playerEntity.id!] > 0) {
        console.log('Calling updateLeaderboards from overHeat');
        updateLeaderboards(playerEntity);
      }
  }

  // AUDIO STUFF **************************************************************************************


  new Audio({
    uri: 'audio/music/outworld-theme.mp3', 
    loop: true,
    volume: 0.3,
  }).play(world);

  // Add this new function to update leaderboards
  function updateLeaderboards(playerEntity: PlayerEntity) {
    const entry = {
        name: playerEntity.player.username,
        score: playerScore[playerEntity.id!]
    };
    
    // Update last shift leaderboard
    lastShiftLeaders.push({
        name: entry.name,
        score: entry.score
    });
    lastShiftLeaders.sort((a, b) => b.score - a.score);
    if (lastShiftLeaders.length > 10) lastShiftLeaders.length = 10;

    // Update all time leaderboard
    const existingIndex = allTimeLeaders.findIndex(e => e.name === entry.name);
    if (existingIndex >= 0) {
        if (entry.score > allTimeLeaders[existingIndex].score) {
            allTimeLeaders[existingIndex] = {
                name: entry.name,
                score: entry.score
            };
        }
    } else {
        allTimeLeaders.push({
            name: entry.name,
            score: entry.score
        });
    }
    allTimeLeaders.sort((a, b) => b.score - a.score);
    if (allTimeLeaders.length > 10) allTimeLeaders.length = 10;

    // Send updated leaderboards to ALL players in the game
    world.entityManager.getAllPlayerEntities().forEach((entity: PlayerEntity) => {
      entity.player.ui.sendData({
        type: 'updateLeaderboards',
        lastShiftLeaders,
        allTimeLeaders
      });
    });
  }

  

  // Course Platforms **************************************************************************************

  // Level A Course Platforms ***********************************************

  const lvlAheight = 2;
  const lvlA = [
    // Ground level (y=lvlAheight)
    [1,lvlAheight,1,107], [1,lvlAheight,0,107], [0,lvlAheight,0,107], [0,lvlAheight,1,107],
    [2,lvlAheight,2,106], [2,lvlAheight,1,106], [2,lvlAheight,0,106], [2,lvlAheight,-1,106], [1,lvlAheight,-1,106], [0,lvlAheight,-1,106],
    [-1,lvlAheight,-1,106], [-1,lvlAheight,0,106], [-1,lvlAheight,1,106], [-1,lvlAheight,2,106], [0,lvlAheight,2,106], [1,lvlAheight,2,106],
    [3,lvlAheight,3,104], [3,lvlAheight,2,104], [3,lvlAheight,1,104], [3,lvlAheight,0,104], [3,lvlAheight,-1,104], [3,lvlAheight,-2,104],
    [2,lvlAheight,-2,104], [1,lvlAheight,-2,104], [0,lvlAheight,-2,104], [-1,lvlAheight,-2,104], [-2,lvlAheight,-2,104],
    [2,lvlAheight,3,104], [1,lvlAheight,3,104], [0,lvlAheight,3,104], [-1,lvlAheight,3,104], [-2,lvlAheight,3,104],
    [-2,lvlAheight,2,104], [-2,lvlAheight,1,104], [-2,lvlAheight,0,104], [-2,lvlAheight,-1,104],
    [5,lvlAheight,-5,104], [6,lvlAheight,-5,104], [9,lvlAheight,-5,104], [10,lvlAheight,-5,104],
    [10,lvlAheight,2,104], [10,lvlAheight,1,104], [10,lvlAheight,0,104], [10,lvlAheight,-1,104],
    [9,lvlAheight,2,104], [9,lvlAheight,1,104], [9,lvlAheight,0,104], [9,lvlAheight,-1,104],
    [6,lvlAheight,5,104], [6,lvlAheight,7,104], [6,lvlAheight,6,104], [7,lvlAheight,6,104],
    [7,lvlAheight,5,104], [5,lvlAheight,5,104], [5,lvlAheight,6,104], [5,lvlAheight,7,104],
    [1,lvlAheight,10,104], [2,lvlAheight,10,104], [0,lvlAheight,10,104], [-1,lvlAheight,10,104],
    [2,lvlAheight,9,104], [1,lvlAheight,9,104], [0,lvlAheight,9,104], [-1,lvlAheight,9,104],
    [-5,lvlAheight,6,104], [-4,lvlAheight,6,104], [-4,lvlAheight,5,104], [-5,lvlAheight,5,104],
    [-9,lvlAheight,5,104], [-8,lvlAheight,5,104], [-8,lvlAheight,6,104], [-9,lvlAheight,6,104],
    [-9,lvlAheight,2,104], [-9,lvlAheight,1,104], [-9,lvlAheight,0,104], [-9,lvlAheight,-1,104],
    [-8,lvlAheight,-1,104], [-8,lvlAheight,0,104], [-8,lvlAheight,1,104], [-8,lvlAheight,2,104],
    [-6,lvlAheight,-5,104], [-5,lvlAheight,-5,104], [-5,lvlAheight,-6,104], [-4,lvlAheight,-6,104],
    [-4,lvlAheight,-5,104], [-4,lvlAheight,-4,104], [-5,lvlAheight,-4,104], [-6,lvlAheight,-4,104],
    [2,lvlAheight,-8,104], [1,lvlAheight,-8,104], [0,lvlAheight,-8,104], [-1,lvlAheight,-8,104],
    [-1,lvlAheight,-9,104], [0,lvlAheight,-9,104], [1,lvlAheight,-9,104], [2,lvlAheight,-9,104],
    [5,lvlAheight,-4,104], [6,lvlAheight,-4,104], [9,lvlAheight,-4,104], [10,lvlAheight,-4,104],

    // First layer (y=lvlAheight+1)
    [-9,lvlAheight+1,-9,107], [-9,lvlAheight+1,-8,107], [-8,lvlAheight+1,-9,107], [-8,lvlAheight+1,-8,107],
    [-7,lvlAheight+1,-9,107], [-7,lvlAheight+1,-8,107], [-9,lvlAheight+1,-7,107], [-8,lvlAheight+1,-7,107],
    [-7,lvlAheight+1,-7,107], [9,lvlAheight+1,-9,107], [10,lvlAheight+1,-9,107], [10,lvlAheight+1,-8,107],
    [9,lvlAheight+1,-8,107], [8,lvlAheight+1,-9,107], [8,lvlAheight+1,-8,107], [8,lvlAheight+1,-7,107],
    [9,lvlAheight+1,-7,107], [10,lvlAheight+1,-7,107], [9,lvlAheight+1,10,107], [9,lvlAheight+1,9,107],
    [10,lvlAheight+1,9,107], [10,lvlAheight+1,10,107], [8,lvlAheight+1,10,107], [8,lvlAheight+1,9,107],
    [10,lvlAheight+1,8,107], [9,lvlAheight+1,8,107], [8,lvlAheight+1,8,107], [-9,lvlAheight+1,9,107],
    [-8,lvlAheight+1,9,107], [-8,lvlAheight+1,10,107], [-9,lvlAheight+1,10,107], [-7,lvlAheight+1,10,107],
    [-7,lvlAheight+1,9,107], [-7,lvlAheight+1,8,107], [-9,lvlAheight+1,8,107], [-8,lvlAheight+1,8,107],

    // Second layer (y=lvlAheight+2)
    [6,lvlAheight+2,-9,101], [6,lvlAheight+2,-8,101], [-5,lvlAheight+2,-9,101], [-5,lvlAheight+2,-8,101],
    [-5,lvlAheight+2,10,101], [-5,lvlAheight+2,9,101], [6,lvlAheight+2,10,101], [6,lvlAheight+2,9,101],

    // Third layer (y=lvlAheight+3)
    [5,lvlAheight+3,-9,101], [5,lvlAheight+3,-8,101], [-4,lvlAheight+3,-9,101], [-4,lvlAheight+3,-8,101],
    [-4,lvlAheight+3,10,101], [-4,lvlAheight+3,9,101], [5,lvlAheight+3,10,101], [5,lvlAheight+3,9,101],

    // Fourth layer (y=lvlAheight+4)
    [4,lvlAheight+4,-9,101], [4,lvlAheight+4,-8,101], [3,lvlAheight+4,-9,104], [3,lvlAheight+4,-8,104],
    [2,lvlAheight+4,-8,104], [2,lvlAheight+4,-9,104], [1,lvlAheight+4,-8,101], [0,lvlAheight+4,-8,101],
    [-1,lvlAheight+4,-8,104], [-1,lvlAheight+4,-9,104], [-2,lvlAheight+4,-8,104], [-2,lvlAheight+4,-9,104],
    [-3,lvlAheight+4,-8,101], [-3,lvlAheight+4,-9,101], [1,lvlAheight+4,-9,101], [0,lvlAheight+4,-9,101],
    [1,lvlAheight+4,-3,104], [0,lvlAheight+4,-3,104], [1,lvlAheight+4,-4,104], [0,lvlAheight+4,-4,104],
    [1,lvlAheight+4,-5,104], [0,lvlAheight+4,-5,104], [1,lvlAheight+4,-6,104], [0,lvlAheight+4,-6,104],
    [1,lvlAheight+4,-7,104], [0,lvlAheight+4,-7,104], [1,lvlAheight+4,-2,104], [0,lvlAheight+4,-2,104],
    [1,lvlAheight+4,3,104], [0,lvlAheight+4,3,104], [1,lvlAheight+4,8,104], [0,lvlAheight+4,8,104],
    [1,lvlAheight+4,7,104], [0,lvlAheight+4,7,104], [1,lvlAheight+4,6,104], [0,lvlAheight+4,6,104],
    [1,lvlAheight+4,5,104], [0,lvlAheight+4,5,104], [1,lvlAheight+4,4,104], [0,lvlAheight+4,4,104],
    [0,lvlAheight+4,9,101], [1,lvlAheight+4,9,101], [0,lvlAheight+4,10,101], [1,lvlAheight+4,10,101],
    [2,lvlAheight+4,9,104], [2,lvlAheight+4,10,104], [3,lvlAheight+4,9,104], [3,lvlAheight+4,10,104],
    [-1,lvlAheight+4,9,104], [-1,lvlAheight+4,10,104], [-2,lvlAheight+4,9,104], [-2,lvlAheight+4,10,104],
    [-3,lvlAheight+4,10,101], [-3,lvlAheight+4,9,101], [4,lvlAheight+4,10,101], [4,lvlAheight+4,9,101]
];

lvlA.forEach(([x, y, z, blockId]) => {
  world.chunkLattice.setBlock({ 
    x: lavaStartX + x, 
    y, 
    z: lavaStartZ + z 
  }, blockId);
});

// Level A Center Moving Platforms ****************************************************************


const lvlAMovingPlatform1 = new Entity({
  blockTextureUri: 'blocks/moltenRock.png', // A texture URI without a file extension will use a folder and look for the textures for each face in the folder (-x.png, +x.png, -y.png, +y.png, -z.png, +z.png)
  blockHalfExtents: { x: 2, y: 0.5, z: 1 },
  rigidBodyOptions: {
    type: RigidBodyType.KINEMATIC_VELOCITY, // Kinematic means platform won't be effected by external physics, including gravity
    linearVelocity: { x: 3, y: 0, z: 0 }, // A starting velocity that won't change because it's kinematic
  },
});

// Clamp the z range the platform moves back and forth between
lvlAMovingPlatform1.onTick = lvlAMovingPlatform1 => { 
  const position = lvlAMovingPlatform1.position;

  if (position.x < 15) {
    lvlAMovingPlatform1.setLinearVelocity({ x: 3, y: 0, z: 0 });
  }

  if (position.x > 22) {
    lvlAMovingPlatform1.setLinearVelocity({ x: -3, y: 0, z: 0 });
  }
};

lvlAMovingPlatform1.spawn(world, { x: 15, y: 6, z: -14 });

const lvlAMovingPlatform2 = new Entity({
  blockTextureUri: 'blocks/moltenRock.png', // A texture URI without a file extension will use a folder and look for the textures for each face in the folder (-x.png, +x.png, -y.png, +y.png, -z.png, +z.png)
  blockHalfExtents: { x: 2, y: 0.5, z: 1 },
  rigidBodyOptions: {
    type: RigidBodyType.KINEMATIC_VELOCITY, // Kinematic means platform won't be effected by external physics, including gravity
    linearVelocity: { x: 3, y: 0, z: 0 }, // A starting velocity that won't change because it's kinematic
  },
});

// Clamp the z range the platform moves back and forth between
lvlAMovingPlatform2.onTick = lvlAMovingPlatform2 => { 
  const position = lvlAMovingPlatform2.position;

  if (position.x < 8) {
    lvlAMovingPlatform2.setLinearVelocity({ x: 3, y: 0, z: 0 });
  }

  if (position.x > 15) {
    lvlAMovingPlatform2.setLinearVelocity({ x: -3, y: 0, z: 0 });
  }
};

lvlAMovingPlatform2.spawn(world, { x: 15, y: 6, z: -12 });


    /**
   * Spawn a block entity as a moving platform
   */
    const blockVertPlatform = new Entity({
      blockTextureUri: 'blocks/moltenRock.png', // A texture URI without a file extension will use a folder and look for the textures for each face in the folder (-x.png, +x.png, -y.png, +y.png, -z.png, +z.png)
      blockHalfExtents: { x: 1.5, y: 0.5, z: 1.5 },
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC_VELOCITY, // Kinematic means platform won't be effected by external physics, including gravity
        linearVelocity: { x: 0, y:3 , z: 0 }, // A starting velocity that won't change because it's kinematic
      },
    });
  
    // Clamp the z range the platform moves back and forth between
    blockVertPlatform.onTick = blockVertPlatform => { 
      const position = blockVertPlatform.position;
  
      if (position.y < 2) {
        blockVertPlatform.setLinearVelocity({ x: 0, y: 3, z: 0 });
      }
  
      if (position.y > 6) {
        blockVertPlatform.setLinearVelocity({ x: 0, y: -3, z: 0 });
      }
    };
  
    blockVertPlatform.spawn(world, { x: 22, y: 15, z: -12 });




});







