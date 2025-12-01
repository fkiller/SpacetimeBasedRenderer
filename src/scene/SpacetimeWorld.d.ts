import { Group, Mesh, Vector3 } from 'three';
import { type BlackHoleUniforms } from '../blackhole/LensedSkyMaterial';
export interface BlackHoleData {
    id: string;
    mass: number;
    group: Group;
    position: Vector3;
    horizon: Mesh;
    disk: Mesh;
    radius: number;
}
export declare class SpacetimeWorld {
    readonly root: Group;
    readonly sky: Mesh;
    readonly uniforms: BlackHoleUniforms;
    private blackHoles;
    private idCounter;
    private selectedId;
    private worldPosScratch;
    private timeUniform;
    constructor();
    addBlackHole(position?: Vector3, mass?: number): string;
    removeBlackHole(id: string): void;
    updateBlackHoleMass(id: string, delta: number): void;
    setSelected(id: string | null): void;
    getSelected(): BlackHoleData | null;
    getAll(): BlackHoleData[];
    update(elapsed: number, cameraPosition: Vector3): void;
    interactableObjects(): Mesh[];
    private refreshUniforms;
    private computeHorizonRadius;
    private createBlackHoleMesh;
    private createHorizonMaterial;
    private createAccretionDiskMaterial;
    private updateSelectionEmissive;
    private updateUniformWorldPositions;
}
