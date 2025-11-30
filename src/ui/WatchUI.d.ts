import { Mesh, Vector2 } from 'three';
export type WatchAction = 'massInc' | 'massDec' | 'add' | 'remove' | 'next' | 'prev';
interface WatchData {
    count: number;
    selectedLabel: string;
    mass: number;
}
export declare class WatchUI {
    readonly mesh: Mesh;
    private canvas;
    private ctx;
    private texture;
    private data;
    private dirty;
    private hovered;
    private readonly buttons;
    constructor();
    setData(data: Partial<WatchData>): void;
    setHover(action: WatchAction | null): void;
    handleIntersection(uv: Vector2, triggerClick: boolean): WatchAction | null;
    renderIfNeeded(): void;
    private drawButton;
    private rectToPx;
    private findButtonAtUV;
}
export {};
