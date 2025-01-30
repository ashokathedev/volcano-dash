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
  Quaternion,
  PlayerUI,
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
      { id: 'cluster1', position: { x: 15, y: 9, z: -4 } }, // Level A Front
      { id: 'cluster2', position: { x: 15, y: 9, z: -22 } }, // Level A Back
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

// Add new state tracking variables at the top with other game state
const INITIAL_TELEPORT_CHARGES = 3; // Number of teleport charges each player starts with
let playerTeleportCharges: Record<number, number> = {}; // Track charges per player
let playerPartners: Record<number, number> = {}; // Track player partnerships (playerId -> partnerId)
let playerPartnerSelections: Record<number, Set<number>> = {}; // Track pending partner selections during countdown

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
    modelUri: 'models/volcano-dash/gameJamPlayer.gltf',
    modelLoopedAnimations: ['idle'],
    modelScale: 0.5,
  });

  // Spawn the player first so the ID is assigned
  playerEntity.spawn(world, GAME_CONFIG.POSITIONS.LOBBY);

  // Initialize teleport charges AFTER spawn to ensure we have an ID
  playerTeleportCharges[playerEntity.id!] = INITIAL_TELEPORT_CHARGES;
  console.log('Initial teleport charges set for player:', playerEntity.id!, playerTeleportCharges[playerEntity.id!]);

  // Update the interval that sends player state
  const stateInterval = setInterval(() => {
    if (!playerEntity.isSpawned || !playerEntity.id) {
      clearInterval(stateInterval);
      return;
    }

    const playerId = playerEntity.id!;

    const stateUpdate = {
      type: 'updatePlayerState',
      heatLevel: playerHeatLevel[playerId] ?? 1,
      inLava: playerInLava[playerId] ?? false,
      score: playerScore[playerId] ?? 0,
      topScore: playerTopScore[playerId] ?? 0,
      playerName: player.username,
      playerId: playerId,
      lastShiftLeaders,
      allTimeLeaders,
      teleportCharges: playerTeleportCharges[playerId],
    };
    
    player.ui.sendData(stateUpdate);
  }, 100);

  // Set collision groups to prevent player-to-player collisions
  playerEntity.setCollisionGroupsForSolidColliders({
    belongsTo: [CollisionGroup.PLAYER],
    collidesWith: [
      CollisionGroup.BLOCK,
      CollisionGroup.ENTITY,
      CollisionGroup.ENTITY_SENSOR
    ],
  });

  // Update sensor colliders to prevent interference from other players
  playerEntity.setCollisionGroupsForSensorColliders({
    belongsTo: [CollisionGroup.ENTITY_SENSOR],
    collidesWith: [
      CollisionGroup.BLOCK,
      CollisionGroup.ENTITY
    ],
  });

  // Load the UI
  player.ui.load('ui/index.html');

  // Setup a first person camera for the player
  player.camera.setMode(PlayerCameraMode.FIRST_PERSON);
  player.camera.setOffset({ x: 0, y: 0.4, z: 0 });
  player.camera.setModelHiddenNodes(['head', 'neck']);
  player.camera.setForwardOffset(0.3);

  // Increment player count
  playerCount++;

  // Respawn player at heatLevel max
  playerEntity.onTick = () => {
    if (playerHeatLevel[playerEntity.id!] >= maxHeatLevel) {
      overHeat(playerEntity);
    }
  };

  player.ui.onData = (playerUI: PlayerUI, data: object) => {
    // Add initial debug log
    console.log('Received UI data:', data);

    if ('type' in data && 
        data.type === 'selectPartner' && 
        'partnerId' in data && 
        typeof data.partnerId === 'number') {
      
      console.log(`Player attempting to select partner. Player: ${player.username}, Selected Partner ID: ${data.partnerId}`);
      
      const playerEntity = world.entityManager.getAllPlayerEntities()
        .find((e: PlayerEntity) => e.player === player);
        
      if (playerEntity && playerEntity.id) {
        console.log(`Found player entity with ID: ${playerEntity.id}`);
        
        // Add to this player's selections
        if (!playerPartnerSelections[playerEntity.id]) {
          playerPartnerSelections[playerEntity.id] = new Set();
        }
        playerPartnerSelections[playerEntity.id].add(data.partnerId);
        
        // Find the potential partner entity to send them a notification
        const potentialPartner = Array.from(QUEUED_PLAYER_ENTITIES)
          .find(p => p.id === data.partnerId);
        
        if (potentialPartner) {
          // Send notification to the selected player
          potentialPartner.player.ui.sendData({
            type: 'partnerRequest',
            message: `${playerEntity.player.username} wants to be your partner!`
          });
        }
        
        console.log('Current partner selections:', playerPartnerSelections);
        
        // Check if both players selected each other
        if (playerPartnerSelections[data.partnerId]?.has(playerEntity.id)) {
          console.log(`Mutual selection found between ${playerEntity.id} and ${data.partnerId}`);
          
          // Create partnership
          playerPartners[playerEntity.id] = data.partnerId;
          playerPartners[data.partnerId] = playerEntity.id;
          
          console.log('Updated partnerships:', playerPartners);
          
          // Find partner entity
          const partnerEntity = Array.from(QUEUED_PLAYER_ENTITIES)
            .find(p => p.id === data.partnerId);
          
          if (partnerEntity) {
            // Notify both players of confirmed partnership
            const playerConfirmMessage = {
              type: 'partnerConfirmed',
              partnerId: data.partnerId,
              partnerName: partnerEntity.player.username,
              message: `${partnerEntity.player.username} is now your partner!`
            };
            
            const partnerConfirmMessage = {
              type: 'partnerConfirmed',
              partnerId: playerEntity.id,
              partnerName: playerEntity.player.username,
              message: `${playerEntity.player.username} is now your partner!`
            };
            
            playerEntity.player.ui.sendData(playerConfirmMessage);
            partnerEntity.player.ui.sendData(partnerConfirmMessage);
          }
        } else {
          console.log(`No mutual selection yet. Waiting for partner ${data.partnerId} to select player ${playerEntity.id}`);
        }
      }
    }
  };
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
    modelUri: 'models/projectiles/energy-orb-projectile.gltf',
    modelLoopedAnimations: ['idle'],
    modelScale: 1.5,
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
                playerScoreMultipliers[playerId] = 10;
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
                playerScoreMultipliers[playerId] = 1;
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
  
  // Maxed out red while keeping green high for brightness
  heatCluster.setTintColor({ r: 255, g: 100, b: 0 });

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
    
    world.chatManager.sendPlayerMessage(playerEntity.player, 'You have joined the next game queue!', '00FF00');
  
    if (gameState === 'awaitingPlayers' && QUEUED_PLAYER_ENTITIES.size >= 1) {
      queueGame(world);
    }
  
    // Update partner selection UI for all queued players
    if (gameState === 'starting') {
      QUEUED_PLAYER_ENTITIES.forEach(entity => {
        const playerId = entity.id!;
        
        // Get list of other players
        const availablePlayers = Array.from(QUEUED_PLAYER_ENTITIES)
          .filter(p => p.id !== playerId)
          .map(p => ({
            id: p.id,
            name: p.player.username
          }));
        
        // Initialize selection tracking if needed
        if (!playerPartnerSelections[playerId]) {
          playerPartnerSelections[playerId] = new Set();
        }
        
        // Unlock pointer for all players in queue during partner selection
        entity.player.ui.lockPointer(false);
        
        // Send updated selection UI to player
        entity.player.ui.sendData({
          type: 'partnerSelection',
          availablePlayers
        });
      });
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

    // Clear any existing partnerships and selections at queue start
    playerPartners = {};
    playerPartnerSelections = {};

    // Start partner selection for this queue
    startPartnerSelection(world);

    // Start countdown updates
    const countdownInterval = setInterval(() => {
      const now = Date.now();
      const timeLeft = GAME_CONFIG.START_DELAY * 1000 - (now - (gameCountdownStartTime || 0));
      const secondsLeft = Math.max(0, Math.ceil(timeLeft / 1000));
      
      QUEUED_PLAYER_ENTITIES.forEach(playerEntity => {
        playerEntity.player.ui.sendData({
          type: 'countdownUpdate',
          seconds: secondsLeft,
          shouldFade: secondsLeft <= 2
        });
      });

      if (secondsLeft <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);

    setTimeout(() => {
      QUEUED_PLAYER_ENTITIES.forEach(playerEntity => {
        // Send game start signal before moving players
        playerEntity.player.ui.sendData({
          type: 'gameStart'
        });
        
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
    modelUri: 'models/volcano-dash/superChargeStation.gltf',
    modelLoopedAnimations: ['idle'],
    modelScale: 0.3,
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
                    isCharging = true;
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
                        playerScore[playerId] *= 2;
                        playerSuperChargesUsed[playerId].add(chargeId);
                        isCharging = false;
                        
                        playerEntity.player.ui.sendData({
                          type: 'superChargeState',
                          state: 'complete'
                        });
                        
                        playerEntity.controller!.onTickWithPlayerInput = undefined;
                      }
                    }, 100);
                  } else if (!input.f && isCharging) {
                    // Reset if F is released during charging
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

function startGame(world: World) {
  gameState = 'inProgress';
  gameStartTime = Date.now();

  console.log('Starting game with players:', Array.from(GAME_PLAYER_ENTITIES).map(p => p.id));
  console.log('Current partnerships:', playerPartners);

  // Initialize active players
  GAME_PLAYER_ENTITIES.forEach(playerEntity => {
    const playerId = playerEntity.id!;
    console.log(`Setting up player ${playerId}...`);
    
    ACTIVE_PLAYERS.add(playerEntity);
    
    // Reset player state for new game
    playerHeatLevel[playerId] = 1;
    playerInLava[playerId] = false;
    
    console.log(`Game starting - Player ${playerId} has ${playerTeleportCharges[playerId]} charges and partner: ${playerPartners[playerId]}`);
    
    // Add teleport cooldown tracking
    const playerState = {
      lastTeleportTime: 0,
      TELEPORT_COOLDOWN: 500
    };
    
    // Set up teleport input handling
    if (playerEntity.controller) {
      playerEntity.controller.onTickWithPlayerInput = (entity, input) => {
        if (input.q) {
          console.log(`Q pressed detected for player ${playerId}`);
          
          if (gameState !== 'inProgress' || !ACTIVE_PLAYERS.has(playerEntity)) {
            console.log(`Game state or player state invalid for teleport`);
            return;
          }
          
          if (playerTeleportCharges[playerId] <= 0) {
            console.log(`No charges remaining for player ${playerId}`);
            return;
          }
          
          const now = Date.now();
          if (now - playerState.lastTeleportTime <= playerState.TELEPORT_COOLDOWN) {
            console.log(`Teleport on cooldown for player ${playerId}`);
            return;
          }
          
          const partnerId = playerPartners[playerId];
          if (!partnerId) {
            console.log(`No partner assigned for player ${playerId}`);
            return;
          }
          
          const partnerEntity = Array.from(ACTIVE_PLAYERS).find(p => p.id === partnerId);
          if (!partnerEntity) {
            console.log(`Partner entity ${partnerId} not found in active players`);
            return;
          }
          
          // All checks passed, perform teleport
          playerState.lastTeleportTime = now;
          playerTeleportCharges[playerId]--;
          
          console.log(`Teleporting player ${playerId} to partner ${partnerId} at position:`, partnerEntity.position);
          playerEntity.setPosition(partnerEntity.position);
          
          // Update UI with new charge count
          playerEntity.player.ui.sendData({
            type: 'updatePlayerState',
            heatLevel: playerHeatLevel[playerId],
            inLava: playerInLava[playerId],
            score: playerScore[playerId],
            topScore: playerTopScore[playerId],
            playerName: playerEntity.player.username,
            playerId: playerId,
            lastShiftLeaders,
            allTimeLeaders,
            teleportCharges: playerTeleportCharges[playerId],
          });
        }
      };
    } else {
      console.error(`No controller found for player ${playerId}`);
    }
  });

  // Reset player score to 0
  ACTIVE_PLAYERS.forEach(playerEntity => {
    const playerId = playerEntity.id!;
    playerScore[playerId] = 0;
    playerScoreMultipliers[playerId] = 1; // Reset multiplier at game start
  });

  // Start score accumulation
  updateScore();

  // Start chamber heat accumulation
  function updateChamberHeat() {
    const chamberHeatInterval = setInterval(() => {
      if (ACTIVE_PLAYERS.size > 0 && gameState === 'inProgress') {
        ACTIVE_PLAYERS.forEach(playerEntity => {
          playerHeatLevel[playerEntity.id!] += chamberHeatIncrease;
          
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

  // Initialize heat level if needed
  if (!playerHeatLevel[playerEntity.id!]) {
    playerHeatLevel[playerEntity.id!] = 1;
  }

  // When player enters lava
  if (started) {
    
    if (playerHeatIntervals[playerEntity.id!]) {
      clearInterval(playerHeatIntervals[playerEntity.id!]);
      delete playerHeatIntervals[playerEntity.id!];
    }
    
    playerHeatIntervals[playerEntity.id!] = setInterval(() => {
      if (playerInLava[playerEntity.id!] && ACTIVE_PLAYERS.has(playerEntity)) {
        playerHeatLevel[playerEntity.id!] += lavaHeatIncrease;
      } else {
        clearInterval(playerHeatIntervals[playerEntity.id!]);
        delete playerHeatIntervals[playerEntity.id!];
      }
    }, lavaHeatIncreaseRate);
  } else {
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

  // Make sure all players have their pointers locked for gameplay
  ACTIVE_PLAYERS.forEach(playerEntity => {
    playerEntity.player.ui.lockPointer(true);
  });
}

// End Game Function *******************************************************************************************************

function endGame(world: World) {
  if (gameState !== 'inProgress') return;
  
  gameState = 'awaitingPlayers';

  // Clear teleport input handlers
  ACTIVE_PLAYERS.forEach(playerEntity => {
    playerEntity.controller!.onTickWithPlayerInput = undefined;
  });

  // Update leaderboards for all active players
  ACTIVE_PLAYERS.forEach(playerEntity => {
    if (playerScore[playerEntity.id!] > 0) {
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
      
      if (playerScore[playerEntity.id!] > (playerTopScore[playerEntity.id!] || 0)) {
        playerTopScore[playerEntity.id!] = playerScore[playerEntity.id!];
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

    // Clear partnerships
    playerPartners = {};
    playerPartnerSelections = {};
    playerTeleportCharges = {};
  }, 10000);
}


  // PLAYER RESPAWN FUNCTION *************************************************************

function cleanupPlayerState(playerId: number) {
  // Clear partner assignments but keep teleport charges
  if (playerPartners[playerId]) {
    const partnerId = playerPartners[playerId];
    delete playerPartners[playerId];
    delete playerPartners[partnerId];
  }
  
  // Clear partner selections
  if (playerPartnerSelections[playerId]) {
    delete playerPartnerSelections[playerId];
  }
}

function overHeat(playerEntity: PlayerEntity) {
    const playerId = playerEntity.id!;
    console.log(`Player ${playerId} overheating with ${playerTeleportCharges[playerId]} teleport charges`);
    
    // Clear the heat interval if it exists
    if (playerHeatIntervals[playerId]) {
        clearInterval(playerHeatIntervals[playerId]);
        delete playerHeatIntervals[playerId];
    }

    playerEntity.setLinearVelocity({ x: 0, y: 0, z: 0 });
    playerEntity.setPosition(GAME_CONFIG.POSITIONS.LOBBY);
    playerHeatLevel[playerId] = 1;
    playerInLava[playerId] = false;
    ACTIVE_PLAYERS.delete(playerEntity);  // Remove from active players
    
    if (playerScore[playerId] > (playerTopScore[playerId] || 0)) {
        playerTopScore[playerId] = playerScore[playerId];
    }

    // Only clean up partnerships, NOT teleport charges
    if (playerPartners[playerId]) {
        const partnerId = playerPartners[playerId];
        delete playerPartners[playerId];
        delete playerPartners[partnerId];
    }
    
    if (playerPartnerSelections[playerId]) {
        delete playerPartnerSelections[playerId];
    }

    console.log(`After overheat, player ${playerId} has ${playerTeleportCharges[playerId]} teleport charges`);

    // Send immediate UI update with current teleport charges
    playerEntity.player.ui.sendData({
        type: 'updatePlayerState',
        heatLevel: playerHeatLevel[playerId],
        inLava: playerInLava[playerId],
        score: playerScore[playerId],
        topScore: playerTopScore[playerId],
        teleportCharges: playerTeleportCharges[playerId] // Make sure we're sending the current charges
    });

    if (playerScore[playerId] > 0) {
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

// Add new function to handle teleport requests
function handleTeleportRequest(world: World, playerEntity: PlayerEntity) {
  const playerId = playerEntity.id!;
  
  // Check if player has a partner
  if (!playerPartners[playerId]) {
    playerEntity.player.ui.sendData({
      type: 'teleportStatus',
      status: 'noPartner',
      message: 'No partner available'
    });
    return;
  }

  // Check if player has charges remaining
  if (playerTeleportCharges[playerId] <= 0) {
    playerEntity.player.ui.sendData({
      type: 'teleportStatus',
      status: 'noCharges',
      message: 'No teleport charges remaining'
    });
    return;
  }

  // Get partner entity
  const partnerId = playerPartners[playerId];
  let partnerEntity: PlayerEntity | undefined;
  
  // Find partner entity from active players
  ACTIVE_PLAYERS.forEach(entity => {
    if (entity.id === partnerId) {
      partnerEntity = entity;
    }
  });
  
  if (!partnerEntity || !ACTIVE_PLAYERS.has(partnerEntity)) {
    delete playerPartners[playerId];
    playerEntity.player.ui.sendData({
      type: 'teleportStatus',
      status: 'invalidPartner',
      message: 'Partner no longer in game'
    });
    return;
  }

  // Perform teleport
  playerTeleportCharges[playerId]--;
  playerEntity.setPosition(partnerEntity.position);
  
  // Notify player of successful teleport and remaining charges
  playerEntity.player.ui.sendData({
    type: 'teleportStatus',
    status: 'success',
    chargesRemaining: playerTeleportCharges[playerId],
    message: `Teleported to partner! ${playerTeleportCharges[playerId]} charges remaining`
  });
}

// Add new function to handle partner selection during countdown
function startPartnerSelection(world: World) {
  // Reset partner selections
  playerPartnerSelections = {};
  
  // Send updated partner selection UI to all queued players
  QUEUED_PLAYER_ENTITIES.forEach(entity => {
    const playerId = entity.id!;
    
    // Get list of other players
    const availablePlayers = Array.from(QUEUED_PLAYER_ENTITIES)
      .filter(p => p.id !== playerId)
      .map(p => ({
        id: p.id,
        name: p.player.username
      }));
    
    // Initialize selection tracking
    playerPartnerSelections[playerId] = new Set();
    
    // Send selection UI to player
    entity.player.ui.sendData({
      type: 'partnerSelection',
      availablePlayers
    });
  });
}

// Add to handlePartnerSelection to relock pointer after selection
function handlePartnerSelection(world: World, playerEntity: PlayerEntity, selectedPartnerId: number) {
  const playerId = playerEntity.id!;
  
  // Add to selections
  if (!playerPartnerSelections[playerId]) {
    playerPartnerSelections[playerId] = new Set();
  }
  playerPartnerSelections[playerId].add(selectedPartnerId);
  
  // Send immediate feedback to selecting player
  playerEntity.player.ui.sendData({
    type: 'partnerSelectionUpdate',
    selectedId: selectedPartnerId,
    status: 'pending',
    message: 'Waiting for partner to confirm...'
  });
  
  // Notify the potential partner
  QUEUED_PLAYER_ENTITIES.forEach(entity => {
    if (entity.id === selectedPartnerId) {
      entity.player.ui.sendData({
        type: 'partnerSelectionNotification',
        fromPlayerId: playerId,
        fromPlayerName: playerEntity.player.username,
        message: `${playerEntity.player.username} wants to be your partner!`
      });
    }
  });
  
  // Check if mutual selection exists
  if (playerPartnerSelections[selectedPartnerId]?.has(playerId)) {
    // Create partnership
    playerPartners[playerId] = selectedPartnerId;
    playerPartners[selectedPartnerId] = playerId;
    
    // Find partner name
    let partnerName = '';
    QUEUED_PLAYER_ENTITIES.forEach(entity => {
      if (entity.id === selectedPartnerId) {
        partnerName = entity.player.username;
      }
    });

    // Notify both players of confirmed partnership
    const notification = {
      type: 'partnerConfirmed',
      partnerId: selectedPartnerId,
      partnerName: partnerName
    };
    
    playerEntity.player.ui.sendData(notification);
    
    // Find and notify partner
    QUEUED_PLAYER_ENTITIES.forEach(entity => {
      if (entity.id === selectedPartnerId) {
        entity.player.ui.sendData({
          ...notification,
          partnerId: playerId,
          partnerName: playerEntity.player.username
        });
      }
    });
  }
}

// Add to the existing UI message handling pattern
function handleUIMessage(world: World, playerEntity: PlayerEntity, message: any) {
  // ... existing message handlers ...

  // Add new handler for partner selection
  if (message.type === 'selectPartner') {
    handlePartnerSelection(world, playerEntity, message.partnerId);
  }
}




// DEBUGGING TElEPORT FUNCTIONLITY AND CHARGE NUMBERS BETWEEN GAMES. Seems like a player is losing 2 and then when it hits 0 its messed up.


