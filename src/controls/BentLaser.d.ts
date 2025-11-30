import { BufferGeometry, Line, LineBasicMaterial, Vector3 } from 'three';
export interface FieldSource {
    position: Vector3;
    mass: number;
    radius: number;
}
export declare class BentLaser {
    readonly line: Line<BufferGeometry, LineBasicMaterial>;
    private readonly positions;
    private readonly geometry;
    private readonly material;
    private readonly maxSegments;
    private readonly maxLength;
    private readonly step;
    private readonly gravityStrength;
    private readonly bendStrength;
    private readonly maxTurnPerStep;
    private readonly softening;
    private readonly softeningSq;
    private active;
    private tmpPos;
    private tmpDir;
    private tmpAccel;
    private tmpDiff;
    private tmpPerp;
    constructor(color?: number, maxLength?: number, segments?: number);
    setActive(active: boolean): void;
    updatePath(origin: Vector3, direction: Vector3, sources: FieldSource[]): void;
    private computeAcceleration;
    private intersectsSource;
}
