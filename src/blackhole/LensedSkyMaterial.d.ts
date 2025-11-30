import { ShaderMaterial, type IUniform, Vector3 } from 'three';
export declare const MAX_BLACK_HOLES = 4;
export type BlackHoleUniforms = {
    uTime: IUniform<number>;
    uBlackHoleCount: IUniform<number>;
    uBlackHolePositions: IUniform<Vector3[]>;
    uBlackHoleMasses: IUniform<number[]>;
} & Record<string, IUniform>;
export declare function createLensedSkyMaterial(): ShaderMaterial;
