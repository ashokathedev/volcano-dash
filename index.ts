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
  Light,
  LightType,
  type PlayerInput,
} from 'hytopia';

import worldMap from './assets/maps/terrain.json';
import { 
    handlePartnerRequest, 
    initializePartnerSelection, 
    resetPartnerships,
    getPartnerships,
    hasPartner,
    getPartnerId,
    cleanupPlayerPartnerships,
    removePartnership,
} from './partnerSystem';
import { buildChamberCourse, LAVA_START_X, LAVA_START_Z } from './chamberCourse';
import { buildPracticeCourse, PRACTICE_START_X, PRACTICE_START_Z } from './practiceCourse';


// Game Config *****************************************************************************************

const GAME_CONFIG = {

  START_DELAY: 15, // Countdown before shift begins - players can select their partner
 
  // Spawn Points for players and NPCS

  POSITIONS: { 
    ARENA: { x: 14, y: 5, z: -12},      // Arena Spawn Point
    JOIN_NPC: { x: 3, y: 5, z: 13 },  // Shift Manager Spawn Point (***** UPDATE NAME TO SHIFT MANAGER! ***)
    LOBBY: { x: 0, y: 4, z: 0 },       // Lobby Repawn Point after shift ends
    GAME_JOIN: { x: 3, y: 4, z: 28 }, // Initial spawn point for players joining the server { x: -33, y: 4, z: 1 }
  },

  // Spawn points and IDs for super charges
    
  SUPER_CHARGES: [
    { id: 'charge1', position: { x: 24, y: 12, z: -4 } },   // Level B Corner 
    { id: 'charge2', position: { x: 6, y: 12, z: -4 } },    // Level B Corner
    { id: 'charge3', position: { x: 6, y: 12, z: -22 } },    //  Level B Corner
    { id: 'charge4', position: { x: 24, y: 12, z: -22 } },     // Level B Corner
    { id: 'charge5', position: { x: 7, y: 25, z: -13 } },   // Level D  
    { id: 'charge6', position: { x: 15, y: 25, z: -21 } },    // Level D 
    { id: 'charge7', position: { x: 23, y: 25, z: -13 } },    //  Level D 
    { id: 'charge8', position: { x: 15, y: 25, z: -5 } },     // Level D 
    { id: 'charge9', position: { x: 15, y: 37, z: -7 } },     // Level D 
    { id: 'charge10', position: { x: 15, y: 37, z: -19 } },     // Level D 

   

  ],



  // Spawn points and IDs for heat clusters

  HEAT_CLUSTERS: [
     { id: 'cluster1', position: { x: 15, y: 9, z: -4 } },  // Level A Front
    { id: 'cluster2', position: { x: 15, y: 9, z: -22 } },  // Level A Back
    { id: 'cluster3', position: { x: 16, y: 17, z: -14 } },  // Level C Cluser
    { id: 'cluster4', position: { x: 14, y: 17, z: -14 } },  // Level C Cluser
    { id: 'cluster5', position: { x: 16, y: 17, z: -12 } },  // Level C Cluser
    { id: 'cluster6', position: { x: 14, y: 17, z: -12 } },  // Level C Cluser
    { id: 'cluster7', position: { x: 23, y: 32, z: -13 } },  // Level E Cluser
    { id: 'cluster8', position: { x: 8, y: 32, z: -13 } },  // Level E Cluser
  ]
};

// Game State Management ---------------------------------------------------------------

let gameState: 'awaitingPlayers' | 'starting' | 
   'inProgress' = 'awaitingPlayers';                     // Current phase (waiting/countdown/playing)
let gameCountdownStartTime: number | null = null;        // When the pre-game countdown started
let gameStartTime: number | null = null;                 // When the actual gameplay began
let gameUiState: object = {};                           // Shared UI state data for all players (*****IS THIS BEING USED??****)

// Player Collections --------------------------------------------------------------

const QUEUED_PLAYER_ENTITIES = new Set<PlayerEntity>();  // Players waiting in lobby for next round
const GAME_PLAYER_ENTITIES = new Set<PlayerEntity>();    // All players who started current round
const ACTIVE_PLAYERS = new Set<PlayerEntity>();          // Players still alive in current round (not overheated)

// Player State Tracking ----------------------------------------------------------

// Heat & Lava State
const playerHeatLevel: Record<number, number> = {};             // Current heat level for each player
const playerHeatIntervals: Record<number, NodeJS.Timer> = {};   // Heat accumulation timers for each player
const playerInLava: Record<number, boolean> = {};               // Tracks if player is in lava

// Score Tracking
const playerScore: Record<number, number> = {};                 // Current score for each player
let playerTopScore: Record<number, number> = {};               // Highest score achieved by each player
const playerScoreMultipliers: Record<number, number> = {};      // Current score multiplier for each player

// Power-up State
const INITIAL_TELEPORT_CHARGES = 2;                            // Starting teleport charges for each player
let playerTeleportCharges: Record<number, number> = {};        // Number of teleport charges remaining per player
const playerSuperChargesUsed: Record<number, Set<string>> = {}; // Super charge stations used by each player
const superChargeProgresses: Record<string, number> = {};       // Progress of each super charge station

// Leaderboard State -------------------------------------------------------------

const lastShiftLeaders: Array<{name: string, score: number}> = []; // Top scores from current/last round
const allTimeLeaders: Array<{name: string, score: number}> = [];   // All-time top scores across all rounds

// Game Constants --------------------------------------------------------------

// Heat Management
const MAX_HEAT_LEVEL = 1000;            // Maximum heat a player can accumulate before overheating
const CHAMBER_HEAT_INCREASE = 1;        // Regular Heat increase value in the chamber
const CHAMBER_HEAT_INCREASE_RATE = 100; // Regular Heat increase rate (ms) in the chambeer
const LAVA_HEAT_INCREASE = 20;          // Heat increase value when in lava
const LAVA_HEAT_INCREASE_RATE = 100;    // Heat increase rate (ms) when in Lava (value/rate determines how fast heat increases)

// Scoring System
const SCORE_RATE = 1;                  // Base rate at which score accumulates
const SCORE_INTERVAL = 10;             // How often (ms) score updates

// Lava Arena Configuration
const LAVA_RISE_VELOCITY = 0.5;        // How fast lava rises
const LAVA_RISE_DELAY = 1;             // Time before lava starts rising (secs)
const LAVA_Y = -12;                    // Y center point coordinate for rising lava
const LAVA_MAX_HEIGHT = 24;             // Maximum height lava center point can rise to

// Lava Dimensions
const LAVA_HALF_EXTENT_X = 11;         // Half width of lava area (x units from center point)
const LAVA_HALF_EXTENT_Y = 24;         // Half height of lava area (y units from center point)
const LAVA_HALF_EXTENT_Z = 11;         // Half depth of lava area (z units from center point)

// Near the top with other state variables
export const playerNickname: Record<number, string> = {};  // Track nicknames by player ID

// Add this near the top with other game state variables
const playerChargingState: Record<number, boolean> = {};  // Track if player is currently charging

// Start the server *****************************************************************************************************************


startServer(world => {
  
  // world.simulation.enableDebugRendering(true); // Enable debug rendering of the physics simulation.

  world.loadMap(worldMap); //load map
  world.onPlayerJoin = player => onPlayerJoin(world, player);
  world.onPlayerLeave = player => onPlayerLeave(world, player);
  spawnJoinNpc(world);
  spawnPracticeNpc(world);
  
  // Build both courses
  buildChamberCourse(world);
  buildPracticeCourse(world);

  // Spawn heat clusters at each position

  GAME_CONFIG.HEAT_CLUSTERS.forEach(cluster => {
    spawnHeatCluster(world, cluster.position, cluster.id);
  });

  // Spawn super charges at each position
  
  GAME_CONFIG.SUPER_CHARGES.forEach(charge => {
    spawnSuperCharge(world, charge.position, charge.id);
  });




 // Player Join Functions **************************************************************************************

 // Create player entity

 function onPlayerJoin(world: World, player: Player) {
   const playerEntity = new PlayerEntity({
     player,
     name: 'Player',
     modelUri: 'models/volcano-dash/gameJamPlayer.gltf',
     modelLoopedAnimations: ['idle'],
     modelScale: 0.5,
   });

     

   // Spawn player entity
  
   playerEntity.spawn(world, GAME_CONFIG.POSITIONS.GAME_JOIN);

   // Setup Teleport Input

   playerEntity.controller!.onTickWithPlayerInput = (entity: PlayerEntity, input: PlayerInput) => {
    if (input.q) {
      console.log('Teleporting player:', playerEntity.id);
      teleport(playerEntity);
      input.q = false;
    }
   };

   // Set collision groups to prevent player-to-player collisions

   playerEntity.setCollisionGroupsForSolidColliders({
    belongsTo: [CollisionGroup.PLAYER],
    collidesWith: [CollisionGroup.BLOCK, CollisionGroup.ENTITY, CollisionGroup.ENTITY_SENSOR],
   });

   // Update sensor colliders to prevent interference from other players

   playerEntity.setCollisionGroupsForSensorColliders({
    belongsTo: [CollisionGroup.ENTITY_SENSOR],
    collidesWith: [CollisionGroup.BLOCK, CollisionGroup.ENTITY],
   });


   // Initialize teleport charges for each player

   playerTeleportCharges[playerEntity.id!] = INITIAL_TELEPORT_CHARGES;

   // Load the player UI

   player.ui.load('ui/index.html');

   // Send player state data to the UI every 100ms

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
  

   // Setup a first person camera for the player

   player.camera.setMode(PlayerCameraMode.FIRST_PERSON);
   player.camera.setOffset({ x: 0, y: 0.2, z: 0 });
   player.camera.setModelHiddenNodes(['head', 'neck']);
   player.camera.setForwardOffset(0.3);


   // Respawn player at when they Overheat curing the game

   playerEntity.onTick = () => {
     if (playerHeatLevel[playerEntity.id!] >= MAX_HEAT_LEVEL) {
       overHeat(playerEntity);
     }
   };

   // Partner Selection ----------------------------------------------------------
   // This section handles the partner selection process during the countdown phase.
   // Players can request partnerships and respond to partnership requests.
   // The actual partnership logic is managed by the partnerSystem module.
   // This handler receives UI events for:
   // - requestPartner: When a player clicks to request another player as partner
   // - respondToPartnerRequest: When a player accepts/rejects a partnership request

   player.ui.onData = (playerUI: PlayerUI, data: object) => {
     // Validate that the incoming message has a type field before processing
     if ('type' in data) {
         switch(data.type) {
             case 'setNickname':
                 playerNickname[playerEntity.id!] = (data as any).nickname;
                 console.log('Stored playerNickname:', playerNickname[playerEntity.id!]);  // Debug log
                 break;
             case 'requestPartner':      // Player is requesting someone as their partner
             case 'respondToPartnerRequest':  // Player is accepting/rejecting a request
                 if (gameState === 'starting') {
                     // During countdown phase, process the partner request/response
                     // The partnerSystem module will handle the actual partnership logic
                     handlePartnerRequest(world, playerEntity, data as any);
                 } else {
                     // Outside countdown phase, inform player that partner selection isn't available
                     // This ensures partnerships can only be formed during the countdown
                     playerEntity.player.ui.sendData({
                         type: 'partnerRequestFailed',
                         message: 'Partner selection is only available during the countdown phase'
                     });
                 }
                 break;
        }
     }
   };
 }


 // Player Leave Function and Cleanup ****************************************************************************************

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
    
     // Clear score multipliers and super charges used
    
     delete playerScoreMultipliers[entity.id!];
     delete playerSuperChargesUsed[entity.id!];
    
     // Handle overheat and despawn the player
    
 overHeat(entity);
 entity.despawn();
   });
 }

 // Join NPC Function and UI ****************************************************************************************

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
         Collider.optionsFromModelUri('models/npcs/mindflayer.gltf', 0.6), {
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
  
   joinNpc.spawn(world, GAME_CONFIG.POSITIONS.JOIN_NPC, { x: 0, y: Math.PI, z: 0, w: 0 });
  
   const npcMessageUI = new SceneUI({
     templateId: 'join-npc-message',
     attachedToEntity: joinNpc,
     offset: { x: 0, y: 2.5, z: 0 },
   });
   
   npcMessageUI.load(world);

  }

  // Practice NPC Function ****************************************************************************************

 function spawnPracticeNpc(world: World) {
   const practiceNpc = new Entity({
     name: 'Practice NPC',
     modelUri: 'models/npcs/mindflayer.gltf',
     modelLoopedAnimations: ['idle'],
     modelScale: 0.6,
     rigidBodyOptions: {
       enabledPositions: { x: false, y: true, z: false },
       enabledRotations: { x: true, y: true, z: true },
     },
   });
 
   practiceNpc.spawn(world, {x: -16, y: 5, z: 3}, { x: 0, y: Math.PI, z: 0, w: 0 });
 

   const practiceNpcMessageUI = new SceneUI({
     templateId: 'practice-npc-message',
     attachedToEntity: practiceNpc,
     viewDistance: 12,
     offset: { x: 0, y: 2.5, z: 0 },
   });

  
   practiceNpcMessageUI.load(world);

  }


 // Add Player to Queue Function ******************************************************************************************
 // This function handles the queueing process for players waiting to start a new game.
 // It checks if the game is ready to start and if there are enough players to start.
 // If so, it queues the players and starts the game.

 function addPlayerEntityToQueue(world: World, playerEntity: PlayerEntity) {
   if (QUEUED_PLAYER_ENTITIES.has(playerEntity)) return;
    
   QUEUED_PLAYER_ENTITIES.add(playerEntity);
    
   world.chatManager.sendPlayerMessage(playerEntity.player, 'You have joined the next game queue!', '00FF00');

   // Start new game if we're awaiting players
   if (gameState === 'awaitingPlayers' && QUEUED_PLAYER_ENTITIES.size >= 1) {
       queueGame(world);
   }
   
   if (gameState === 'starting') {
    initializePartnerSelection(world, QUEUED_PLAYER_ENTITIES);
   }

   // Creates SceneUI element to indicate the player is in the queue
   const queuedSceneUi = new SceneUI({
       templateId: 'player-queued',

       attachedToEntity: playerEntity,
       offset: { x: 0, y: 1, z: 0 },
   });
   
   queuedSceneUi.load(world);
 }

 // Queue Game (Countdown) Function *******************************************************************************************
 // This function handles countdown phase before the shift starts.
 // It sends countdown updates to all players in the queue and starts the shift when the countdown is complete.
 // It also handles the reset of partnerships and selections at the start of the countdown.
  
 function queueGame(world: World) {
   gameState = 'starting';
   gameCountdownStartTime = Date.now();

   // Clear any existing partnerships
   resetPartnerships();

   // Now that we're in 'starting' state, show partner selection to all queued players
   initializePartnerSelection(world, QUEUED_PLAYER_ENTITIES);

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

   // Send game start signal to all players

   setTimeout(() => {
     QUEUED_PLAYER_ENTITIES.forEach(playerEntity => {
       playerEntity.player.ui.sendData({
         type: 'gameStart'
       });
      
       playerEntity.setPosition(GAME_CONFIG.POSITIONS.ARENA);
       GAME_PLAYER_ENTITIES.add(playerEntity);

       // Re-lock pointer for gameplay
       playerEntity.player.ui.lockPointer(true);

       // Remove any existing scene UI elements
       world.sceneUIManager.getAllEntityAttachedSceneUIs(playerEntity).forEach(sceneUi => {
         sceneUi.unload();
       });
     });

     // Clear the queue after processing all players

     QUEUED_PLAYER_ENTITIES.clear();

     // Begin the actual game logic

     startGame(world);

   }, GAME_CONFIG.START_DELAY * 1000);
 }

 // Start Game (Shift) Function *******************************************************************************************************
 // This function handles the actual game logic after the countdown phase.
 // It initializes active players, sets up teleport input handling, and starts score accumulation.
 // It also spawns the rising lava platform and super charges.

 function startGame(world: World) {
   gameState = 'inProgress';
   gameStartTime = Date.now();

   // Initialize active players

   GAME_PLAYER_ENTITIES.forEach(playerEntity => {
     const playerId = playerEntity.id!;
     
     ACTIVE_PLAYERS.add(playerEntity);
     
     // Reset all player state for new game
     playerHeatLevel[playerId] = 1;
     playerInLava[playerId] = false;
     playerTeleportCharges[playerId] = INITIAL_TELEPORT_CHARGES;
     playerScore[playerId] = 0;
     playerScoreMultipliers[playerId] = 1;
   });

  
   // Scoring Function ****************************************************************************************

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
           
           // Calculate and add score based on base rate and player's multiplier
           const scoreIncrease = SCORE_RATE * playerScoreMultipliers[playerId];
           playerScore[playerId] += scoreIncrease;
         });
       } else {

         clearInterval(scoreIntervaltoClear);
       }
     }, SCORE_INTERVAL);
   }

   updateScore();

   // Chamber Heat Function ****************************************************************************************

    function updateChamberHeat() {
     const chamberHeatInterval = setInterval(() => {
       if (ACTIVE_PLAYERS.size > 0 && gameState === 'inProgress') {
         ACTIVE_PLAYERS.forEach(playerEntity => {
           playerHeatLevel[playerEntity.id!] += CHAMBER_HEAT_INCREASE;
        
           // Check for overheat
           if (playerHeatLevel[playerEntity.id!] >= MAX_HEAT_LEVEL) {
             overHeat(playerEntity);
          }
         });
       } else {
         clearInterval(chamberHeatInterval);
       }
     }, CHAMBER_HEAT_INCREASE_RATE);
   }

   updateChamberHeat();


   // RISING LAVA  ************************************************************************

   // Create Rising Lava Platform Entity ---------

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


   // Create Rising Lava Platform Movement -----------------

    risingLava.onTick = () => {
     if (risingLava.position.y >= LAVA_MAX_HEIGHT) {
       risingLava.setLinearVelocity({ x: 0, y: 0, z: 0 });
       if (gameState === 'inProgress') {
         setTimeout(() => endGame(world), LAVA_RISE_DELAY * 1000); // Delay before lava rises
       }
     } else {
      risingLava.setLinearVelocity({ x: 0, y: LAVA_RISE_VELOCITY, z: 0 }); // Rise until reaching max height
     }
    };

    // Create Rising Lava Collision --------------------

    risingLava.onEntityCollision = (risingLava: Entity, other: Entity, started: boolean) => {
   
     if (!(other instanceof PlayerEntity)) return; // Safety check - only process collisions with player entities
   
     const playerEntity = other as PlayerEntity;
   
     if (started) { // When player first touches lava
       // Clear any existing heat interval for this player
       // This prevents multiple intervals from stacking if player
       // enters/exits lava rapidly
       if (playerHeatIntervals[playerEntity.id!]) {
         clearInterval(playerHeatIntervals[playerEntity.id!]);
         delete playerHeatIntervals[playerEntity.id!];
       }
     
       // Start a new interval to increase player's heat level while in lava
       playerHeatIntervals[playerEntity.id!] = setInterval(() => {
         // Only increase heat if player is still in lava and still active in game
         if (playerInLava[playerEntity.id!] && ACTIVE_PLAYERS.has(playerEntity)) {
           playerHeatLevel[playerEntity.id!] += LAVA_HEAT_INCREASE;
         } else {
           // If player is no longer in lava or not active, clean up the interval
           clearInterval(playerHeatIntervals[playerEntity.id!]);
           delete playerHeatIntervals[playerEntity.id!];
         }
       }, LAVA_HEAT_INCREASE_RATE);
     }

     playerInLava[playerEntity.id!] = started; // Track whether player is currently in lava
    }; 

    // Spawn Rising Lava Platform -----------------

    risingLava.spawn(world, { x: LAVA_START_X + 1, y: LAVA_Y, z: LAVA_START_Z + 1 });

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

   resetPartnerships();

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
      
        entity.setLinearVelocity({ x: 0, y: -3.0, z: 0 }); // Set downward velocity
        entity.onTick = () => { // Update tick function to stop at original height                         
          if (entity.position.y <= LAVA_Y) {
            entity.setLinearVelocity({ x: 0, y: 0, z: 0 });
            entity.setPosition({ x: LAVA_START_X, y: LAVA_Y, z: LAVA_START_Z });
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

        // Reset charging state
        playerChargingState[playerEntity.id!] = false;
      });

      // Clear game players set

      GAME_PLAYER_ENTITIES.clear();
      ACTIVE_PLAYERS.clear(); 

      // Check for queued players to start next game

      if (QUEUED_PLAYER_ENTITIES.size >= 1) {
        queueGame(world);
      }
    }, 10000);
  }


  // PLAYER OVERHEAT FUNCTION *************************************************************

  function overHeat(playerEntity: PlayerEntity) {
    const playerId = playerEntity.id!;
    
    // Clear the heat interval if it exists
    if (playerHeatIntervals[playerId]) {
        clearInterval(playerHeatIntervals[playerId]);
        delete playerHeatIntervals[playerId];
    }

    playerEntity.setLinearVelocity({ x: 0, y: 0, z: 0 });  // Stop player movement
    playerEntity.setPosition(GAME_CONFIG.POSITIONS.LOBBY); // Move player to lobby
    playerHeatLevel[playerId] = 1;                         // Reset heat level
    playerInLava[playerId] = false;                       // Reset lava status
    ACTIVE_PLAYERS.delete(playerEntity);                   // Remove from active players

    removePartnership(playerId);
    
    // Update top score if player has a higher score than their current top score
    if (playerScore[playerId] > (playerTopScore[playerId] || 0)) {
        playerTopScore[playerId] = playerScore[playerId];
    }
    
    // Update leaderboards if player has a score
    if (playerScore[playerId] > 0) {
        updateLeaderboards(playerEntity);
    }

    // Reset charging state
    playerChargingState[playerId] = false;
  }

 // Update Leaderboards Function ****************************************************************************************

 // Add this new function to update leaderboards

 function updateLeaderboards(playerEntity: PlayerEntity) {
   const entry = {
       name: playerNickname[playerEntity.id!],
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

 // Heat Cluster Function ****************************************************************************************

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
    
   heatCluster.setTintColor({ r: 255, g: 100, b: 0 });

   const heatClusterUI = new SceneUI({
     templateId: 'heatCluster',
     attachedToEntity: heatCluster,
     offset: { x: 0, y: 2.5, z: 0 },
   });
  
   heatClusterUI.load(world);
  }

 // Super Charge Function ****************************************************************************************

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

                 const originalHandler = playerEntity.controller!.onTickWithPlayerInput;

                 playerEntity.controller!.onTickWithPlayerInput = (entity: PlayerEntity, input: Partial<Record<string | number | symbol, boolean>>) => {
                   if (originalHandler) {
                     originalHandler(entity, input);
                   }

                   if (input.f && !isCharging && !playerSuperChargesUsed[playerId].has(chargeId) && !playerChargingState[playerId]) {
                     isCharging = true;
                     playerChargingState[playerId] = true;  // Mark player as charging
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
                         playerScore[playerId] = Math.floor(playerScore[playerId] * 2);  // Ensure integer result
                         playerSuperChargesUsed[playerId].add(chargeId);
                         isCharging = false;
                         playerChargingState[playerId] = false;  // Clear charging state
                         
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
                     playerChargingState[playerId] = false;  // Clear charging state
                     
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

  // AUDIO  ********************************************************************************************

 new Audio({
  uri: 'audio/music/outworld-theme.mp3', 
  loop: true,
  volume: 0.3,
 }).play(world);


 // TELEPORT FUNCTION ********************************************************************************************

 function teleport(playerEntity: PlayerEntity) {
  const playerId = playerEntity.id!;
  
  // Check if player has teleport charges remaining
  if (!playerTeleportCharges[playerId] || playerTeleportCharges[playerId] <= 0) {
    world.chatManager.sendPlayerMessage(playerEntity.player, 'No Teleport Charges Left!', 'FFFFFF');  // White text
    return;
  }

  // Get partner ID and verify partner is active
  const partnerId = getPartnerId(playerId);
  if (!partnerId) {
    world.chatManager.sendPlayerMessage(playerEntity.player, 'No Partner Found!', 'FFFFFF');  // White text
    return;
  }

  // Find partner entity and verify they are still active
  
  const partnerEntity = Array.from(ACTIVE_PLAYERS)
    .find(entity => entity.id === partnerId);

  if (!partnerEntity || !ACTIVE_PLAYERS.has(partnerEntity)) {
    world.chatManager.sendPlayerMessage(playerEntity.player, 'No Partner Found!', 'FFFFFF');  // White text
    return;
  }

  // Teleport to partner's location
  playerEntity.setPosition(partnerEntity.position);
  
  // Deduct teleport charge
  playerTeleportCharges[playerId]--;

  // Send success messages to both players
  world.chatManager.sendPlayerMessage(playerEntity.player, 
    `Teleported to ${playerNickname[partnerId]}!`, '00FF00');  // Green text
  
  world.chatManager.sendPlayerMessage(partnerEntity.player, 
    `${playerNickname[playerId]} teleported to you!`, '00FF00');  // Green text

  // Notify player of successful teleport and remaining charges
  playerEntity.player.ui.sendData({
    type: 'teleportSuccess',
    remainingCharges: playerTeleportCharges[playerId]
  });
  console.log(`[TELEPORT] Success - Teleport completed for player ${playerId}`);
 }

 // Chamber Wall Block Entities  -----------------------------------

 const frontChamberWall = new Entity({
  blockTextureUri: 'blocks/blackStone.png',
  blockHalfExtents: { x: 12, y: 11, z: 0.5 },
  rigidBodyOptions: {
    type: RigidBodyType.KINEMATIC_VELOCITY,
  },
});

frontChamberWall.spawn(world, { x: 15, y: 28, z: -1.5 });

const backChamberWall = new Entity({
  blockTextureUri: 'blocks/blackStone.png',
  blockHalfExtents: { x: 12, y: 11, z: 0.5 },
  rigidBodyOptions: {
    type: RigidBodyType.KINEMATIC_VELOCITY,
  },
});


backChamberWall.spawn(world, { x: 15, y: 28, z: -24.5 });

const rightChamberWall = new Entity({
  blockTextureUri: 'blocks/blackStone.png',
  blockHalfExtents: { x: 0.5, y: 11, z: 11.5 },
  rigidBodyOptions: {
    type: RigidBodyType.KINEMATIC_VELOCITY,
  },
});


rightChamberWall.spawn(world, { x: 26.5, y: 28, z: -13.5 });

const frontPracticeWall = new Entity({
  blockTextureUri: 'blocks/blackStone.png',
  blockHalfExtents: { x: 12, y: 11, z: 0.5 },
  rigidBodyOptions: {
    type: RigidBodyType.KINEMATIC_VELOCITY,
  },
});

frontPracticeWall.spawn(world, { x: -8, y: 28, z: -1.5 });

const leftPracticeWall = new Entity({
  blockTextureUri: 'blocks/blackStone.png',
  blockHalfExtents: { x: 0.5, y: 22, z: 11.5 },
  rigidBodyOptions: {
    type: RigidBodyType.KINEMATIC_VELOCITY,
  },
});


leftPracticeWall.spawn(world, { x: -19.5, y: 17, z: -13.5 });

const backPracticeWall = new Entity({
  blockTextureUri: 'blocks/blackStone.png',
  blockHalfExtents: { x: 12, y: 22, z: 0.5 },
  rigidBodyOptions: {
    type: RigidBodyType.KINEMATIC_VELOCITY,
  },
});



backPracticeWall.spawn(world, { x: -8, y: 17, z: -24.5 });

const lobbyRoof = new Entity({
  blockTextureUri: 'blocks/blackStone.png',
  blockHalfExtents: { x: 36, y: 0.5, z: 26 },
  rigidBodyOptions: {
    type: RigidBodyType.KINEMATIC_VELOCITY,
  },
});


lobbyRoof.spawn(world, { x: 4, y: 17.5, z: 25 });


// Lighting ****************************************************************************************

world.setAmbientLightIntensity(0.5); // Reduce ambient light intensity
world.setAmbientLightColor({ r: 218, g: 127, b: 80 }); // slightly purple

// Create purple point lights
const orangeLightPositions = [
  { x: -6, y: 2, z: 26 },
  { x: -9, y: 2, z: 26 },
  { x: 13, y: 2, z: 12 },
  { x: 17, y: 2, z: 12 }
];

orangeLightPositions.forEach(position => {
  (new Light({
    color: { r: 218, g: 127, b: 80 },
    intensity: 40,
    position,
  })).spawn(world);
});

 // large ceiling spotlight
 (new Light({
  type: LightType.SPOTLIGHT,
  angle: Math.PI / 8,
  color: { r: 255, g: 255, b: 255 },
  intensity: 40,
  penumbra: 0.5,
  position: { x: 0, y: 40, z: 0 },
  trackedPosition: { x: 0, y: 0, z: 0 },
})).spawn(world);

});


