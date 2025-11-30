import { Line, Vector3 } from 'three';
import { type BlackHoleData } from '../scene/SpacetimeWorld';
export declare class LaserPointer {
    readonly line: Line;
    private geometry;
    private positions;
    private workingDir;
    private workingPos;
    private workingForce;
    private temp;
    private active;
    constructor(color?: number);
    update(origin: Vector3, direction: Vector3, blackHoles: BlackHoleData[]): void;
    private applyGravitationalBend;
    setActive(active: boolean): void;
}
