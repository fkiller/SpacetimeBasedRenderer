import { Group } from 'three';
export declare class LaserPointer {
    readonly line: Group;
    private shaft;
    private tip;
    private active;
    constructor(color?: number, length?: number);
    update(): void;
    setActive(active: boolean): void;
}
