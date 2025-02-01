import { World, Entity, RigidBodyType } from 'hytopia';

// Course Constants
export const LAVA_START_X = 14;
export const LAVA_START_Z = -14;


export function buildChamberCourse(world: World) {

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

  // Build static platforms

  lvlA.forEach(([x, y, z, blockId]) => {
    world.chunkLattice.setBlock({ 
      x: LAVA_START_X + x, 
      y, 
      z: LAVA_START_Z + z 
    }, blockId);
  });

  
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
    if (position.x < 16) {
      platform.setLinearVelocity({ x: 3, y: 0, z: 0 });
    }
    if (position.x > 19) {
      platform.setLinearVelocity({ x: -3, y: 0, z: 0 });
    }
  };

  lvlAMovingPlatform1.spawn(world, { x: 16, y: 6, z: -14 });

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
    if (position.x < 11) {
      platform.setLinearVelocity({ x: 3, y: 0, z: 0 });
    }
    if (position.x > 14) {
      platform.setLinearVelocity({ x: -3, y: 0, z: 0 });
    }
  };

  lvlAMovingPlatform2.spawn(world, { x: 14, y: 6, z: -12 });

  // Level A Vertical Platforms to Level B ****************************************************************

  const lvlAVertPlatform1 = new Entity({
    blockTextureUri: 'blocks/lavaStone.png',
    blockHalfExtents: { x: 1, y: 0.5, z: 3 },
    rigidBodyOptions: {
      type: RigidBodyType.KINEMATIC_VELOCITY,
      linearVelocity: { x: 0, y: 3, z: 0 },
    },
  });


  lvlAVertPlatform1.onTick = platform => { 
    const position = platform.position;
    if (position.y < 6) {
      platform.setLinearVelocity({ x: 0, y: 3, z: 0 });

    }
    if (position.y > 11) {
      platform.setLinearVelocity({ x: 0, y: -3, z: 0 });
    }
  };

  lvlAVertPlatform1.spawn(world, { x: 22, y: 15, z: -13 });


  const lvlAVertPlatform2 = new Entity({
    blockTextureUri: 'blocks/lavaStone.png',
    blockHalfExtents: { x: 1, y: 0.5, z: 3 },
    rigidBodyOptions: {
      type: RigidBodyType.KINEMATIC_VELOCITY,
      linearVelocity: { x: 0, y: 3, z: 0 },
    },
  });


  lvlAVertPlatform2.onTick = platform => { 
    const position = platform.position;
    if (position.y < 6) {
      platform.setLinearVelocity({ x: 0, y: 3, z: 0 });

    }
    if (position.y > 11) {
      platform.setLinearVelocity({ x: 0, y: -3, z: 0 });
    }
  };

  lvlAVertPlatform2.spawn(world, { x: 8, y: 15, z: -13 });

  // Level B Course Platforms ****************************************************************

  const lvlBheight = 10;
  const lvlB = [
    // First level
    [4,0,-3,101], [-3,0,-3,101], [-3,0,4,101], [4,0,4,101],
    [4,0,1,101], [4,0,0,101], [-3,0,1,101], [-3,0,0,101],
    [1,0,-3,101], [0,0,-3,101], [0,0,4,101], [1,0,4,101],
    [4,0,2,104], [4,0,3,104], [3,0,4,104], [2,0,4,104],
    [-1,0,4,104], [-2,0,4,104], [-3,0,3,104], [-3,0,2,104],
    [-3,0,-1,104], [-3,0,-2,104], [-2,0,-3,104], [-1,0,-3,104],
    [2,0,-3,104], [3,0,-3,104], [4,0,-2,104], [4,0,-1,104],
    [7,0,-6,104], [-6,0,-6,104], [-6,0,7,104], [7,0,7,104],
    [9,0,9,104], [9,0,10,104], [9,0,-9,104], [9,0,-8,104],
    [10,0,-9,104], [10,0,-8,104], [-9,0,-9,104], [-8,0,-9,104],
    [-9,0,-8,104], [-8,0,-8,104], [-9,0,9,104], [-8,0,9,104],
    [-9,0,10,104], [-8,0,10,104], [10,0,9,104], [10,0,10,104],
    [5,0,0,101], [5,0,1,101], [-4,0,0,101], [-4,0,1,101],
    [0,0,0,107], [0,0,1,107], [1,0,1,107], [1,0,0,107],
    [0,0,5,101], [1,0,5,101], [0,0,-4,101], [1,0,-4,101],
    [0,0,7,101], [1,0,7,101], [0,0,8,104], [0,0,9,104],
    [1,0,9,104], [1,0,8,104], [0,0,-6,101], [1,0,-6,101],
    [0,0,-8,104], [0,0,-7,104], [1,0,-8,104], [1,0,-7,104],
    [7,0,10,104], [7,0,9,104], [6,0,10,104], [5,0,10,104],
    [-6,0,10,104], [-6,0,9,104], [-5,0,10,104], [-5,0,9,104],
    [-4,0,10,104], [-4,0,9,104], [6,0,9,104], [5,0,9,104],
    [-3,0,10,107], [-2,0,10,107], [-1,0,10,107], [0,0,10,107],
    [1,0,10,107], [2,0,10,107], [3,0,10,107], [4,0,10,107],
    [-6,0,-9,104], [-6,0,-8,104], [-5,0,-9,104], [-5,0,-8,104],
    [-4,0,-9,104], [-4,0,-8,104], [4,0,9,107], [3,0,9,107],
    [2,0,9,107], [-1,0,9,107], [-2,0,9,107], [-3,0,9,107],
    [-3,0,-8,107], [-3,0,-9,107], [-2,0,-8,107], [-2,0,-9,107],
    [-1,0,-8,107], [-1,0,-9,107], [0,0,-9,107], [1,0,-9,107],
    [2,0,-9,107], [2,0,-8,107], [3,0,-8,107], [3,0,-9,107],
    [4,0,-9,107], [4,0,-8,107], [7,0,-8,104], [7,0,-9,104],
    
    // First layer 
    [1,1,9,104], [0,1,9,104], [0,1,-8,104], [1,1,-8,104],
    [0,1,10,104], [1,1,10,104], [6,1,10,104], [5,1,10,104],
    [-5,1,10,104], [-5,1,9,104], [-4,1,10,104], [-4,1,9,104],
    [6,1,9,104], [5,1,9,104], [-3,1,10,107], [-2,1,10,107],
    [-1,1,10,107], [2,1,10,107], [3,1,10,107], [4,1,10,107],
    [-3,1,9,107], [-2,1,9,107], [-1,1,9,107], [2,1,9,107],
    [3,1,9,107], [4,1,9,107], [4,1,-9,107], [3,1,-9,107],
    [2,1,-9,107], [-3,1,-9,107], [-2,1,-9,107], [-1,1,-9,107],
    [1,1,-9,104], [0,1,-9,104], [-5,1,-9,104], [-5,1,-8,104],
    [-4,1,-9,104], [-4,1,-8,104], [6,1,-8,104], [6,1,-9,104],
    [5,1,-8,104], [5,1,-9,104],

    // Second layer 
    [5,2,10,104], [1,2,10,104], [0,2,10,104], [4,2,10,104],
    [3,2,10,104], [2,2,10,104], [-4,2,10,104], [-1,2,10,104],
    [-2,2,10,104], [-3,2,10,104], [5,2,9,104], [4,2,9,104],
    [3,2,9,104], [2,2,9,104], [-3,2,9,104], [-2,2,9,104],
    [-1,2,9,104], [-4,2,9,104], [4,2,-9,104], [3,2,-9,104],
    [2,2,-9,104], [-1,2,-9,104], [-2,2,-9,104], [-3,2,-9,104],
    [-3,2,-8,104], [-2,2,-8,104], [-1,2,-8,104], [4,2,-8,104],
    [3,2,-8,104], [2,2,-8,104], [5,2,-8,104], [5,2,-9,104],
    [-4,2,-9,104], [-4,2,-8,104],

    // Third layer 
    [5,3,10,104], [4,3,10,104], [3,3,10,104], [-4,3,-9,104],
    [-3,3,-9,104], [-2,3,-9,104], [5,3,-9,104], [4,3,-9,104],
    [3,3,-9,104], [-4,3,10,104], [-3,3,10,104], [-2,3,10,104],

    // Fourth layer 
    [5,4,10,104], [4,4,10,104], [-4,4,10,104], [-3,4,10,104],
    [-4,4,-9,104], [-3,4,-9,104], [5,4,-9,104], [4,4,-9,104],

    // Fifth layer 
    [-4,5,10,101], [5,5,10,101], [-4,5,-9,101], [5,5,-9,101]
  ];

  // Build static platforms

  lvlB.forEach(([x, y, z, blockId]) => {
    world.chunkLattice.setBlock({ 
      x: LAVA_START_X + x,
      y: lvlBheight + y, 
      z: LAVA_START_Z + z
    }, blockId);
  });

  // Level B Center Moving Platforms ****************************************************************

  const lvlBMovingPlatform1 = new Entity({
    blockTextureUri: 'blocks/moltenRock.png',
    blockHalfExtents: { x: 1.5, y: 0.5, z: 1.5 },
    rigidBodyOptions: {
      type: RigidBodyType.KINEMATIC_VELOCITY,
      linearVelocity: { x: -1, y: 0, z: -3 },
    },
  });

  lvlBMovingPlatform1.onTick = platform => { 
    const position = platform.position;
    if (position.x < 19.5) {
      platform.setLinearVelocity({ x: 1, y: 0, z: 3 });
    }
    if (position.x > 20.5) {
      platform.setLinearVelocity({ x: -1, y: 0, z: -3 });
    }
  };

  lvlBMovingPlatform1.spawn(world, { x: 20.5, y: 15.5, z: -5.5 });

  const lvlBMovingPlatform2 = new Entity({
    blockTextureUri: 'blocks/moltenRock.png',
    blockHalfExtents: { x: 1.5, y: 0.5, z: 1.5 },
    rigidBodyOptions: {
      type: RigidBodyType.KINEMATIC_VELOCITY,
      linearVelocity: { x: -1, y: 0, z: 3 },
    },
  });

  lvlBMovingPlatform2.onTick = platform => { 
    const position = platform.position;
    if (position.x < 19.5) {
      platform.setLinearVelocity({ x: 1, y: 0, z: -3 });
    }
    if (position.x > 20.5) {
      platform.setLinearVelocity({ x: -1, y: 0, z: 3 });
    }
  };

  lvlBMovingPlatform2.spawn(world, { x: 20.5, y: 15.5, z: -20.5 });

  const lvlBMovingPlatform3 = new Entity({
    blockTextureUri: 'blocks/moltenRock.png',
    blockHalfExtents: { x: 1.5, y: 0.5, z: 1.5 },
    rigidBodyOptions: {
      type: RigidBodyType.KINEMATIC_VELOCITY,
      linearVelocity: { x: 1, y: 0, z: -3 },
    },
  });

  lvlBMovingPlatform3.onTick = platform => { 
    const position = platform.position;
    if (position.x < 9.5) {
      platform.setLinearVelocity({ x: 1, y: 0, z: -3 });
    }
    if (position.x > 10.5) {
      platform.setLinearVelocity({ x: -1, y: 0, z: 3 });
    }
  };

  lvlBMovingPlatform3.spawn(world, { x: 9.5, y: 15.5, z: -5.5 });

  const lvlBMovingPlatform4 = new Entity({
    blockTextureUri: 'blocks/moltenRock.png',
    blockHalfExtents: { x: 1.5, y: 0.5, z: 1.5 },
    rigidBodyOptions: {
      type: RigidBodyType.KINEMATIC_VELOCITY,
      linearVelocity: { x: -1, y: 0, z: -3 },
    },
  });

  lvlBMovingPlatform4.onTick = platform => { 
    const position = platform.position;
    if (position.x < 9.5) {
      platform.setLinearVelocity({ x: 1, y: 0, z: 3 });
    }
    if (position.x > 10.5) {
      platform.setLinearVelocity({ x: -1, y: 0, z: -3 });
    }

  };

  lvlBMovingPlatform4.spawn(world, { x: 9.5, y: 15.5, z: -20.5 });

  // Level C Course Platforms ****************************************************************

  const lvlCheight = 15;
  const lvlC = [

    // Ground Layer
    [4,0,2,104], [4,0,3,104], [3,0,4,104], [2,0,4,104], [-1,0,4,104], [-2,0,4,104],
    [-3,0,3,104], [-3,0,2,104], [-3,0,-1,104], [-3,0,-2,104], [-2,0,-3,104], [-1,0,-3,104],
    [2,0,-3,104], [3,0,-3,104], [4,0,-2,104], [4,0,-1,104], [0,0,0,107], [1,0,1,107],
    [1,0,0,107], [0,0,1,107], [-1,0,2,106], [0,0,2,106], [1,0,2,106], [2,0,2,106],
    [2,0,1,106], [2,0,0,106], [2,0,-1,106], [1,0,-1,106], [0,0,-1,106], [-1,0,-1,106],
    [-1,0,1,106], [-1,0,0,106], [3,0,3,104], [3,0,2,104], [3,0,1,104], [3,0,0,104],
    [3,0,-1,104], [3,0,-2,104], [2,0,-2,104], [1,0,-2,104], [0,0,-2,104], [-1,0,-2,104],
    [-2,0,-2,104], [-2,0,-1,104], [-2,0,0,104], [-2,0,1,104], [-2,0,2,104], [-2,0,3,104],
    [-1,0,3,104], [0,0,3,104], [1,0,3,104], [2,0,3,104], [1,0,-3,104], [0,0,-3,104],
    [4,0,1,104], [4,0,0,104], [1,0,4,104], [0,0,4,104], [-3,0,1,104], [-3,0,0,104],
    [-4,0,3,102], [-4,0,2,102], [-4,0,1,102], [-4,0,0,102], [-4,0,-1,102], [-4,0,-2,102],
    [-2,0,-4,102], [-1,0,-4,102], [0,0,-4,102], [1,0,-4,102], [2,0,-4,102], [3,0,-4,102],
    [5,0,3,102], [5,0,2,102], [5,0,1,102], [5,0,0,102], [5,0,-1,102], [5,0,-2,102],
    [3,0,5,102], [2,0,5,102], [1,0,5,102], [0,0,5,102], [-1,0,5,102], [-2,0,5,102],

    // First layer 
    [-4,1,3,102], [-4,1,-2,102], [-2,1,-4,102], [3,1,-4,102], [5,1,-2,102], [5,1,3,102],
    [-2,1,5,102], [3,1,5,102], [-2,1,-5,102], [3,1,-5,102], [2,1,-5,101], [1,1,-5,101],
    [0,1,-5,101], [-1,1,-5,101], [6,1,-2,102], [6,1,3,102], [6,1,-1,101], [6,1,0,101],
    [6,1,1,101], [6,1,2,101], [2,1,6,101], [1,1,6,101], [0,1,6,101], [-1,1,6,101],
    [-5,1,-2,102], [-5,1,3,102], [-5,1,-1,101], [-5,1,0,101], [-5,1,1,101], [-5,1,2,101],

    // Second layer 
    [3,2,-5,102], [-2,2,-5,102], [3,2,-6,102], [2,2,-6,102], [1,2,-6,102], [0,2,-6,102],
    [-1,2,-6,102], [-2,2,-6,102], [-5,2,3,102], [-5,2,-2,102], [-6,2,-2,102], [-6,2,3,102],
    [-6,2,-1,102], [-6,2,0,102], [-6,2,1,102], [-6,2,2,102], [6,2,-2,102], [6,2,3,102],
    [7,2,3,102], [7,2,-2,102], [7,2,-1,102], [7,2,0,102], [7,2,1,102], [7,2,2,102],
    [2,2,7,102], [1,2,7,102], [0,2,7,102], [-1,2,7,102],

    // Third layer 
    [-2,3,-6,102], [3,3,-6,102], [3,3,-7,102], [-2,3,-7,102], [2,3,-7,101], [1,3,-7,101],
    [0,3,-7,101], [-1,3,-7,101], [-6,3,-2,102], [-6,3,3,102], [-7,3,-2,102], [-7,3,3,102],
    [-7,3,-1,101], [-7,3,0,101], [-7,3,1,101], [-7,3,2,101], [7,3,3,102], [7,3,-2,102],
    [8,3,-2,102], [8,3,3,102], [8,3,-1,101], [8,3,0,101], [8,3,1,101], [8,3,2,101],
    [2,3,8,101], [1,3,8,101], [0,3,8,101], [-1,3,8,101],

    // Fourth layer 
    [3,4,-7,102], [-2,4,-7,102], [3,4,-8,102], [2,4,-8,102], [1,4,-8,102], [0,4,-8,102],
    [-1,4,-8,102], [-2,4,-8,102], [-7,4,-2,102], [-7,4,3,102], [-8,4,-2,102], [-8,4,-1,102],
    [-8,4,0,102], [-8,4,1,102], [-8,4,2,102], [-8,4,3,102], [8,4,-2,102], [8,4,3,102],
    [9,4,-2,102], [9,4,-1,102], [9,4,0,102], [9,4,1,102], [9,4,2,102], [9,4,3,102],
    [2,4,9,102], [1,4,9,102], [0,4,9,102], [-1,4,9,102], [-2,4,10,102], [-1,4,10,102],
    [0,4,10,102], [1,4,10,102], [2,4,10,102], [3,4,10,102], [-9,4,-2,102], [-9,4,-1,102],
    [-9,4,0,102], [-9,4,1,102], [-9,4,2,102], [-9,4,3,102], [3,4,-9,102], [2,4,-9,102],
    [1,4,-9,102], [0,4,-9,102], [-1,4,-9,102], [-2,4,-9,102], [10,4,3,102], [10,4,2,102],
    [10,4,1,102], [10,4,0,102], [10,4,-1,102], [10,4,-2,102], [4,4,-9,104], [5,4,-9,104],
    [6,4,-9,104], [7,4,-9,104], [8,4,-9,104], [9,4,-9,104], [10,4,-3,104], [10,4,-4,104],
    [10,4,-5,104], [10,4,-6,104], [10,4,-7,104], [10,4,-8,104], [10,4,-9,104], [10,4,4,104],
    [10,4,5,104], [10,4,6,104], [10,4,7,104], [10,4,8,104], [10,4,9,104], [4,4,10,104],
    [5,4,10,104], [6,4,10,104], [7,4,10,104], [8,4,10,104], [9,4,10,104], [10,4,10,104],
    [-9,4,4,104], [-9,4,5,104], [-9,4,6,104], [-9,4,7,104], [-9,4,8,104], [-9,4,9,104],
    [-9,4,10,104], [-3,4,10,104], [-4,4,10,104], [-5,4,10,104], [-6,4,10,104], [-7,4,10,104],
    [-8,4,10,104], [-9,4,-3,104], [-9,4,-4,104], [-9,4,-5,104], [-9,4,-6,104], [-9,4,-7,104],
    [-9,4,-8,104], [-3,4,-9,104], [-4,4,-9,104], [-5,4,-9,104], [-6,4,-9,104], [-7,4,-9,104],
    [-8,4,-9,104], [-9,4,-9,104]
  ];

  lvlC.forEach(([x, y, z, blockId]) => {
    world.chunkLattice.setBlock({ 
      x: LAVA_START_X + x,
      y: lvlCheight + y, 
      z: LAVA_START_Z + z
    }, blockId);
  });

} 

