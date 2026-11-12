import * as THREE from 'three';
import { LevelConfig } from '../types/game';

export interface AnimatedEntity {
  update: (dt: number, time: number) => void;
}

/**
 * Procedural 3D Environment Builder for Going Hop 3D.
 * Builds hyper-realistic, rich, living 3D environments (Veo 3 style) with silky 60 FPS.
 * Provides 15 distinct world themes with per-level procedural variations so no two levels look identical!
 */
export class EnvironmentBuilder {
  private static animatedEntities: AnimatedEntity[] = [];

  public static update(dt: number, time: number) {
    for (let i = 0; i < this.animatedEntities.length; i++) {
      this.animatedEntities[i].update(dt, time);
    }
  }

  /**
   * Recursively disposes of all geometries and materials in a group
   */
  public static dispose(group: THREE.Group) {
    this.animatedEntities = [];
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => m.dispose());
            } else {
              mesh.material.dispose();
            }
          }
        }
      });
    }
  }

  /**
   * Helper: create a low-poly animated flying seagull/bird with flapping wings
   */
  private static createAnimatedBird(basePos: THREE.Vector3, orbitRadius: number = 24, speed: number = 0.8): THREE.Group {
    const bird = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
    const tipMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });

    // Fuselage
    const bodyGeo = new THREE.ConeGeometry(0.18, 0.9, 5);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    bird.add(body);

    // Left Wing Group
    const leftWingGroup = new THREE.Group();
    leftWingGroup.position.set(-0.15, 0.05, 0);
    const leftWingGeo = new THREE.BoxGeometry(0.75, 0.03, 0.3);
    const leftWing = new THREE.Mesh(leftWingGeo, wingMat);
    leftWing.position.set(-0.38, 0, 0);
    leftWingGroup.add(leftWing);

    const leftTipGeo = new THREE.BoxGeometry(0.3, 0.03, 0.2);
    const leftTip = new THREE.Mesh(leftTipGeo, tipMat);
    leftTip.position.set(-0.85, 0.08, 0);
    leftWingGroup.add(leftTip);
    bird.add(leftWingGroup);

    // Right Wing Group
    const rightWingGroup = new THREE.Group();
    rightWingGroup.position.set(0.15, 0.05, 0);
    const rightWingGeo = new THREE.BoxGeometry(0.75, 0.03, 0.3);
    const rightWing = new THREE.Mesh(rightWingGeo, wingMat);
    rightWing.position.set(0.38, 0, 0);
    rightWingGroup.add(rightWing);

    const rightTipGeo = new THREE.BoxGeometry(0.3, 0.03, 0.2);
    const rightTip = new THREE.Mesh(rightTipGeo, tipMat);
    rightTip.position.set(0.85, 0.08, 0);
    rightWingGroup.add(rightTip);
    bird.add(rightWingGroup);

    bird.position.copy(basePos);

    // Register animation updater
    const angleOffset = Math.random() * Math.PI * 2;
    const flapFreq = 7.5 + Math.random() * 2.5;

    this.animatedEntities.push({
      update: (_dt, time) => {
        // Flap wings
        const flap = Math.sin(time * flapFreq) * 0.42;
        leftWingGroup.rotation.z = flap;
        rightWingGroup.rotation.z = -flap;

        // Circular banking flight path
        const curAngle = angleOffset + time * speed * 0.35;
        bird.position.x = basePos.x + Math.cos(curAngle) * orbitRadius;
        bird.position.z = basePos.z + Math.sin(curAngle) * orbitRadius;
        bird.position.y = basePos.y + Math.sin(time * 1.5) * 1.2;

        // Orient along flight tangent
        bird.rotation.y = -curAngle + Math.PI / 2;
        bird.rotation.z = -Math.cos(curAngle) * 0.22; // bank into turns
      },
    });

    return bird;
  }

  /**
   * Helper: create a living animated water plane with specular shimmer
   */
  private static createAnimatedWater(
    width: number,
    length: number,
    yLevel: number,
    centerZ: number,
    waterColor: number = 0x0284c7
  ): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(width, length, 12, 12);
    const mat = new THREE.MeshStandardMaterial({
      color: waterColor,
      roughness: 0.12,
      metalness: 0.35,
      transparent: true,
      opacity: 0.92,
      depthWrite: true,
    });
    const water = new THREE.Mesh(geo, mat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, yLevel, centerZ);

    const posAttr = geo.attributes.position;
    const initialZ = new Float32Array(posAttr.count);
    for (let i = 0; i < posAttr.count; i++) {
      initialZ[i] = posAttr.getY(i);
    }

    this.animatedEntities.push({
      update: (_dt, time) => {
        for (let i = 0; i < posAttr.count; i++) {
          const vx = posAttr.getX(i);
          const vy = initialZ[i];
          const wave = Math.sin(vx * 0.08 + time * 1.8) * 0.22 + Math.cos(vy * 0.06 + time * 1.4) * 0.18;
          posAttr.setZ(i, wave);
        }
        posAttr.needsUpdate = true;
      },
    });

    return water;
  }

  /**
   * Helper: create a cascading waterfall
   */
  private static createWaterfall(height: number, width: number = 2.5): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(width, height);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = -height / 2;

    this.animatedEntities.push({
      update: (_dt, time) => {
        mat.opacity = 0.8 + Math.sin(time * 12) * 0.08;
      },
    });

    return mesh;
  }

  /**
   * Helper: create fluffy drifting cumulus cloud cluster
   */
  private static createCloudCluster(scale: number = 1.0, driftSpeed: number = 0.6): THREE.Group {
    const cloud = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      transparent: true,
      opacity: 0.88,
    });

    const puffs = [
      { x: 0, y: 0, z: 0, r: 3.2 * scale },
      { x: 2.2 * scale, y: -0.4 * scale, z: 0.5 * scale, r: 2.5 * scale },
      { x: -2.2 * scale, y: -0.4 * scale, z: -0.5 * scale, r: 2.5 * scale },
      { x: 0.8 * scale, y: 1.2 * scale, z: 0, r: 2.2 * scale },
      { x: -0.8 * scale, y: 0.8 * scale, z: 0.8 * scale, r: 2.0 * scale },
    ];

    for (const p of puffs) {
      const geo = new THREE.DodecahedronGeometry(p.r, 1);
      const mesh = new THREE.Mesh(geo, cloudMat);
      mesh.position.set(p.x, p.y, p.z);
      cloud.add(mesh);
    }

    if (driftSpeed > 0) {
      this.animatedEntities.push({
        update: (dt) => {
          cloud.position.x += driftSpeed * dt;
          if (cloud.position.x > 80) {
            cloud.position.x = -80;
          }
        },
      });
    }

    return cloud;
  }

  /**
   * Helper: create detailed sailboat / yacht bobbing on water
   */
  private static createBobbingBoat(pos: THREE.Vector3, isYacht: boolean = false): THREE.Group {
    const boat = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: isYacht ? 0x0f172a : 0xf8fafc, roughness: 0.3 });
    const sailMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });

    // Hull
    const hullGeo = new THREE.BoxGeometry(2.4, 1.2, 5.5);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = 0.5;
    boat.add(hull);

    // Mast
    const mastGeo = new THREE.CylinderGeometry(0.08, 0.08, 5.5, 6);
    const mast = new THREE.Mesh(mastGeo, woodMat);
    mast.position.set(0, 3.2, 0);
    boat.add(mast);

    // Main Triangular Sail
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0);
    sailShape.lineTo(2.2, 0.4);
    sailShape.lineTo(0, 4.4);
    sailShape.closePath();
    const sailGeo = new THREE.ShapeGeometry(sailShape);
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0, 1.2, -0.2);
    boat.add(sail);

    boat.position.copy(pos);

    // Bobbing animation
    const bobOffset = Math.random() * Math.PI * 2;
    this.animatedEntities.push({
      update: (_dt, time) => {
        boat.position.y = pos.y + Math.sin(time * 1.6 + bobOffset) * 0.16;
        boat.rotation.z = Math.sin(time * 1.2 + bobOffset) * 0.05;
        boat.rotation.x = Math.cos(time * 1.4 + bobOffset) * 0.04;
      },
    });

    return boat;
  }

  /**
   * Helper: create a volumetric glowing sun disk and celestial light halo
   */
  private static createVolumetricSun(pos: THREE.Vector3, colorHex: number = 0xffedd5, size: number = 14): THREE.Group {
    const sunGroup = new THREE.Group();
    sunGroup.position.copy(pos);

    // Core blazing sun sphere
    const sunCore = new THREE.Mesh(
      new THREE.SphereGeometry(size, 20, 20),
      new THREE.MeshBasicMaterial({ color: colorHex })
    );
    sunGroup.add(sunCore);

    // Glowing outer corona ring
    const coronaGeo = new THREE.RingGeometry(size * 1.05, size * 2.6, 28);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const corona = new THREE.Mesh(coronaGeo, coronaMat);
    sunGroup.add(corona);

    return sunGroup;
  }

  /**
   * Helper: create atmospheric gradient sky dome
   */
  private static createAtmosphericSkyDome(topHex: string, botHex: string): THREE.Mesh {
    const geo = new THREE.SphereGeometry(240, 24, 16);
    const topColor = new THREE.Color(topHex);
    const botColor = new THREE.Color(botHex);

    const colors = new Float32Array(geo.attributes.position.count * 3);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const alpha = Math.max(0, Math.min(1, (y + 40) / 280));
      const col = new THREE.Color().lerpColors(botColor, topColor, alpha);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthWrite: false,
    });

    const sky = new THREE.Mesh(geo, mat);
    sky.position.set(0, 0, 50);
    return sky;
  }

  /**
   * Main build method: dispatches to theme builders and injects unique level seed variations!
   */
  public static build(
    scene: THREE.Scene,
    group: THREE.Group,
    cfg: LevelConfig,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight
  ) {
    this.dispose(group);

    const type = cfg.planetType || 'sky_islands';
    const trackLength = Math.max(120, cfg.platformsCount * cfg.gapDistance + 50);
    const seed = cfg.id;

    // Apply level specific background and fog
    scene.background = new THREE.Color(cfg.bgTop || '#38bdf8');
    scene.fog = new THREE.Fog(cfg.fogColor || 0xbae6fd, 40, 220);

    // Add realistic atmospheric sky dome
    const skyDome = this.createAtmosphericSkyDome(cfg.bgTop || '#38bdf8', cfg.bgBottom || '#bae6fd');
    group.add(skyDome);

    // Add realistic sun disk for outdoor daylight/sunset biomes (space has its own star/cosmic lighting)
    if (!type.includes('galaxy') && !type.includes('deep_sea') && !type.includes('space') && !type.includes('orbital')) {
      const sunX = (seed % 2 === 0 ? 55 : -55);
      const sunCol = type.includes('desert') || type.includes('sunset') ? 0xf97316 : 0xfff7ed;
      const sun = this.createVolumetricSun(new THREE.Vector3(sunX, 75, trackLength * 0.75), sunCol, 14);
      group.add(sun);
    }

    // 1. Sky Castle Islands (Image 2)
    if (type.includes('sky')) {
      this.buildSkyIslands(scene, group, trackLength, hemiLight, dirLight, seed);
    }
    // 2. Orbital Space Station (Cosmic Earth & ISS)
    else if (type.includes('space_station') || type.includes('orbital')) {
      this.buildOrbitalSpaceStation(scene, group, trackLength, hemiLight, dirLight, seed);
    }
    // 3. Deep Space Nebula & Saturn (Saturn, Asteroids & Nebula Gas)
    else if (type.includes('space_nebula') || type.includes('nebula') || type.includes('saturn')) {
      this.buildDeepSpaceNebula(scene, group, trackLength, hemiLight, dirLight, seed);
    }
    // 4. Coastal City (Image 1)
    else if (type.includes('coastal')) {
      this.buildCoastalCity(scene, group, trackLength, hemiLight, dirLight, seed);
    }
    // 5. Tropical Beach
    else if (type.includes('beach')) {
      this.buildTropicalBeach(scene, group, trackLength, hemiLight, dirLight, seed);
    }
    // 6. Forest Temple
    else if (type.includes('forest') || type.includes('temple')) {
      this.buildForestTemple(scene, group, trackLength, hemiLight, dirLight, seed);
    }
    // 7. Snowy Mountain
    else if (type.includes('snow') || type.includes('mountain')) {
      this.buildSnowyMountain(scene, group, trackLength, hemiLight, dirLight, seed);
    }
    // 8. Tokyo Neon City
    else if (type.includes('tokyo') || type.includes('city') || type.includes('neon')) {
      this.buildTokyoCity(scene, group, trackLength, hemiLight, dirLight, seed);
    }
    // 9. Red Desert
    else if (type.includes('desert')) {
      this.buildRedDesert(scene, group, trackLength, hemiLight, dirLight, seed);
    }
    // 10. Crystal Islands
    else if (type.includes('crystal')) {
      this.buildCrystalIslands(scene, group, trackLength, hemiLight, dirLight, seed);
    }
    // 11. Deep Sea
    else if (type.includes('sea') || type.includes('ocean')) {
      this.buildDeepSea(scene, group, trackLength, hemiLight, dirLight, seed);
    }
    // 12. Bamboo Valley
    else if (type.includes('bamboo')) {
      this.buildBambooValley(scene, group, trackLength, hemiLight, dirLight, seed);
    }
    // 13. Venice Canals
    else if (type.includes('venice')) {
      this.buildVeniceCanals(scene, group, trackLength, hemiLight, dirLight, seed);
    }
    // 14. Volcano Caldera
    else if (type.includes('volcano')) {
      this.buildVolcanoCaldera(scene, group, trackLength, hemiLight, dirLight, seed);
    }
    // 15. Autumn Highlands
    else if (type.includes('autumn')) {
      this.buildAutumnHighlands(scene, group, trackLength, hemiLight, dirLight, seed);
    }
    // 16. Aurora Glacier
    else if (type.includes('aurora') || type.includes('glacier')) {
      this.buildAuroraGlacier(scene, group, trackLength, hemiLight, dirLight, seed);
    }
    // 17. Andromeda Galaxy / Cosmic Deep Space
    else {
      this.buildAndromedaGalaxy(scene, group, trackLength, hemiLight, dirLight, seed);
    }
  }

  // =========================================================================
  // 1. SKY CASTLE ISLANDS (Matches Reference Image 2!)
  // =========================================================================
  private static buildSkyIslands(
    scene: THREE.Scene,
    group: THREE.Group,
    trackLength: number,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    seed: number
  ) {
    hemiLight.color.setHex(0xe0f2fe);
    hemiLight.groundColor.setHex(0x60a5fa);
    hemiLight.intensity = 1.35;

    dirLight.color.setHex(0xfffbeb);
    dirLight.position.set(30, 48, 25);
    dirLight.intensity = 1.6;

    const cliffRockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.95 });
    const lushGrassMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.75 });
    const castleTowerMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.45 });
    const castleRoofMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });

    // Sea of drifting clouds below platforms
    for (let c = 0; c < 16; c++) {
      const cloud = this.createCloudCluster(2.2 + (c % 3) * 0.5, 0.4 + (c % 2) * 0.3);
      cloud.position.set(
        ((c * 17 + seed * 9) % 110) - 55,
        -18 + ((c * 7) % 6) - 3,
        c * (trackLength / 14)
      );
      group.add(cloud);
    }

    // Right Floating Island with Fairy-Tale Castle & Cascading Waterfalls
    const castleIslandX = (seed % 2 === 0) ? 38 : -38;
    const rightIsland = new THREE.Group();
    rightIsland.position.set(castleIslandX, -4, 45 + (seed % 5) * 8);

    const islandRock = new THREE.Mesh(new THREE.ConeGeometry(22, 28, 9), cliffRockMat);
    islandRock.rotation.x = Math.PI;
    islandRock.position.y = -14;
    rightIsland.add(islandRock);

    const topPlateau = new THREE.Mesh(new THREE.CylinderGeometry(22, 21, 2.5, 9), lushGrassMat);
    rightIsland.add(topPlateau);

    const wf1 = this.createWaterfall(24, 4.0);
    wf1.position.set(0, -1, 19.5);
    rightIsland.add(wf1);

    // Castle Citadel
    const castle = new THREE.Group();
    castle.position.set(0, 1.25, -2);
    const keep = new THREE.Mesh(new THREE.BoxGeometry(12, 16, 10), castleTowerMat);
    castle.add(keep);

    const mainTower = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 26, 8), castleTowerMat);
    mainTower.position.set(0, 5, 0);
    castle.add(mainTower);

    const mainRoof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 9, 8), castleRoofMat);
    mainRoof.position.set(0, 22.5, 0);
    castle.add(mainRoof);

    for (const [cx, cz] of [[-6, -5], [6, -5], [-6, 5], [6, 5]]) {
      const spTower = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 20, 8), castleTowerMat);
      spTower.position.set(cx, 2, cz);
      castle.add(spTower);
      const spRoof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 6, 8), castleRoofMat);
      spRoof.position.set(cx, 15, cz);
      castle.add(spRoof);
    }
    rightIsland.add(castle);
    group.add(rightIsland);

    // Left Floating Island with Rustic Cottage & Alpine Pines
    const cottageIslandX = (seed % 2 === 0) ? -36 : 36;
    const leftIsland = new THREE.Group();
    leftIsland.position.set(cottageIslandX, -2, 25 + (seed % 4) * 6);

    const leftRock = new THREE.Mesh(new THREE.ConeGeometry(18, 24, 8), cliffRockMat);
    leftRock.rotation.x = Math.PI;
    leftRock.position.y = -12;
    leftIsland.add(leftRock);

    const leftPlateau = new THREE.Mesh(new THREE.CylinderGeometry(18, 17, 2, 8), lushGrassMat);
    leftIsland.add(leftPlateau);

    const cottage = new THREE.Mesh(new THREE.BoxGeometry(6, 4.5, 5), woodMat);
    cottage.position.set(-2, 2.25, 0);
    leftIsland.add(cottage);

    const cRoof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 3.5, 4), new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 }));
    cRoof.position.set(-2, 6.25, 0);
    cRoof.rotation.y = Math.PI / 4;
    leftIsland.add(cRoof);

    // Alpine pine trees
    for (const [tx, tz, ts] of [[4, -5, 1.2], [-6, 6, 0.9], [5, 4, 1.4], [-7, -4, 1.0]]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * ts, 0.45 * ts, 3 * ts, 6), woodMat);
      trunk.position.set(tx, 1.5 * ts, tz);
      leftIsland.add(trunk);
      const foliage = new THREE.Mesh(new THREE.ConeGeometry(2.2 * ts, 5.5 * ts, 7), new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 }));
      foliage.position.set(tx, 4.5 * ts, tz);
      leftIsland.add(foliage);
    }
    group.add(leftIsland);

    // Dynamic 3D Flying Seagulls soaring through the sky
    const bird1 = this.createAnimatedBird(new THREE.Vector3(15, 6, 25), 18, 0.9);
    group.add(bird1);
    const bird2 = this.createAnimatedBird(new THREE.Vector3(-18, 9, 50), 22, 0.7);
    group.add(bird2);
  }

  // =========================================================================
  // 2. COASTAL METROPOLIS (Matches Reference Image 1!)
  // =========================================================================
  private static buildCoastalCity(
    scene: THREE.Scene,
    group: THREE.Group,
    trackLength: number,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    seed: number
  ) {
    hemiLight.color.setHex(0xe0f2fe);
    hemiLight.groundColor.setHex(0x0284c7);
    hemiLight.intensity = 1.35;

    dirLight.color.setHex(0xfff7ed);
    dirLight.position.set(28, 45, 30);
    dirLight.intensity = 1.6;

    // 1. Shimmering animated turquoise ocean
    const ocean = this.createAnimatedWater(260, trackLength + 100, -14, trackLength / 2, 0x0284c7);
    group.add(ocean);

    // 2. Skyscraper Coastline
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.9 });
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.25 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2, metalness: 0.7 });
    const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const palmFrondMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.7 });

    const coastSide = (seed % 2 === 0) ? 1 : -1;
    const coastBaseX = coastSide * (36 + (seed % 3) * 4);

    // Sandy coastline peninsula
    const coastStrip = new THREE.Mesh(new THREE.BoxGeometry(45, 3, trackLength + 40), sandMat);
    coastStrip.position.set(coastBaseX, -13.5, trackLength / 2);
    group.add(coastStrip);

    // Skyscrapers line the coast
    for (let z = 12; z < trackLength + 20; z += 18) {
      const h = 24 + ((z * 11 + seed * 7) % 36);
      const w = 9 + ((z * 5) % 6);
      const bldg = new THREE.Group();
      bldg.position.set(coastBaseX + ((z % 2) ? 6 : -4), -12 + h / 2, z);

      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), towerMat);
      bldg.add(body);

      // Glass facade panels
      const glass = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, h * 0.85, w * 0.7), glassMat);
      bldg.add(glass);

      // Rooftop antenna or helipad
      if (h > 35) {
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 9, 6), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
        antenna.position.set(0, h / 2 + 4.5, 0);
        bldg.add(antenna);
      }
      group.add(bldg);

      // Palm trees along the beach
      const px = coastBaseX - coastSide * 15 + ((z % 3) - 1) * 2;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 5, 6), palmTrunkMat);
      trunk.position.set(px, -11, z + 5);
      trunk.rotation.z = coastSide * 0.15;
      group.add(trunk);

      const crown = new THREE.Mesh(new THREE.ConeGeometry(3.5, 1.8, 7), palmFrondMat);
      crown.position.set(px + coastSide * 0.5, -8.2, z + 5);
      group.add(crown);
    }

    // Luxury Yachts and sailboats bobbing in the water
    const boat1 = this.createBobbingBoat(new THREE.Vector3(-coastSide * 16, -13.5, 30), true);
    group.add(boat1);
    const boat2 = this.createBobbingBoat(new THREE.Vector3(-coastSide * 25, -13.5, 75), false);
    group.add(boat2);

    // Drifting coastal clouds
    for (let i = 0; i < 8; i++) {
      const cloud = this.createCloudCluster(2.5, 0.5);
      cloud.position.set(-coastSide * (30 + i * 8), 12 + (i % 3) * 3, i * 25);
      group.add(cloud);
    }

    // Animated seagulls
    const seagull1 = this.createAnimatedBird(new THREE.Vector3(0, 4, 30), 20, 0.85);
    group.add(seagull1);
    const seagull2 = this.createAnimatedBird(new THREE.Vector3(-coastSide * 15, 8, 70), 25, 0.7);
    group.add(seagull2);
  }

  // =========================================================================
  // 3. TROPICAL BEACH ATOLL
  // =========================================================================
  private static buildTropicalBeach(
    scene: THREE.Scene,
    group: THREE.Group,
    trackLength: number,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    seed: number
  ) {
    hemiLight.color.setHex(0xa5f3fc);
    hemiLight.groundColor.setHex(0x0ea5e9);
    hemiLight.intensity = 1.35;

    dirLight.color.setHex(0xffedd5);
    dirLight.position.set(25, 45, 20);
    dirLight.intensity = 1.6;

    const ocean = this.createAnimatedWater(260, trackLength + 80, -14, trackLength / 2, 0x06b6d4);
    group.add(ocean);

    const sandMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.95 });
    const palmMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 });

    // Coral atoll islands
    for (let z = 15; z < trackLength; z += 28) {
      const side = (z % 2 === 0 ? 1 : -1) * ((seed % 2) ? -1 : 1);
      const ix = side * (24 + (z % 4) * 4);

      const island = new THREE.Mesh(new THREE.CylinderGeometry(14, 18, 3, 10), sandMat);
      island.position.set(ix, -13.5, z);
      group.add(island);

      // Palm grove
      for (const [ox, oz] of [[-3, -2], [2, 3], [4, -1]]) {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 6, 6), new THREE.MeshStandardMaterial({ color: 0x78350f }));
        trunk.position.set(ix + ox, -10.5, z + oz);
        trunk.rotation.z = (Math.random() - 0.5) * 0.25;
        group.add(trunk);
        const fronds = new THREE.Mesh(new THREE.ConeGeometry(4, 2, 8), palmMat);
        fronds.position.set(ix + ox, -7.2, z + oz);
        group.add(fronds);
      }
    }

    const boat = this.createBobbingBoat(new THREE.Vector3(12, -13.5, 40), false);
    group.add(boat);

    const bird = this.createAnimatedBird(new THREE.Vector3(0, 6, 45), 22, 0.8);
    group.add(bird);
  }

  // =========================================================================
  // 4. FOREST TEMPLE
  // =========================================================================
  private static buildForestTemple(
    scene: THREE.Scene,
    group: THREE.Group,
    trackLength: number,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    seed: number
  ) {
    hemiLight.color.setHex(0xdcfce7);
    hemiLight.groundColor.setHex(0x064e3b);
    hemiLight.intensity = 1.25;

    dirLight.color.setHex(0xfef08a);
    dirLight.position.set(20, 40, 20);
    dirLight.intensity = 1.4;

    const terrainMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.9 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.95 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 });

    // Valley floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(180, trackLength + 80), terrainMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -16, trackLength / 2);
    group.add(floor);

    // Giant ancient pine trees & temple ruins
    for (let z = 10; z < trackLength; z += 16) {
      for (const side of [-1, 1]) {
        const tx = side * (16 + ((z * 7) % 18));
        const th = 14 + ((z * 3) % 12);

        // Giant redwood tree
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, th, 7), new THREE.MeshStandardMaterial({ color: 0x451a03 }));
        trunk.position.set(tx, -16 + th / 2, z);
        group.add(trunk);

        const foliage = new THREE.Mesh(new THREE.ConeGeometry(5.5, 12, 7), foliageMat);
        foliage.position.set(tx, -16 + th + 4, z);
        group.add(foliage);
      }

      // Ancient stone temple shrine
      if (z % 32 === 0) {
        const shrine = new THREE.Group();
        shrine.position.set(((z % 4) ? 22 : -22), -15, z);
        const base = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 10), stoneMat);
        shrine.add(base);
        for (const [px, pz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 8, 6), stoneMat);
          col.position.set(px, 4, pz);
          shrine.add(col);
        }
        const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 4, 4), stoneMat);
        roof.position.set(0, 10, 0);
        roof.rotation.y = Math.PI / 4;
        shrine.add(roof);
        group.add(shrine);
      }
    }
  }

  // =========================================================================
  // 5. SNOWY ALPINE MOUNTAIN
  // =========================================================================
  private static buildSnowyMountain(
    scene: THREE.Scene,
    group: THREE.Group,
    trackLength: number,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    seed: number
  ) {
    hemiLight.color.setHex(0xe0f2fe);
    hemiLight.groundColor.setHex(0x38bdf8);
    hemiLight.intensity = 1.35;

    dirLight.color.setHex(0xffffff);
    dirLight.position.set(30, 45, 20);
    dirLight.intensity = 1.6;

    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.95 });

    // Jagged alpine mountain peaks flanking the path
    for (let z = 0; z < trackLength + 40; z += 24) {
      for (const side of [-1, 1]) {
        const px = side * (32 + ((z * 9 + seed * 3) % 24));
        const ph = 35 + ((z * 7) % 25);
        const peak = new THREE.Group();
        peak.position.set(px, -15, z);

        const base = new THREE.Mesh(new THREE.ConeGeometry(18, ph, 6), rockMat);
        base.position.y = ph / 2;
        peak.add(base);

        const snowCap = new THREE.Mesh(new THREE.ConeGeometry(10, ph * 0.45, 6), snowMat);
        snowCap.position.y = ph * 0.78;
        peak.add(snowCap);

        group.add(peak);
      }
    }

    // Drifting low mountain fog/clouds
    for (let i = 0; i < 10; i++) {
      const cloud = this.createCloudCluster(2.6, 0.4);
      cloud.position.set(((i * 23) % 80) - 40, -6 + (i % 4) * 2, i * 22);
      group.add(cloud);
    }
  }

  // =========================================================================
  // 6. TOKYO CYBER NEON CITY
  // =========================================================================
  private static buildTokyoCity(
    scene: THREE.Scene,
    group: THREE.Group,
    trackLength: number,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    seed: number
  ) {
    hemiLight.color.setHex(0xa855f7);
    hemiLight.groundColor.setHex(0x0f172a);
    hemiLight.intensity = 1.1;

    dirLight.color.setHex(0x00f5ff);
    dirLight.position.set(20, 35, 15);
    dirLight.intensity = 1.4;

    const bldgMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.4 });
    const neonCols = [0x00f5ff, 0xff007f, 0x8b5cf6, 0x10b981];

    for (let z = 0; z < trackLength + 30; z += 18) {
      for (const side of [-1, 1]) {
        const bx = side * (26 + ((z * 5) % 15));
        const bh = 30 + ((z * 11) % 45);
        const bw = 10 + ((z * 3) % 8);

        const bldg = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bw), bldgMat);
        bldg.position.set(bx, -14 + bh / 2, z);
        group.add(bldg);

        // Glowing neon billboard on building facade
        const neonCol = neonCols[(z + (side > 0 ? 1 : 0)) % neonCols.length];
        const neonSign = new THREE.Mesh(
          new THREE.PlaneGeometry(bw * 0.75, 4.5),
          new THREE.MeshBasicMaterial({ color: neonCol, side: THREE.DoubleSide })
        );
        neonSign.position.set(bx - side * (bw / 2 + 0.1), -14 + bh * 0.7, z);
        neonSign.rotation.y = side * Math.PI / 2;
        group.add(neonSign);
      }
    }
  }

  // =========================================================================
  // 7. RED DESERT DUNES
  // =========================================================================
  private static buildRedDesert(
    scene: THREE.Scene,
    group: THREE.Group,
    trackLength: number,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    seed: number
  ) {
    hemiLight.color.setHex(0xfdba74);
    hemiLight.groundColor.setHex(0x7c2d12);
    hemiLight.intensity = 1.35;

    dirLight.color.setHex(0xfb923c);
    dirLight.position.set(30, 25, 20);
    dirLight.intensity = 1.7;

    const sandMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.95 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.9 });

    // Sand floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, trackLength + 60), sandMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -15, trackLength / 2);
    group.add(floor);

    // Weathered sandstone monoliths and desert arches
    for (let z = 10; z < trackLength; z += 24) {
      for (const side of [-1, 1]) {
        const rx = side * (26 + ((z * 7) % 20));
        const rh = 18 + ((z * 5) % 18);
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(3, 6, rh, 6), rockMat);
        spire.position.set(rx, -15 + rh / 2, z);
        group.add(spire);
      }
    }
  }

  // =========================================================================
  // 8. CRYSTAL ISLANDS
  // =========================================================================
  private static buildCrystalIslands(
    scene: THREE.Scene,
    group: THREE.Group,
    trackLength: number,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    seed: number
  ) {
    hemiLight.color.setHex(0xf472b6);
    hemiLight.groundColor.setHex(0x3b0764);
    hemiLight.intensity = 1.25;

    dirLight.color.setHex(0xc084fc);
    dirLight.position.set(20, 35, 20);
    dirLight.intensity = 1.5;

    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0xd946ef,
      emissive: 0x86198f,
      emissiveIntensity: 0.4,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.6,
      transparent: true,
      opacity: 0.85,
    });

    for (let z = 12; z < trackLength; z += 20) {
      for (const side of [-1, 1]) {
        const cx = side * (20 + (z % 14));
        const ch = 12 + ((z * 3) % 16);
        const crystal = new THREE.Mesh(new THREE.ConeGeometry(3.5, ch, 6), crystalMat);
        crystal.position.set(cx, -12 + ch / 2, z);
        crystal.rotation.z = (Math.random() - 0.5) * 0.3;
        group.add(crystal);
      }
    }
  }

  // =========================================================================
  // 9. BIOLUMINESCENT DEEP SEA
  // =========================================================================
  private static buildDeepSea(
    scene: THREE.Scene,
    group: THREE.Group,
    trackLength: number,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    seed: number
  ) {
    hemiLight.color.setHex(0x0284c7);
    hemiLight.groundColor.setHex(0x082f49);
    hemiLight.intensity = 1.1;

    dirLight.color.setHex(0x00f5ff);
    dirLight.position.set(10, 35, 20);
    dirLight.intensity = 1.35;

    const seabed = new THREE.Mesh(
      new THREE.PlaneGeometry(180, trackLength + 60),
      new THREE.MeshStandardMaterial({ color: 0x021b2b, roughness: 0.9 })
    );
    seabed.rotation.x = -Math.PI / 2;
    seabed.position.set(0, -16, trackLength / 2);
    group.add(seabed);

    const coralCols = [0xf43f5e, 0x06b6d4, 0xa855f7, 0xfacc15];
    for (let z = 5; z < trackLength; z += 14) {
      for (const side of [-1, 1]) {
        const cx = side * (8 + Math.random() * 12);
        const col = coralCols[Math.floor(Math.random() * coralCols.length)];
        const coral = new THREE.Mesh(
          new THREE.DodecahedronGeometry(2.2, 1),
          new THREE.MeshPhysicalMaterial({ color: col, emissive: col, emissiveIntensity: 0.45, roughness: 0.4 })
        );
        coral.position.set(cx, -15 + 1.8, z);
        group.add(coral);
      }
    }
  }

  // =========================================================================
  // 10. BAMBOO VALLEY (Pagodas & Highlands)
  // =========================================================================
  private static buildBambooValley(
    scene: THREE.Scene,
    group: THREE.Group,
    trackLength: number,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    seed: number
  ) {
    hemiLight.color.setHex(0xdcfce7);
    hemiLight.groundColor.setHex(0x166534);
    hemiLight.intensity = 1.3;

    dirLight.color.setHex(0xfef08a);
    dirLight.position.set(25, 40, 20);
    dirLight.intensity = 1.5;

    const grassMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const tileMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 });

    // Highlands valley floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(180, trackLength + 60), grassMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -15, trackLength / 2);
    group.add(floor);

    // Bamboo stalks & Pagoda Shrines
    for (let z = 10; z < trackLength; z += 18) {
      for (const side of [-1, 1]) {
        const bx = side * (18 + (z % 14));
        for (let b = 0; b < 4; b++) {
          const stalk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.22, 12, 6),
            new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.7 })
          );
          stalk.position.set(bx + (b % 2) * 1.5, -9, z + Math.floor(b / 2) * 1.5);
          group.add(stalk);
        }
      }

      // Pagoda tower on hillside
      if (z % 36 === 0) {
        const pagoda = new THREE.Group();
        pagoda.position.set((seed % 2 ? 26 : -26), -14, z);
        for (let tier = 0; tier < 3; tier++) {
          const body = new THREE.Mesh(new THREE.BoxGeometry(6 - tier * 1.2, 3, 6 - tier * 1.2), woodMat);
          body.position.y = tier * 3.5 + 1.5;
          pagoda.add(body);
          const roof = new THREE.Mesh(new THREE.ConeGeometry(5.5 - tier * 1.0, 1.6, 4), tileMat);
          roof.position.y = tier * 3.5 + 3.8;
          roof.rotation.y = Math.PI / 4;
          pagoda.add(roof);
        }
        group.add(pagoda);
      }
    }
  }

  // =========================================================================
  // 11. VENICE CANALS (Terracotta Canal Haven)
  // =========================================================================
  private static buildVeniceCanals(
    scene: THREE.Scene,
    group: THREE.Group,
    trackLength: number,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    seed: number
  ) {
    hemiLight.color.setHex(0xe0f2fe);
    hemiLight.groundColor.setHex(0x0284c7);
    hemiLight.intensity = 1.35;

    dirLight.color.setHex(0xffedd5);
    dirLight.position.set(25, 45, 20);
    dirLight.intensity = 1.6;

    const canal = this.createAnimatedWater(240, trackLength + 60, -14, trackLength / 2, 0x0284c7);
    group.add(canal);

    const terraMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.75 });

    for (let z = 12; z < trackLength; z += 16) {
      for (const side of [-1, 1]) {
        const vx = side * (24 + (z % 10));
        const vh = 14 + (z % 10);
        const bldg = new THREE.Mesh(new THREE.BoxGeometry(10, vh, 12), terraMat);
        bldg.position.set(vx, -14 + vh / 2, z);
        group.add(bldg);

        const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 3.5, 4), roofMat);
        roof.position.set(vx, -14 + vh + 1.7, z);
        roof.rotation.y = Math.PI / 4;
        group.add(roof);
      }
    }
  }

  // =========================================================================
  // 12. VOLCANO CALDERA (Obsidian & Magma)
  // =========================================================================
  private static buildVolcanoCaldera(
    scene: THREE.Scene,
    group: THREE.Group,
    trackLength: number,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    seed: number
  ) {
    hemiLight.color.setHex(0xf87171);
    hemiLight.groundColor.setHex(0x450a0a);
    hemiLight.intensity = 1.25;

    dirLight.color.setHex(0xf87171);
    dirLight.position.set(20, 35, 20);
    dirLight.intensity = 1.5;

    // Glowing magma bed
    const magma = new THREE.Mesh(
      new THREE.PlaneGeometry(180, trackLength + 60),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xb91c1c, emissiveIntensity: 0.6, roughness: 0.3 })
    );
    magma.rotation.x = -Math.PI / 2;
    magma.position.set(0, -15, trackLength / 2);
    group.add(magma);

    const basaltMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.95 });
    for (let z = 8; z < trackLength; z += 18) {
      for (const side of [-1, 1]) {
        const px = side * (20 + (z % 12));
        const ph = 18 + (z % 16);
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, ph, 6), basaltMat);
        pillar.position.set(px, -15 + ph / 2, z);
        group.add(pillar);
      }
    }
  }

  // =========================================================================
  // 13. AUTUMN HIGHLANDS
  // =========================================================================
  private static buildAutumnHighlands(
    scene: THREE.Scene,
    group: THREE.Group,
    trackLength: number,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    seed: number
  ) {
    hemiLight.color.setHex(0xfef3c7);
    hemiLight.groundColor.setHex(0x78350f);
    hemiLight.intensity = 1.35;

    dirLight.color.setHex(0xfbbf24);
    dirLight.position.set(25, 40, 20);
    dirLight.intensity = 1.6;

    const grassMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.9 });
    const mapleCols = [0xef4444, 0xf97316, 0xfacc15];

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(180, trackLength + 60), grassMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -15, trackLength / 2);
    group.add(floor);

    for (let z = 10; z < trackLength; z += 14) {
      for (const side of [-1, 1]) {
        const ax = side * (16 + (z % 16));
        const col = mapleCols[z % mapleCols.length];
        const tree = new THREE.Mesh(new THREE.DodecahedronGeometry(3.5, 1), new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }));
        tree.position.set(ax, -9, z);
        group.add(tree);
      }
    }
  }

  // =========================================================================
  // 14. AURORA GLACIER (Arctic Fjord)
  // =========================================================================
  private static buildAuroraGlacier(
    scene: THREE.Scene,
    group: THREE.Group,
    trackLength: number,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    seed: number
  ) {
    hemiLight.color.setHex(0x2dd4bf);
    hemiLight.groundColor.setHex(0x042f2e);
    hemiLight.intensity = 1.3;

    dirLight.color.setHex(0x5eead4);
    dirLight.position.set(20, 35, 20);
    dirLight.intensity = 1.4;

    const iceWater = this.createAnimatedWater(240, trackLength + 60, -14, trackLength / 2, 0x0f766e);
    group.add(iceWater);

    const glacierMat = new THREE.MeshPhysicalMaterial({
      color: 0x99f6e4,
      roughness: 0.15,
      metalness: 0.2,
      transmission: 0.4,
      transparent: true,
      opacity: 0.9,
    });

    for (let z = 12; z < trackLength; z += 22) {
      for (const side of [-1, 1]) {
        const gx = side * (22 + (z % 14));
        const gh = 20 + (z % 16);
        const berg = new THREE.Mesh(new THREE.ConeGeometry(10, gh, 5), glacierMat);
        berg.position.set(gx, -14 + gh / 2, z);
        group.add(berg);
      }
    }
  }

  // =========================================================================
  // SPACE PLACE 1: ORBITAL SPACE STATION (Earth from Orbit, ISS, Satellites)
  // =========================================================================
  private static createDetailedPlanetEarth(pos: THREE.Vector3, radius: number = 34): THREE.Group {
    const earthGroup = new THREE.Group();
    earthGroup.position.copy(pos);
    earthGroup.rotation.z = 0.41; // 23.5 deg axial tilt

    // Deep ocean base sphere
    const oceanGeo = new THREE.SphereGeometry(radius, 32, 24);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      roughness: 0.35,
      metalness: 0.15,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    earthGroup.add(ocean);

    // Procedural Continents (Curved landmass patches across the globe)
    const landMatGreen = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 });
    const landMatDesert = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 });
    const landPatches = [
      { lat: 0.4, lon: 0.2, r: radius * 0.44, mat: landMatGreen },
      { lat: -0.3, lon: 0.8, r: radius * 0.38, mat: landMatGreen },
      { lat: 0.8, lon: -0.5, r: radius * 0.35, mat: landMatDesert },
      { lat: -0.6, lon: -0.9, r: radius * 0.32, mat: landMatGreen },
      { lat: 0.1, lon: 1.5, r: radius * 0.45, mat: landMatGreen },
      { lat: -0.2, lon: -1.7, r: radius * 0.32, mat: landMatDesert },
      { lat: 0.5, lon: -2.1, r: radius * 0.4, mat: landMatGreen },
    ];

    landPatches.forEach((p) => {
      const landGeo = new THREE.SphereGeometry(p.r, 16, 12, 0, Math.PI * 0.75, 0, Math.PI * 0.75);
      const land = new THREE.Mesh(landGeo, p.mat);
      const x = Math.cos(p.lat) * Math.sin(p.lon) * (radius * 0.985);
      const y = Math.sin(p.lat) * (radius * 0.985);
      const z = Math.cos(p.lat) * Math.cos(p.lon) * (radius * 0.985);
      land.position.set(x, y, z);
      land.lookAt(0, 0, 0);
      earthGroup.add(land);
    });

    // Cloud Layer Sphere (rotating slightly faster than ground)
    const cloudGeo = new THREE.SphereGeometry(radius * 1.018, 28, 20);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      roughness: 0.9,
    });
    const clouds = new THREE.Mesh(cloudGeo, cloudMat);
    earthGroup.add(clouds);

    // Atmospheric Blue Rim Glow (thin blue line seen from low orbit)
    const atmoGeo = new THREE.SphereGeometry(radius * 1.06, 32, 24);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.32,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
    earthGroup.add(atmosphere);

    this.animatedEntities.push({
      update: (_dt, time) => {
        earthGroup.rotation.y = time * 0.015;
        clouds.rotation.y = time * 0.024;
      },
    });

    return earthGroup;
  }

  private static createDetailedSpaceStation(pos: THREE.Vector3): THREE.Group {
    const station = new THREE.Group();
    station.position.copy(pos);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.75, roughness: 0.25 });
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.3 });
    const solarMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.95, roughness: 0.15 });
    const goldFoilMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2 });

    // Central pressurized cylinder hull
    const mainHull = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 9.5, 16), metalMat);
    mainHull.rotation.z = Math.PI / 2;
    station.add(mainHull);

    // Docking spherical nodes
    const node1 = new THREE.Mesh(new THREE.SphereGeometry(1.9, 12, 12), metalMat);
    node1.position.set(-4.5, 0, 0);
    station.add(node1);

    const node2 = new THREE.Mesh(new THREE.SphereGeometry(1.9, 12, 12), metalMat);
    node2.position.set(4.5, 0, 0);
    station.add(node2);

    // Observatory Cupola with illuminated blue glass
    const cupola = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.2, 8), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    cupola.position.set(0, 1.6, 0);
    station.add(cupola);

    // Long Integrated Cross Truss
    const truss = new THREE.Mesh(new THREE.BoxGeometry(26, 0.6, 0.6), trussMat);
    station.add(truss);

    // 4 Solar Array Wings with golden framing
    const panelPositions = [-10, -6, 6, 10];
    panelPositions.forEach((px) => {
      const panelGroup = new THREE.Group();
      panelGroup.position.set(px, 0, 0);

      const frame = new THREE.Mesh(new THREE.BoxGeometry(3.2, 9.0, 0.12), goldFoilMat);
      panelGroup.add(frame);

      const cells = new THREE.Mesh(new THREE.BoxGeometry(2.9, 8.6, 0.16), solarMat);
      panelGroup.add(cells);

      station.add(panelGroup);
    });

    // Rotating Centrifuge Torus Ring
    const torusRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.2, 0.45, 8, 24),
      metalMat
    );
    torusRing.rotation.y = Math.PI / 2;
    station.add(torusRing);

    // Navigation beacon lights
    const redBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    redBeacon.position.set(-13.5, 0, 0);
    station.add(redBeacon);

    const greenBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    greenBeacon.position.set(13.5, 0, 0);
    station.add(greenBeacon);

    this.animatedEntities.push({
      update: (_dt, time) => {
        station.rotation.y = time * 0.04;
        station.rotation.x = Math.sin(time * 0.1) * 0.08;
        torusRing.rotation.z = time * 0.45;

        const blink = Math.sin(time * 4) > 0;
        redBeacon.visible = blink;
        greenBeacon.visible = blink;
      },
    });

    return station;
  }

  private static createSpaceSatellite(pos: THREE.Vector3): THREE.Group {
    const sat = new THREE.Group();
    sat.position.copy(pos);

    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2 });
    const solarMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.95, roughness: 0.15 });

    // Satellite body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 1.4), goldMat);
    sat.add(body);

    // Parabolic Communication Dish
    const dish = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.6, 16, 1, true), goldMat);
    dish.rotation.x = Math.PI / 2.2;
    dish.position.set(0, 0, 1.2);
    sat.add(dish);

    // Left solar panel wing
    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.4, 0.08), solarMat);
    leftWing.position.set(-3.2, 0, 0);
    sat.add(leftWing);

    // Right solar panel wing
    const rightWing = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.4, 0.08), solarMat);
    rightWing.position.set(3.2, 0, 0);
    sat.add(rightWing);

    this.animatedEntities.push({
      update: (_dt, time) => {
        sat.rotation.y = time * 0.08;
        sat.rotation.z = Math.sin(time * 0.2) * 0.1;
        sat.position.y = pos.y + Math.sin(time * 0.5) * 0.6;
      },
    });

    return sat;
  }

  private static buildOrbitalSpaceStation(
    scene: THREE.Scene,
    group: THREE.Group,
    trackLength: number,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    _seed: number
  ) {
    hemiLight.color.setHex(0x38bdf8); // Sky: Blue Earth ambient bounce
    hemiLight.groundColor.setHex(0x020617);
    hemiLight.intensity = 0.8;

    dirLight.color.setHex(0xffffff); // Direct harsh space sunlight
    dirLight.position.set(45, 65, 30);
    dirLight.intensity = 2.0;

    // 1. Giant Planet Earth visible below the orbital path
    const earth = this.createDetailedPlanetEarth(
      new THREE.Vector3(-45, -18, trackLength * 0.65),
      36
    );
    group.add(earth);

    // 2. Distant cratered rocky Moon
    const moonGroup = new THREE.Group();
    moonGroup.position.set(72, 48, trackLength * 0.85);
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(7.5, 20, 20),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.92, metalness: 0.1 })
    );
    moonGroup.add(moon);
    group.add(moonGroup);

    // 3. International Space Station floating majestically
    const station = this.createDetailedSpaceStation(
      new THREE.Vector3(26, 18, trackLength * 0.45)
    );
    group.add(station);

    // 4. Communication Satellite in low orbit
    const sat = this.createSpaceSatellite(
      new THREE.Vector3(-20, 22, trackLength * 0.22)
    );
    group.add(sat);

    // 5. Brilliant distant cosmic sun with solar corona
    const cosmicSun = this.createVolumetricSun(
      new THREE.Vector3(85, 80, trackLength * 0.8),
      0xffffff,
      12
    );
    group.add(cosmicSun);
  }

  // =========================================================================
  // SPACE PLACE 2: DEEP SPACE NEBULA (Saturn Rings, Asteroids, Cosmic Nebula)
  // =========================================================================
  private static createSaturnPlanet(pos: THREE.Vector3, radius: number = 24): THREE.Group {
    const planetGroup = new THREE.Group();
    planetGroup.position.copy(pos);
    planetGroup.rotation.x = Math.PI / 3.4;
    planetGroup.rotation.z = 0.22;

    // Banded gas giant sphere
    const planetMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.6,
      metalness: 0.1,
    });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), planetMat);
    planetGroup.add(planet);

    // Atmospheric latitude bands
    const bandColors = [0xd97706, 0xfde68a, 0xa855f7, 0xfbbf24];
    for (let b = 0; b < 4; b++) {
      const bandRing = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 1.002, radius * 1.002, 1.8, 32, 1, true),
        new THREE.MeshBasicMaterial({ color: bandColors[b], transparent: true, opacity: 0.45, side: THREE.DoubleSide })
      );
      bandRing.position.y = -6 + b * 4;
      planetGroup.add(bandRing);
    }

    // Inner Amber Planetary Ring
    const innerRingGeo = new THREE.RingGeometry(radius * 1.35, radius * 1.9, 48);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = Math.PI / 2;
    planetGroup.add(innerRing);

    // Outer Glowing Violet Planetary Ring (beyond Cassini Division)
    const outerRingGeo = new THREE.RingGeometry(radius * 2.05, radius * 2.65, 48);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.rotation.x = Math.PI / 2;
    planetGroup.add(outerRing);

    this.animatedEntities.push({
      update: (_dt, time) => {
        planet.rotation.y = time * 0.03;
      },
    });

    return planetGroup;
  }

  private static createAsteroidField(trackLength: number, count: number = 28): THREE.Group {
    const field = new THREE.Group();
    const asteroidMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.9,
      metalness: 0.25,
      flatShading: true,
    });

    for (let i = 0; i < count; i++) {
      const size = 1.2 + Math.random() * 2.8;
      const geo = new THREE.DodecahedronGeometry(size, 1);

      const posAttr = geo.attributes.position;
      for (let j = 0; j < posAttr.count; j++) {
        const vx = posAttr.getX(j);
        const vy = posAttr.getY(j);
        const vz = posAttr.getZ(j);
        const noise = 1 + (Math.random() - 0.5) * 0.35;
        posAttr.setXYZ(j, vx * noise, vy * noise, vz * noise);
      }
      geo.computeVertexNormals();

      const asteroid = new THREE.Mesh(geo, asteroidMat);
      const side = i % 2 === 0 ? 1 : -1;
      const x = side * (16 + Math.random() * 32);
      const y = -8 + Math.random() * 36;
      const z = (i / count) * (trackLength + 40) - 20;
      asteroid.position.set(x, y, z);

      const rotSpeed = {
        x: (Math.random() - 0.5) * 0.6,
        y: (Math.random() - 0.5) * 0.8,
        z: (Math.random() - 0.5) * 0.5,
      };

      this.animatedEntities.push({
        update: (dt, _time) => {
          asteroid.rotation.x += rotSpeed.x * dt;
          asteroid.rotation.y += rotSpeed.y * dt;
          asteroid.rotation.z += rotSpeed.z * dt;
        },
      });

      field.add(asteroid);
    }

    return field;
  }

  private static createGlowingNebulaClouds(centerPos: THREE.Vector3, colorHex: number, count: number = 6): THREE.Group {
    const nebula = new THREE.Group();
    nebula.position.copy(centerPos);

    for (let i = 0; i < count; i++) {
      const size = 32 + Math.random() * 45;
      const cloudGeo = new THREE.PlaneGeometry(size, size);
      const cloudMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const plane = new THREE.Mesh(cloudGeo, cloudMat);
      plane.position.set(
        (Math.random() - 0.5) * 45,
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 60
      );
      plane.rotation.z = Math.random() * Math.PI;

      const baseOpacity = 0.16 + Math.random() * 0.12;
      const pulseSpeed = 0.4 + Math.random() * 0.6;
      this.animatedEntities.push({
        update: (_dt, time) => {
          cloudMat.opacity = baseOpacity + Math.sin(time * pulseSpeed) * 0.06;
        },
      });

      nebula.add(plane);
    }

    return nebula;
  }

  private static buildDeepSpaceNebula(
    scene: THREE.Scene,
    group: THREE.Group,
    trackLength: number,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    _seed: number
  ) {
    hemiLight.color.setHex(0xc084fc); // Violet cosmic nebula ambience
    hemiLight.groundColor.setHex(0x030014);
    hemiLight.intensity = 0.85;

    dirLight.color.setHex(0xfef08a); // Distant warm star
    dirLight.position.set(-45, 60, -20);
    dirLight.intensity = 1.8;

    // 1. Majestic Saturn with multi-layered rings
    const saturn = this.createSaturnPlanet(
      new THREE.Vector3(46, 26, trackLength * 0.7),
      24
    );
    group.add(saturn);

    // 2. Tumbling 3D Asteroid Belt along the sides of the aerial track
    const asteroids = this.createAsteroidField(trackLength, 32);
    group.add(asteroids);

    // 3. Billowing glowing nebula gas clouds (magenta & cyan)
    const nebulaMagenta = this.createGlowingNebulaClouds(
      new THREE.Vector3(-38, 28, trackLength * 0.45),
      0xd946ef,
      6
    );
    group.add(nebulaMagenta);

    const nebulaCyan = this.createGlowingNebulaClouds(
      new THREE.Vector3(35, 35, trackLength * 0.85),
      0x06b6d4,
      5
    );
    group.add(nebulaCyan);

    // 4. Distant alien cosmic beacon with pulsing energy rune
    const beaconGroup = new THREE.Group();
    beaconGroup.position.set(-25, 20, trackLength * 0.8);
    const beacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(3.5, 0),
      new THREE.MeshStandardMaterial({ color: 0x00f5ff, emissive: 0x00f5ff, emissiveIntensity: 0.6, roughness: 0.2 })
    );
    beaconGroup.add(beacon);

    this.animatedEntities.push({
      update: (_dt, time) => {
        beacon.rotation.y = time * 0.6;
        beacon.rotation.x = time * 0.4;
      },
    });
    group.add(beaconGroup);
  }

  // =========================================================================
  // SPACE PLACE 3: ANDROMEDA GALAXY (Galactic Core & Twin Exoplanets)
  // =========================================================================
  private static buildAndromedaGalaxy(
    scene: THREE.Scene,
    group: THREE.Group,
    trackLength: number,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    _seed: number
  ) {
    hemiLight.color.setHex(0xb5179e);
    hemiLight.groundColor.setHex(0x020617);
    hemiLight.intensity = 0.95;

    dirLight.color.setHex(0xc77dff);
    dirLight.position.set(15, 35, 20);
    dirLight.intensity = 1.5;

    // 1. Giant ringed planet (Emerald Gas Giant)
    const planetGroup = new THREE.Group();
    planetGroup.position.set(40, 24, trackLength * 0.7);

    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(16, 28, 28),
      new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.4, metalness: 0.2 })
    );
    planetGroup.add(planet);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(20, 32, 40),
      new THREE.MeshBasicMaterial({ color: 0xa7f3d0, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
    );
    ring.rotation.x = Math.PI / 2.5;
    planetGroup.add(ring);
    group.add(planetGroup);

    // 2. Distant Molten Crimson Exoplanet
    const moltenPlanet = new THREE.Mesh(
      new THREE.SphereGeometry(10, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.4, roughness: 0.8 })
    );
    moltenPlanet.position.set(-38, 20, trackLength * 0.55);
    group.add(moltenPlanet);

    // 3. Glowing Galactic Spiral Core Disc
    const galaxyCore = new THREE.Mesh(
      new THREE.RingGeometry(4, 28, 36),
      new THREE.MeshBasicMaterial({
        color: 0xd946ef,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
      })
    );
    galaxyCore.position.set(0, 45, trackLength * 0.9);
    galaxyCore.rotation.x = Math.PI / 3;
    group.add(galaxyCore);

    this.animatedEntities.push({
      update: (_dt, time) => {
        planet.rotation.y = time * 0.03;
        moltenPlanet.rotation.y = time * 0.02;
        galaxyCore.rotation.z = time * 0.08;
      },
    });
  }
}
