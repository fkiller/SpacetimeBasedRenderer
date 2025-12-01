import {
  AmbientLight,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  ShaderMaterial,
  Object3D,
  RingGeometry,
  SphereGeometry,
  AdditiveBlending,
  Vector3,
} from 'three';
import { createLensedSkyMaterial, MAX_BLACK_HOLES, type BlackHoleUniforms } from '../blackhole/LensedSkyMaterial';

export interface BlackHoleData {
  id: string;
  mass: number;
  group: Group;
  position: Vector3;
  horizon: Mesh;
  disk: Mesh;
  radius: number;
}

export class SpacetimeWorld {
  readonly root: Group;
  readonly sky: Mesh;
  readonly uniforms: BlackHoleUniforms;

  private blackHoles: Map<string, BlackHoleData> = new Map();
  private idCounter = 0;
  private selectedId: string | null = null;
  private worldPosScratch = new Vector3();
  private timeUniform = { value: 0 };

  constructor() {
    this.root = new Group();
    this.root.name = 'SpacetimeWorld';

    const skyMaterial = createLensedSkyMaterial();
    this.uniforms = skyMaterial.uniforms as BlackHoleUniforms;

    this.sky = new Mesh(new SphereGeometry(500, 64, 64), skyMaterial);
    this.sky.name = 'SkyDome';
    this.sky.frustumCulled = false;
    this.root.add(this.sky);

    const ambient = new AmbientLight(new Color(0x1a2a45), 0.8);
    this.root.add(ambient);

    const directional = new DirectionalLight(new Color(0xffffff), 0.35);
    directional.position.set(5, 3, 2);
    this.root.add(directional);
  }

  addBlackHole(position = new Vector3(0, 0, -4), mass = 1.2): string {
    if (this.blackHoles.size >= MAX_BLACK_HOLES) {
      console.warn('Reached maximum black hole count for shader budget');
      return Array.from(this.blackHoles.keys())[this.blackHoles.size - 1];
    }

    const id = `bh-${++this.idCounter}`;
    const { group, horizon, disk, radius } = this.createBlackHoleMesh(id, mass);
    group.position.copy(position);
    group.name = `BlackHole-${id}`;

    const data: BlackHoleData = {
      id,
      mass,
      group,
      position: group.position,
      horizon,
      disk,
      radius,
    };

    this.blackHoles.set(id, data);
    this.root.add(group);
    this.refreshUniforms();
    this.setSelected(id);
    return id;
  }

  removeBlackHole(id: string): void {
    const data = this.blackHoles.get(id);
    if (!data) return;
    this.root.remove(data.group);
    data.group.traverse((obj: Object3D) => obj.removeFromParent());
    this.blackHoles.delete(id);
    this.refreshUniforms();
    if (this.selectedId === id) {
      this.selectedId = this.blackHoles.size ? Array.from(this.blackHoles.keys())[0] : null;
      this.updateSelectionEmissive();
    }
  }

  updateBlackHoleMass(id: string, delta: number): void {
    const data = this.blackHoles.get(id);
    if (!data) return;
    data.mass = Math.max(0.2, Math.min(8, data.mass + delta));
    const radius = this.computeHorizonRadius(data.mass);
    data.radius = radius;
    data.horizon.scale.setScalar(radius / data.horizon.userData.baseRadius);
    data.disk.scale.setScalar(radius / data.disk.userData.baseRadius);
    this.refreshUniforms();
  }

  setSelected(id: string | null): void {
    if (id && !this.blackHoles.has(id)) return;
    this.selectedId = id;
    this.updateSelectionEmissive();
  }

  getSelected(): BlackHoleData | null {
    if (!this.selectedId) return null;
    return this.blackHoles.get(this.selectedId) ?? null;
  }

  getAll(): BlackHoleData[] {
    return Array.from(this.blackHoles.values());
  }

  update(elapsed: number, cameraPosition: Vector3): void {
    this.timeUniform.value = elapsed;
    this.uniforms.uTime.value = elapsed;
    this.sky.position.copy(cameraPosition);
    this.updateUniformWorldPositions();
  }

  interactableObjects(): Mesh[] {
    return Array.from(this.blackHoles.values()).map((bh) => bh.horizon);
  }

  private refreshUniforms(): void {
    const entries = Array.from(this.blackHoles.values());
    this.uniforms.uBlackHoleCount.value = entries.length;
    for (let i = 0; i < MAX_BLACK_HOLES; i += 1) {
      const bh = entries[i];
      if (bh) {
        this.uniforms.uBlackHoleMasses.value[i] = bh.mass;
      } else {
        this.uniforms.uBlackHoleMasses.value[i] = 0;
      }
    }
    this.updateUniformWorldPositions();
  }

  private computeHorizonRadius(mass: number): number {
    return 0.35 + 0.25 * Math.sqrt(Math.max(0.2, mass));
  }

  private createBlackHoleMesh(id: string, mass: number) {
    const radius = this.computeHorizonRadius(mass);
    const geometry = new SphereGeometry(radius, 64, 48);
    const horizonMaterial = this.createHorizonMaterial();
    const horizon = new Mesh(geometry, horizonMaterial);
    horizon.userData.blackHoleId = id;
    horizon.userData.baseRadius = radius;
    horizon.castShadow = false;
    horizon.receiveShadow = false;

    const diskGeometry = new RingGeometry(radius * 1.6, radius * 3.2, 72, 1);
    diskGeometry.rotateX(Math.PI / 2);
    const diskMaterial = this.createAccretionDiskMaterial();
    const disk = new Mesh(diskGeometry, diskMaterial);
    disk.userData.blackHoleId = id;
    disk.userData.baseRadius = radius;

    const group = new Group();
    group.add(horizon);
    group.add(disk);

    return { group, horizon, disk, radius };
  }

  private createHorizonMaterial(): ShaderMaterial {
    return new ShaderMaterial({
      uniforms: {
        uTime: this.timeUniform,
        uInnerColor: { value: new Color(0x0a0f1a) },
        uFresnelColor: { value: new Color(0x2d4a8f) },
        uPhotonColor: { value: new Color(0xffc48f) },
        uHighlight: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;

        uniform float uTime;
        uniform vec3 uInnerColor;
        uniform vec3 uFresnelColor;
        uniform vec3 uPhotonColor;
        uniform float uHighlight;

        varying vec3 vNormal;
        varying vec3 vViewDir;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec3 n = normalize(vNormal);
          vec3 viewDir = normalize(vViewDir);
          float viewDot = clamp(dot(n, viewDir), -1.0, 1.0);
          float fresnel = pow(1.0 - abs(viewDot), 2.2);

          float swirl = sin(uTime * 0.8 + atan(n.z, n.x) * 7.0 + n.y * 10.0);
          float ripple = 0.35 + 0.65 * hash(n.xz + vec2(uTime * 0.15, uTime * 0.09));
          float gravDarken = 0.25 + 0.75 * exp(-abs(viewDot) * 1.8);

          float photonRing = exp(-pow(viewDot, 2.0) * 22.0) * (0.6 + 0.4 * ripple);
          float turbulence = 0.35 + 0.65 * (0.5 + 0.5 * swirl);

          vec3 base = uInnerColor * gravDarken * turbulence;
          vec3 ring = uPhotonColor * (photonRing * (1.2 + uHighlight * 0.6));
          vec3 glow = uFresnelColor * (fresnel * (0.9 + uHighlight * 0.6) * ripple);

          vec3 color = base + ring + glow;
          float alpha = clamp(0.7 + fresnel * 0.25 + photonRing * 0.25, 0.0, 1.0);
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
  }

  private createAccretionDiskMaterial(): ShaderMaterial {
    return new ShaderMaterial({
      uniforms: {
        uTime: this.timeUniform,
        uInnerColor: { value: new Color(0xffe6c7) },
        uOuterColor: { value: new Color(0x5b3f2d) },
        uHotColor: { value: new Color(0xff944d) },
        uHighlight: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;

        uniform float uTime;
        uniform vec3 uInnerColor;
        uniform vec3 uOuterColor;
        uniform vec3 uHotColor;
        uniform float uHighlight;

        varying vec2 vUv;

        mat2 rot(float a) {
          float s = sin(a);
          float c = cos(a);
          return mat2(c, -s, s, c);
        }

        void main() {
          vec2 uv = vUv - 0.5;
          uv = rot(uTime * 0.25) * uv;
          uv += 0.5;

          float radius = clamp(uv.y, 0.0, 1.0);
          float bandMask = smoothstep(0.08, 0.2, radius) * (1.0 - smoothstep(0.9, 1.0, radius));

          float swirl = sin(uv.x * 18.0 + uTime * 2.2) * 0.5 + sin(radius * 90.0 - uTime * 1.7) * 0.5;
          float heat = pow(1.0 - radius, 3.0);
          float doppler = 0.7 + 0.3 * sin((uv.x - 0.5) * 6.283 + uTime * 1.5);

          vec3 base = mix(uOuterColor, uInnerColor, 1.0 - radius);
          vec3 color = base + uHotColor * (heat * 1.2 + swirl * 0.25);
          color *= (0.85 + doppler * 0.4);

          float alpha = clamp(bandMask * (0.6 + uHighlight * 0.3), 0.0, 1.0);
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
  }

  private updateSelectionEmissive() {
    const entries = Array.from(this.blackHoles.values());
    for (const bh of entries) {
      const selected = bh.id === this.selectedId;
      const horizonMat = bh.horizon.material as ShaderMaterial;
      const diskMat = bh.disk.material as ShaderMaterial;
      horizonMat.uniforms.uHighlight.value = selected ? 1 : 0;
      diskMat.uniforms.uHighlight.value = selected ? 1 : 0;
    }
  }

  private updateUniformWorldPositions() {
    const entries = Array.from(this.blackHoles.values());
    for (let i = 0; i < MAX_BLACK_HOLES; i += 1) {
      const bh = entries[i];
      const target = this.uniforms.uBlackHolePositions.value[i];
      if (bh) {
        bh.group.getWorldPosition(this.worldPosScratch);
        target.copy(this.worldPosScratch);
      } else {
        target.set(0, 0, 0);
      }
    }
  }
}
