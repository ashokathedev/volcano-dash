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

import worldMap from './assets/maps/boilerplate.json';

// Game Config

  const GAME_CONFIG = {
    START_DELAY: 15,
    POSITIONS: {
      ARENA: { x: 6, y: 20, z: 6 }, // Arena Spawn Point
      JOIN_NPC: { x: -20, y: 5, z: 4 }, // Join NPC Spawn Point
      LOBBY: { x: 0, y: 4, z: 0 }, // Lobby ReSpawn Point
      GAME_JOIN: { x: -33, y: 4, z: 1 }, // Game Join Spawn Point
    },
    SUPER_CHARGES: [
      { id: 'charge1', position: { x: 10, y: 2, z: 10 } },
      { id: 'charge2', position: { x: -10, y: 2, z: -10 } },
      { id: 'charge3', position: { x: 15, y: 2, z: -15 } }
    ],
    HEAT_CLUSTERS: [
      { id: 'cluster1', position: { x: 8, y: 2, z: 8 } },
      { id: 'cluster2', position: { x: -8, y: 2, z: -8 } },
      { id: 'cluster3', position: { x: 12, y: 2, z: -12 } }
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

const lavaStartX = 8;
const lavaStartZ = 8;
const lavaY = -10;
const lavaMaxHeight = 5;
const lavaRiseSpeed = 1750; // 1000ms = 1 second
let currentFillHeight = lavaY;

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
              
              if (started) {
                // Player entered heat cluster zone
                playerScoreMultipliers[playerId] = (playerScoreMultipliers[playerId] || 1) * 10;
                other.player.ui.sendData({
                  type: 'multiplierActive',
                  multiplier: playerScoreMultipliers[playerId]
                });
              } else {
                // Player left heat cluster zone
                playerScoreMultipliers[playerId] = playerScoreMultipliers[playerId] / 10;
                other.player.ui.sendData({
                  type: 'multiplierInactive'
                });
              }
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
                  // If already used, show message and don't setup charging
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
                
                playerEntity.controller!.onTickWithPlayerInput = (entity, input) => {
                  if (input.f && !isCharging && !playerSuperChargesUsed[playerId].has(chargeId)) {
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
                        
                        // Remove the input handler after completion
                        playerEntity.controller!.onTickWithPlayerInput = undefined;
                      }
                    }, 100);
                  }
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
    playerScore[playerEntity.id!] = 0;
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
   // console.log("Score update started"); // Debug log
    const scoreIntervaltoClear = setInterval(() => {
     // console.log("Interval triggered"); // Debug log
     // console.log("Active players:", ACTIVE_PLAYERS.size); // Check if we have active players
      
      if (ACTIVE_PLAYERS.size > 0 && gameState === 'inProgress') {  // Only update if game is in progress
        ACTIVE_PLAYERS.forEach(playerEntity => {
          const playerId = playerEntity.id!;
          if (!playerScore[playerId]) {
            playerScore[playerId] = 0;
          }
          // Apply the player's current multiplier
          const multiplier = playerScoreMultipliers[playerId] || 1;
          playerScore[playerId] += scoreRate * multiplier;
         // console.log(`Current Score for ${playerEntity.player.username}: ${playerScore[playerEntity.id!]}`);
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
   blockHalfExtents: { x: 6, y: 12, z: 6 },
   rigidBodyOptions: {
     type: RigidBodyType.KINEMATIC_VELOCITY,
     linearVelocity: { x: 0, y: 0.5, z: 0 },
     colliders: [
       {
         shape: ColliderShape.BLOCK,
         halfExtents: { x: 6, y: 12, z: 6 },
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

risingLava.spawn(world, { x: lavaStartX, y: lavaY, z: lavaStartZ });

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
});


