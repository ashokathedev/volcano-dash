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

import worldMap from './assets/maps/boilerplate.json';

  // Game Config

  const GAME_CONFIG = {
    START_DELAY: 15,
    POSITIONS: {
      ARENA: { x: 6, y: 20, z: 6 }, // Arena Spawn Point
      JOIN_NPC: { x: -20, y: 5, z: 4 }, // Join NPC Spawn Point
      LOBBY: { x: 0, y: 4, z: 0 }, // Lobby ReSpawn Point
      GAME_JOIN: { x: -33, y: 4, z: 1 }, // Game Join Spawn Point
      HEAT_CLUSTER: { x: 6, y: 2, z: 6 } // Heat Cluster Spawn Point
    }
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


startServer(world => {
  
  // Enable debug rendering of the physics simulation.
  // world.simulation.enableDebugRendering(true);

  // Load Map

  world.loadMap(worldMap); //load map
  world.onPlayerJoin = player => onPlayerJoin(world, player);
  world.onPlayerLeave = player => onPlayerLeave(world, player);

  spawnJoinNpc(world);
  spawnHeatCluster(world);


// Constants
const arenaSpawnPoint = { x: 6, y: 20, z: 6 }; // Spawn point for players in lava arena
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

    // Create the player entity

    const playerEntity = new PlayerEntity({
      player,
      name: 'Player',
      modelUri: 'models/players/player.gltf',
      modelLoopedAnimations: ['idle'],
      modelScale: 0.5,
    });
    // Set up UI data handler
    player.ui.onData = (playerUI, data: object) => {
      const typedData = data as { type: string, name: string };
      if (typedData.type === 'setPlayerName') {
        if (playerEntity.id !== undefined) {
          playerNames[playerEntity.id] = typedData.name;
          console.log(`Player ${playerEntity.id} set name to: ${typedData.name}`);
        }
      }
    };

    // Load the UI
    player.ui.load('ui/index.html');
    player.ui.sendData(gameUiState);

    // Initialize player globals
    if (playerEntity.id !== undefined) {
      playerHeatLevel[playerEntity.id] = 1;
      playerInLava[playerEntity.id] = false;
      playerScore[playerEntity.id] = 0;
      playerTopScore[playerEntity.id] = 0;
    }

    // Send UI update every 100ms

    setInterval(() => {
      player.ui.sendData({
        type: 'updatePlayerState',
        heatLevel: playerHeatLevel[playerEntity.id!] ?? 1,
        inLava: playerInLava[playerEntity.id!] ?? false,
        score: playerScore[playerEntity.id!] ?? 0,
        topScore: playerTopScore[playerEntity.id!] ?? 0
      });
    }, 100);
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

function spawnHeatCluster(world: World) {
  const heatCluster = new Entity({
    name: 'Heat Cluster',
    modelUri: 'models/structures/jump-pad.gltf',
    modelLoopedAnimations: ['idle'],
    modelScale: 1,
    opacity: 1,
    rigidBodyOptions: {
      type: RigidBodyType.KINEMATIC_POSITION,
      colliders: [
        {
          shape: ColliderShape.CYLINDER,
          radius: 2,
          halfHeight: 2,
          isSensor: true,
          onCollision: (other: BlockType | Entity, started: boolean) => {
            if (other instanceof PlayerEntity && started) {
              console.log("Player hit heat cluster");
            }
          }
        }
      ],
    },
  });

  heatCluster.spawn(world, GAME_CONFIG.POSITIONS.HEAT_CLUSTER, { x: 0, y: 0, z: 0, w: 0 });

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
          if (!playerScore[playerEntity.id!]) {
            playerScore[playerEntity.id!] = 0;
          }
          playerScore[playerEntity.id!] += scoreRate;
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

}

// End Game Function *******************************************************************************************************

function endGame(world: World) {
  // Only proceed if game is in progress
  if (gameState !== 'inProgress') return;
  
  gameState = 'awaitingPlayers';

  // Send end message to all active players
  ACTIVE_PLAYERS.forEach(playerEntity => {
    playerEntity.player.ui.sendData({
      type: 'shiftEnd',
      message: 'This Shift has Ended. Stand by for Transport.'
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
  }

  // AUDIO STUFF **************************************************************************************

  new Audio({
    uri: 'audio/music/outworld-theme.mp3', 
    loop: true,
    volume: 0.3,
  }).play(world);

});


