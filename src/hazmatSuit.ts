// Handles the spawning and despawning of the hazmat suit child entities

import { World, Entity, PlayerEntity } from 'hytopia';

export function spawnHazmatSuit(world: World, playerEntity: PlayerEntity) {
  // Helmet
  const hazmatHelmet = new Entity({
    name: 'hazmatHelmet',
    modelUri: 'models/volcano-dash/hazmatHelmet.gltf',
    parent: playerEntity,
    parentNodeName: 'head_anchor',
  });

  hazmatHelmet.spawn(
    world,
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0, w: 0 }
  );

  // Left Arm
  const hazmatLeftArm = new Entity({
    name: 'hazmatLeftArm',
    modelUri: 'models/volcano-dash/hazmatLeftArm.gltf',
    parent: playerEntity,
    parentNodeName: 'arm_left_anchor',
  });

  hazmatLeftArm.spawn(
    world,
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0, w: 0 }
  );

  // Right Arm
  const hazmatRightArm = new Entity({
    name: 'hazmatRightArm',
    modelUri: 'models/volcano-dash/hazmatRightArm.gltf',
    parent: playerEntity,
    parentNodeName: 'arm_right_anchor',
  });

  hazmatRightArm.spawn(
    world,
    { x: 0, y: 0.1, z: 0 },
    { x: 0, y: 0, z: 0, w: 0 }
  );

  // Torso
  const hazmatTorso = new Entity({
    name: 'hazmatTorso',
    modelUri: 'models/volcano-dash/hazmatTorso.gltf',
    parent: playerEntity,
    parentNodeName: 'torso_anchor',
  });

  hazmatTorso.spawn(
    world,
    { x: 0, y: 0.1, z: 0 },
    { x: 0, y: 0, z: 0, w: 0 }
  );

  // Backpack
  const hazmatBackpack = new Entity({
    name: 'hazmatBackpack',
    modelUri: 'models/volcano-dash/hazmatBackpack.gltf',
    parent: playerEntity,
    parentNodeName: 'back_anchor',
  });

  hazmatBackpack.spawn(
    world,
    { x: 0, y: 0.1, z: 0 },
    { x: 0, y: 0, z: 0, w: 0 }
  );

  // Left Hand
  const hazmatLeftHand = new Entity({
    name: 'hazmatLeftHand',
    modelUri: 'models/volcano-dash/hazmatLeftHand.gltf',
    parent: playerEntity,
    parentNodeName: 'hand_left_anchor',
  });

  hazmatLeftHand.spawn(
    world,
    { x: 0, y: 0.1, z: 0 },
    { x: 0, y: 0, z: 0, w: 0 }
  );

  // Right Hand
  const hazmatRightHand = new Entity({
    name: 'hazmatRightHand',
    modelUri: 'models/volcano-dash/hazmatLeftHand.gltf',
    parent: playerEntity,
    parentNodeName: 'hand_right_anchor',
  });

  hazmatRightHand.spawn(
    world,
    { x: 0, y: 0.1, z: 0 },
    { x: 0, y: 0, z: 0, w: 0 }
  );

  // Left Leg
  const hazmatLeftLeg = new Entity({
    name: 'hazmatLeftLeg',
    modelUri: 'models/volcano-dash/hazmatLeftLeg.gltf',
    parent: playerEntity,
    parentNodeName: 'leg_left_anchor',
  });

  hazmatLeftLeg.spawn(
    world,
    { x: 0, y: 0.1, z: 0 },
    { x: 0, y: 0, z: 0, w: 0 }
  );

  // Right Leg
  const hazmatRightLeg = new Entity({
    name: 'hazmatRightLeg',
    modelUri: 'models/volcano-dash/hazmatRightLeg.gltf',
    parent: playerEntity,
    parentNodeName: 'leg_right_anchor',
  });

  hazmatRightLeg.spawn(
    world,
    { x: 0, y: 0.1, z: 0 },
    { x: 0, y: 0, z: 0, w: 0 }
  );

  // Left Foot
  const hazmatLeftFoot = new Entity({
    name: 'hazmatLeftFoot',
    modelUri: 'models/volcano-dash/hazmatLeftFoot.gltf',
    parent: playerEntity,
    parentNodeName: 'foot_left_anchor',
  });

  hazmatLeftFoot.spawn(
    world,
    { x: 0, y: 0.1, z: 0 },
    { x: 0, y: 0, z: 0, w: 0 }
  );

  // Right Foot
  const hazmatRightFoot = new Entity({
    name: 'hazmatRightFoot',
    modelUri: 'models/volcano-dash/hazmatRightFoot.gltf',
    parent: playerEntity,
    parentNodeName: 'foot_right_anchor',
  });

  hazmatRightFoot.spawn(
    world,
    { x: 0, y: 0.1, z: 0 },
    { x: 0, y: 0, z: 0, w: 0 }
  );
}

// Despawn Hazmat Suit Function *********************************************************************************

export function despawnHazmatSuit(world: World, playerEntity: PlayerEntity) {
  // Get all child entities of the player that are part of the hazmat suit
  const hazmatPieces = world.entityManager.getAllEntities().filter(entity => {
    return entity.parent === playerEntity && entity.name?.includes('hazmat');
  });

  // Despawn each piece
  hazmatPieces.forEach(piece => {
    piece.despawn();
  });
} 

