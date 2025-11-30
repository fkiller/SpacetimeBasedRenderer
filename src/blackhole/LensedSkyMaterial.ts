import {
  BackSide,
  ShaderMaterial,
  type ShaderMaterialParameters,
  type IUniform,
  Vector3,
} from 'three';

export const MAX_BLACK_HOLES = 4;

export type BlackHoleUniforms = {
  uTime: IUniform<number>;
  uBlackHoleCount: IUniform<number>;
  uBlackHolePositions: IUniform<Vector3[]>;
  uBlackHoleMasses: IUniform<number[]>;
} & Record<string, IUniform>;

export function createLensedSkyMaterial(): ShaderMaterial {
  const uniforms: BlackHoleUniforms = {
    uTime: { value: 0 },
    uBlackHoleCount: { value: 0 },
    uBlackHolePositions: { value: Array.from({ length: MAX_BLACK_HOLES }, () => new Vector3()) },
    uBlackHoleMasses: { value: new Array(MAX_BLACK_HOLES).fill(0) },
  };

  const params: ShaderMaterialParameters = {
    name: 'LensedSkyMaterial',
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(worldPos.xyz - cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      #define MAX_BLACK_HOLES ${MAX_BLACK_HOLES}

      uniform float uTime;
      uniform int uBlackHoleCount;
      uniform vec3 uBlackHolePositions[MAX_BLACK_HOLES];
      uniform float uBlackHoleMasses[MAX_BLACK_HOLES];
      varying vec3 vWorldDir;

      float hash(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      }

      float stars(vec3 dir) {
        vec3 p = normalize(dir) * 450.0;
        float d1 = hash(floor(p * 1.7));
        float d2 = hash(floor(p * 2.3 + 12.3));
        float density = smoothstep(0.995, 1.0, max(d1, d2));
        float flicker = 0.65 + 0.35 * sin(uTime * 0.9 + d1 * 18.0);
        return density * flicker;
      }

      vec3 lensDirection(vec3 dir) {
        vec3 lensed = dir;
        for (int i = 0; i < MAX_BLACK_HOLES; i++) {
          if (i >= uBlackHoleCount) { break; }
          vec3 toBH = uBlackHolePositions[i] - cameraPosition;
          float b = length(cross(toBH, lensed)) + 0.0001;
          float mass = uBlackHoleMasses[i];
          float alpha = clamp(mass * 0.22 / b, -0.6, 0.6);
          vec3 bendDir = normalize(cross(cross(lensed, toBH), lensed));
          lensed = normalize(lensed + bendDir * alpha);
        }
        return lensed;
      }

      vec3 starColor(float v) {
        vec3 cold = vec3(0.35, 0.55, 1.0);
        vec3 warm = vec3(1.0, 0.85, 0.7);
        float tint = hash(vec3(v, v * 1.7, v * 2.9));
        return mix(cold, warm, tint) * (0.4 + 0.6 * v);
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        vec3 lensedDir = lensDirection(dir);
        float starStrength = stars(lensedDir);
        vec3 base = mix(vec3(0.01, 0.02, 0.05), vec3(0.06, 0.08, 0.12), 0.2 + 0.2 * sin(uTime * 0.05));
        vec3 color = base + starColor(starStrength) * starStrength;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    transparent: false,
  };

  return new ShaderMaterial(params);
}
