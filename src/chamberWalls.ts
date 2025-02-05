import { Entity, RigidBodyType, World } from 'hytopia';

export function buildChamberWalls(world: World) {
  // Chamber Wall Block Entities
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
} 