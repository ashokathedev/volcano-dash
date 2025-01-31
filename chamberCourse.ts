import { World, Entity, RigidBodyType } from 'hytopia';

// Course Constants
export const LAVA_START_X = 14;
export const LAVA_START_Z = -14;

// Level A Course Configuration
const lvlAheight = 2;

export function buildChamberCourse(world: World) {
  // Level A Course Platforms ***********************************************
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

  // Build static platforms
  lvlA.forEach(([x, y, z, blockId]) => {
    world.chunkLattice.setBlock({ 
      x: LAVA_START_X + x, 
      y, 
      z: LAVA_START_Z + z 
    }, blockId);
  });

  // Create moving platforms
  createMovingPlatforms(world);
}

function createMovingPlatforms(world: World) {
  // Level A Center Moving Platforms ****************************************************************
  const lvlAMovingPlatform1 = new Entity({
    blockTextureUri: 'blocks/moltenRock.png',
    blockHalfExtents: { x: 2, y: 0.5, z: 1 },
    rigidBodyOptions: {
      type: RigidBodyType.KINEMATIC_VELOCITY,
      linearVelocity: { x: 3, y: 0, z: 0 },
    },
  });

  lvlAMovingPlatform1.onTick = platform => { 
    const position = platform.position;
    if (position.x < 15) {
      platform.setLinearVelocity({ x: 3, y: 0, z: 0 });
    }
    if (position.x > 22) {
      platform.setLinearVelocity({ x: -3, y: 0, z: 0 });
    }
  };

  lvlAMovingPlatform1.spawn(world, { x: 15, y: 6, z: -14 });

  const lvlAMovingPlatform2 = new Entity({
    blockTextureUri: 'blocks/moltenRock.png',
    blockHalfExtents: { x: 2, y: 0.5, z: 1 },
    rigidBodyOptions: {
      type: RigidBodyType.KINEMATIC_VELOCITY,
      linearVelocity: { x: 3, y: 0, z: 0 },
    },
  });

  lvlAMovingPlatform2.onTick = platform => { 
    const position = platform.position;
    if (position.x < 8) {
      platform.setLinearVelocity({ x: 3, y: 0, z: 0 });
    }
    if (position.x > 15) {
      platform.setLinearVelocity({ x: -3, y: 0, z: 0 });
    }
  };

  lvlAMovingPlatform2.spawn(world, { x: 15, y: 6, z: -12 });

  const blockVertPlatform = new Entity({
    blockTextureUri: 'blocks/moltenRock.png',
    blockHalfExtents: { x: 1.5, y: 0.5, z: 1.5 },
    rigidBodyOptions: {
      type: RigidBodyType.KINEMATIC_VELOCITY,
      linearVelocity: { x: 0, y: 3, z: 0 },
    },
  });

  blockVertPlatform.onTick = platform => { 
    const position = platform.position;
    if (position.y < 2) {
      platform.setLinearVelocity({ x: 0, y: 3, z: 0 });
    }
    if (position.y > 6) {
      platform.setLinearVelocity({ x: 0, y: -3, z: 0 });
    }
  };

  blockVertPlatform.spawn(world, { x: 22, y: 15, z: -12 });
} 