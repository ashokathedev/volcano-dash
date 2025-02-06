// Volcano Dash -- Hytopia Game Jam 1 Submission by Ashoka (@ashokawashere)

   /* OBJECTIVE: Players harvest energy from inside a lava chamber.
      -- When the player overheats they are teleported back into the lobby.
      -- Players can choose a partner and use Q to teleport to them during the round.
      -- Players can stand in heat clusters to harvest energy faster.
      -- Players can use super charge stations by holding F to double their current harvested energy
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
  Light,
  LightType,
  type PlayerCameraOrientation,
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
} from './src/partnerSystem';

import { buildChamberCourse, LAVA_START_X, LAVA_START_Z } from './src/chamberCourse';
import { buildPracticeCourse, PRACTICE_START_X, PRACTICE_START_Z } from './src/practiceCourse';
import { spawnHazmatSuit, despawnHazmatSuit } from './src/hazmatSuit';
import { initiateRisingLava, drainLava } from './src/risingLava';
import { spawnHeatCluster, spawnSuperCharge } from './src/powerUps';
import { playerNickname } from './src/state';
import { buildChamberWalls } from './src/chamberWalls';


// Game Config *****************************************************************************************

const GAME_CONFIG = {

  START_DELAY: 15, // Countdown before shift begins - players can select their partner

  POSITIONS: { 
    JOIN_NPC: { x: 3, y: 5, z: 13 },    // Join NPC Spawn Point
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
    { id: 'charge10', position: { x: 15, y: 37, z: -13 } },     // Level E 

  ],

  // Spawn points and IDs for heat clusters

  HEAT_CLUSTERS: [
     { id: 'cluster1', position: { x: 15, y: 8, z: -4 } },  // Level A Front
    { id: 'cluster2', position: { x: 15, y: 8, z: -22 } },  // Level A Back
    { id: 'cluster3', position: { x: 17, y: 17, z: -15 } },  // Level C Cluster
    { id: 'cluster4', position: { x: 13, y: 17, z: -15 } },  // Level C Cluster
    { id: 'cluster5', position: { x: 17, y: 17, z: -11 } },  // Level C Cluster
    { id: 'cluster6', position: { x: 13, y: 17, z: -11 } },  // Level C Cluster
    { id: 'cluster7', position: { x: 23, y: 32, z: -13 } },  // Level E Cluster
    { id: 'cluster8', position: { x: 7, y: 32, z: -13 } },  // Level E Cluster
    { id: 'cluster9', position: { x: 15, y: 37, z: -7 } },  // Level E Cluster
    { id: 'cluster10', position: { x: 15, y: 37, z: -19 } },  // Level E Cluster
  ]
};


// Random Spawn Locations

function getRandomGameJoinSpawn() {
  const randomX = Math.random() * 14 - 1;  // Range from -1 to 13
  const randomZ = Math.random() * 8 + 20;  // Range from 20 to 28
  return { x: randomX, y: 4, z: randomZ };
}
 
   
function getRandomArenaSpawn() {
  const randomX = Math.random() * 4 + 14;  // Range from 12 to 16
  const randomZ = Math.random() * 4 - 14;  // Range from -14 to -10
  return { x: randomX, y: 5, z: randomZ };
}
 
// Game State Management ---------------------------------------------------------------

let gameState: 'awaitingPlayers' | 'starting' | 'inProgress' = 'awaitingPlayers'; 
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
const CHAMBER_HEAT_INCREASE_RATE = 200; // Regular Heat increase rate (ms) in the chamber
const LAVA_HEAT_INCREASE = 20;          // Heat increase value when in lava
const LAVA_HEAT_INCREASE_RATE = 100;    // Heat increase rate (ms) when in Lava (value/rate determines how fast heat increases)

// Scoring System
const SCORE_RATE = 1;                  // Base rate at which score accumulates
const SCORE_INTERVAL = 10;             // How often (ms) score updates

const playerChargingState: Record<number, boolean> = {};  // Track if player is currently charging

// Create a state object to pass to the power up functions
const powerUpState = {
  playerScoreMultipliers,
  playerSuperChargesUsed,
  playerChargingState,
  playerScore
};


let lavaAmbientSound: Audio | null = null;

// Start the server *****************************************************************************************************************

startServer(world => {
  
 // Play the Outworld Theme
   
  new Audio({
    uri: 'audio/music/outworld-theme.mp3', 
    loop: true,
    volume: 0.2,
   }).play(world);

  //world.simulation.enableDebugRendering(true); // Enable debug rendering of the physics simulation.

  world.loadMap(worldMap); //load map
  world.onPlayerJoin = player => onPlayerJoin(world, player);
  world.onPlayerLeave = player => onPlayerLeave(world, player);
  spawnJoinNpc(world);
  spawnPracticeNpc(world);

  // Build Chambers and courses
  
  buildChamberCourse(world);
  buildPracticeCourse(world);
  buildChamberWalls(world);

  // Spawn heat clusters at each position

  GAME_CONFIG.HEAT_CLUSTERS.forEach(cluster => {
    spawnHeatCluster(world, cluster.position, cluster.id, powerUpState);
  });

  // Spawn super charges at each position
  
  GAME_CONFIG.SUPER_CHARGES.forEach(charge => {
    spawnSuperCharge(world, charge.position, charge.id, powerUpState);
  });


 // Player Join Functions **************************************************************************************

 // Create and spawn player entity

 function onPlayerJoin(world: World, player: Player) {
   const playerEntity = new PlayerEntity({
     player,
     name: 'Player',
     modelUri: 'models/volcano-dash/gameJamPlayerRed.gltf',
     modelLoopedAnimations: ['idle'],
     modelScale: 0.5,
   });

   playerEntity.spawn(world, getRandomGameJoinSpawn());

   world.chatManager.sendPlayerMessage(player, 'Welcome to Voltech!', '00FF00');
   world.chatManager.sendPlayerMessage(player, 'Use [W,A,S,D] to move, spacebar to jump, and shift to run.');
   world.chatManager.sendPlayerMessage(player, 'When you are ready, grab your gear and join the next shift.');
   world.chatManager.sendPlayerMessage(player, 'Have questions? Type !about or !tips in the chat.');
   world.chatManager.sendPlayerMessage(player, 'Good luck!');


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
     const heatPercent = (playerHeatLevel[playerId] / MAX_HEAT_LEVEL) * 100;

     // Show heat warning when heat level is dangerous
     if (heatPercent > 75) {
       playerEntity.player.ui.sendData({
         type: 'heatWarning',
         show: true
       });
     } else {
       playerEntity.player.ui.sendData({
         type: 'heatWarning',
         show: false
       });
     }

     // Regular state update
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
       teleportCharges: playerTeleportCharges[playerId]
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


 // Player Leave Function and Cleanup **********************************************************

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
       enabledRotations: { x: false, y: false, z: false },
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


 // Add Player to Queue Function ******************************************************************************
 // This function handles the queueing process for players waiting to start a new game.
 // It checks if the game is ready to start and if there are enough players to start.
 // If so, it queues the players and starts the game.
 

 function addPlayerEntityToQueue(world: World, playerEntity: PlayerEntity) {
   if (!QUEUED_PLAYER_ENTITIES.has(playerEntity)) {
     QUEUED_PLAYER_ENTITIES.add(playerEntity);
     // Spawn the hazmat suit when player joins queue
     spawnHazmatSuit(world, playerEntity);
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
 }

 // Queue Game (Countdown) Function ********************************************************************************
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
      
       playerEntity.setPosition(getRandomArenaSpawn());
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

 // Start Game (Shift) Function *********************************************************************************
 // This function handles the actual game logic after the countdown phase.
 // It initializes active players and starts score accumulation.
 // It also spawns the rising lava platform.

 function startGame(world: World) {
   gameState = 'inProgress';
   gameStartTime = Date.now();

   // Reset last shift leaderboard at start of new round
   lastShiftLeaders.length = 0;

   // Play game start chamber sound
   new Audio({
    uri: 'sounds/sfx/misc/volcano-dash/joseegn-ui-sound-return-1.mp3',
    volume: 0.6,
  }).play(world);

   // Start lava ambient sound

   lavaAmbientSound = new Audio({
     uri: 'sounds/sfx/misc/volcano-dash/shelbyshark-spacerumble-loop.mp3',
     loop: true,
     volume: 0.5,
   });
   lavaAmbientSound.play(world);

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
     
     // Reset super charge stations for this player
     playerSuperChargesUsed[playerId] = new Set<string>();

     // Send teleport sound event to player's UI
     playerEntity.player.ui.sendData({
       type: 'playTeleportSound',
       soundType: 'enter'
     });
   });

   // Heat Level Increase Function *******************************************
   function updateHeat() {
     const heatIntervalToClear = setInterval(() => {
       if (ACTIVE_PLAYERS.size > 0 && gameState === 'inProgress') {
         ACTIVE_PLAYERS.forEach(playerEntity => {
           const playerId = playerEntity.id!;
           
           // Only increase heat if player isn't already in lava
           // (lava heat is handled separately in risingLava.ts)
           if (!playerInLava[playerId]) {
             playerHeatLevel[playerId] += CHAMBER_HEAT_INCREASE;
           }
         });
       } else {
         clearInterval(heatIntervalToClear);
       }
     }, CHAMBER_HEAT_INCREASE_RATE);
   }

   // Scoring Function ************************************************************************

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

   // Call both update functions
   updateScore();
   updateHeat();

   // Initialize rising lava
   initiateRisingLava(
     world,
     gameState,
     playerHeatIntervals,
     playerInLava,
     playerHeatLevel,
     ACTIVE_PLAYERS,
     LAVA_HEAT_INCREASE,
     LAVA_HEAT_INCREASE_RATE,
     endGame,
     LAVA_START_X,
     LAVA_START_Z
   );

   // Show "Shift in Progress" message to non-active players
   world.entityManager.getAllPlayerEntities().forEach((playerEntity: PlayerEntity) => {
     if (!ACTIVE_PLAYERS.has(playerEntity)) {
       playerEntity.player.ui.sendData({
         type: 'shiftStatus',
         status: 'inProgress'
       });
     }
   });
 }

 // End Game Function *******************************************************************************************************

 function endGame(world: World) {
   if (gameState !== 'inProgress') return;
  
   gameState = 'awaitingPlayers';

   // Hide "Shift in Progress" message immediately for all players
   world.entityManager.getAllPlayerEntities().forEach((playerEntity: PlayerEntity) => {
     playerEntity.player.ui.sendData({
       type: 'shiftStatus',
       status: 'ended'
     });
   });

   // Stop lava ambient sound using pause() instead of stop()
   if (lavaAmbientSound) {
     lavaAmbientSound.pause();
     lavaAmbientSound = null;
   }

   // Play drain sound
   new Audio({
     uri: 'sounds/sfx/misc/volcano-dash/joseegn-ui-sound-return-1.mp3',
     volume: 0.6,
   }).play(world);

   resetPartnerships();

   // Send survival message to active players who didn't overheat
   ACTIVE_PLAYERS.forEach(playerEntity => {
     if (playerHeatLevel[playerEntity.id!] < MAX_HEAT_LEVEL) {
       playerEntity.player.ui.sendData({
         type: 'survivalMessage'
       });
     }
   });

   // Update leaderboards for all active players
   ACTIVE_PLAYERS.forEach(playerEntity => {
     if (playerScore[playerEntity.id!] > 0) {
       updateLeaderboards(playerEntity);
     }
   });

   // Find the top scorer from the last shift
   if (lastShiftLeaders.length > 0) {
     const topPerformer = lastShiftLeaders[0];
     // Send winner message to ALL players in the server, not just active ones
     world.entityManager.getAllPlayerEntities().forEach((playerEntity: PlayerEntity) => {
       playerEntity.player.ui.sendData({
         type: 'shiftWinner',
         winnerName: topPerformer.name,
         score: topPerformer.score
       });
     });
   }

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
    
    drainLava(world, LAVA_START_X, LAVA_START_Z);

    // Update top scores and move players after 10 seconds

    setTimeout(() => {
      ACTIVE_PLAYERS.forEach(playerEntity => {
        playerEntity.player.ui.sendData({
          type: 'playTeleportSound',
          soundType: 'exit'
        });
        
        if (playerScore[playerEntity.id!] > (playerTopScore[playerEntity.id!] || 0)) {
          playerTopScore[playerEntity.id!] = playerScore[playerEntity.id!];
        }

        // Despawn hazmat suit for each player
        despawnHazmatSuit(world, playerEntity);

        // Use random spawn instead of fixed LOBBY position
        playerEntity.setPosition(getRandomGameJoinSpawn());
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
    
    // Send overheat message
    playerEntity.player.ui.sendData({
      type: 'overheatMessage'
    });

    // Send teleport sound event to player's UI
    playerEntity.player.ui.sendData({
      type: 'playTeleportSound',
      soundType: 'exit'
    });

    // Clear the heat interval if it exists
    if (playerHeatIntervals[playerId]) {
        clearInterval(playerHeatIntervals[playerId]);
        delete playerHeatIntervals[playerId];
    }

    // Update leaderboards BEFORE removing from active players
    // This ensures their score is counted for the shift
    if (playerScore[playerId] > 0) {
      updateLeaderboards(playerEntity);
    }

    // Update top score if player has a higher score than their current top score
    if (playerScore[playerId] > (playerTopScore[playerId] || 0)) {
      playerTopScore[playerId] = playerScore[playerId];
    }

    playerEntity.setLinearVelocity({ x: 0, y: 0, z: 0 });  // Stop player movement
    playerEntity.setPosition(getRandomGameJoinSpawn()); // Move player to lobby
    playerHeatLevel[playerId] = 1;                         // Reset heat level
    playerInLava[playerId] = false;                       // Reset lava status
    
    // Now remove from active players after updating leaderboards
    ACTIVE_PLAYERS.delete(playerEntity);                   

    removePartnership(playerId);
    
    // Reset charging state
    playerChargingState[playerId] = false;

    // Show "Shift in Progress" message since they're now spectating
    playerEntity.player.ui.sendData({
      type: 'shiftStatus',
      status: 'inProgress'
    });

    // Despawn hazmat suit
    despawnHazmatSuit(world, playerEntity);
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

 // TELEPORT FUNCTION ********************************************************************************************

 function teleport(playerEntity: PlayerEntity) {
  const playerId = playerEntity.id!;
  
  // First check if player is in an active game
  if (!ACTIVE_PLAYERS.has(playerEntity)) {
    world.chatManager.sendPlayerMessage(playerEntity.player, 'Teleport charges can only be used inside the lava chamber!', 'FFFFFF');
    return;
  }
  
  if (!playerTeleportCharges[playerId] || playerTeleportCharges[playerId] <= 0) {
    playerEntity.player.ui.sendData({
      type: 'playTeleportFailSound'
    });
    world.chatManager.sendPlayerMessage(playerEntity.player, 'No Teleport Charges Left!', 'FFFFFF');
    return;
  }

  const partnerId = getPartnerId(playerId);
  if (!partnerId) {
    playerEntity.player.ui.sendData({
      type: 'playTeleportFailSound'
    });
    world.chatManager.sendPlayerMessage(playerEntity.player, 'No Partner Found!', 'FFFFFF');
    return;
  }

  const partnerEntity = Array.from(ACTIVE_PLAYERS)
    .find(entity => entity.id === partnerId);

  if (!partnerEntity || !ACTIVE_PLAYERS.has(partnerEntity)) {
    playerEntity.player.ui.sendData({
      type: 'playTeleportFailSound'
    });
    world.chatManager.sendPlayerMessage(playerEntity.player, 'No Partner Found!', 'FFFFFF');
    return;
  }

  // Teleport to partner's location
  playerEntity.setPosition(partnerEntity.position);
  
  // Play successful teleport sound
  playerEntity.player.ui.sendData({
    type: 'playTeleportSuccessSound'
  });
  
  // Deduct teleport charge
  playerTeleportCharges[playerId]--;

  // Send success messages to both players
  world.chatManager.sendPlayerMessage(playerEntity.player, 
    `Teleported to ${playerNickname[partnerId]}!`, '00FF00');
  
  world.chatManager.sendPlayerMessage(partnerEntity.player, 
    `${playerNickname[playerId]} teleported to you!`, '00FF00');

  // Notify player of successful teleport and remaining charges
  playerEntity.player.ui.sendData({
    type: 'teleportSuccess',
    remainingCharges: playerTeleportCharges[playerId]
  });
 }

 // Lighting ****************************************************************************************

 //world.setAmbientLightIntensity(0.8); // Reduce ambient light intensity
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


 // Register chat commands

 world.chatManager.registerCommand('!about', (player, args, message) => {
   player.ui.sendData({
     type: 'showAboutOverlay'
   });
 });

 world.chatManager.registerCommand('!tips', (player, args, message) => {
   player.ui.sendData({
     type: 'showTipsOverlay'
   });
 });

 world.chatManager.registerCommand('!credits', (player, args, message) => {
  player.ui.sendData({
    type: 'showCreditsOverlay'
  });
});

 // Mind Flayer NPC Movement **********************************************
 
 let targetWaypointIndex = 0;

 const WAYPOINT_COORDINATES = [
   { x: 23, y: 1, z: 30 },
   { x: -16, y: 1, z: 32 },
   { x: -25, y: 1, z: 17 },
   { x: 13, y: 1, z: 2 },
   {x: 27, y: 1, z: 8 },
   {x: 36, y: 1, z: 18 },

 ];
 
 const mindFlayer = new Entity({
   controller: new SimpleEntityController(),
   modelUri: 'models/npcs/mindflayer.gltf',
   modelScale: 0.6,
   modelLoopedAnimations: [ 'walk' ],
   modelAnimationsPlaybackRate: 1.5, // roughly match the animation speed to the move speed we'll use
   rigidBodyOptions: {

     enabledRotations: { x: false, y: true, z: false }, // prevent flipping over when moving
   },
 });
 
 // We want to face towards the target each tick, since our relative position
 // to the target may change as we move from a previous waypoint to the next.
 mindFlayer.onTick = () => {
   // Remove the early return since we want to keep rotating even after last waypoint
   const controller = mindFlayer.controller as SimpleEntityController;
   // Use modulo to wrap around to first waypoint
   const currentWaypoint = WAYPOINT_COORDINATES[targetWaypointIndex % WAYPOINT_COORDINATES.length];
   controller.face(currentWaypoint, 5);
 };
 
 mindFlayer.spawn(world, { x: 32, y: 4, z: 11 });
 
 // Pathfind to the next waypoint as we reach each waypoint
 const pathfind = () => {
   if (targetWaypointIndex >= WAYPOINT_COORDINATES.length) {
 
     targetWaypointIndex = 0;
   }
       
   const controller = mindFlayer.controller as SimpleEntityController;
   const targetWaypoint = WAYPOINT_COORDINATES[targetWaypointIndex];
     
   controller.move(targetWaypoint, 1, {
     moveCompleteCallback: () => {
       // Increment waypoint index and continue pathfinding
       targetWaypointIndex++; 
       pathfind();
     },
     moveIgnoreAxes: { x: false, y: true, z: false },
   });
 };
 
 pathfind();

});





