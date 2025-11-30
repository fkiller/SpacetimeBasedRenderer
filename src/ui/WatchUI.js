import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, } from 'three';
const WATCH_WIDTH = 0.16;
const WATCH_HEIGHT = 0.11;
export class WatchUI {
    mesh;
    canvas;
    ctx;
    texture;
    data = { count: 0, selectedLabel: '-', mass: 1 };
    dirty = true;
    hovered = null;
    buttons = [
        { id: 'massDec', label: '- mass', rect: { x: 0.04, y: 0.42, w: 0.2, h: 0.18 } },
        { id: 'massInc', label: '+ mass', rect: { x: 0.28, y: 0.42, w: 0.2, h: 0.18 } },
        { id: 'add', label: 'Add', rect: { x: 0.52, y: 0.42, w: 0.18, h: 0.18 } },
        { id: 'remove', label: 'Remove', rect: { x: 0.72, y: 0.42, w: 0.22, h: 0.18 } },
        { id: 'prev', label: '<', rect: { x: 0.20, y: 0.70, w: 0.18, h: 0.18 } },
        { id: 'next', label: '>', rect: { x: 0.62, y: 0.70, w: 0.18, h: 0.18 } },
    ];
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 640;
        this.canvas.height = 440;
        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to create watch canvas context');
        }
        this.ctx = ctx;
        this.texture = new CanvasTexture(this.canvas);
        this.texture.colorSpace = SRGBColorSpace;
        const material = new MeshBasicMaterial({ map: this.texture, transparent: true, opacity: 0.92 });
        const geometry = new PlaneGeometry(WATCH_WIDTH, WATCH_HEIGHT);
        this.mesh = new Mesh(geometry, material);
        this.mesh.name = 'WatchUI';
        this.mesh.renderOrder = 10;
    }
    setData(data) {
        this.data = { ...this.data, ...data };
        this.dirty = true;
    }
    setHover(action) {
        if (this.hovered === action)
            return;
        this.hovered = action;
        this.dirty = true;
    }
    handleIntersection(uv, triggerClick) {
        const action = this.findButtonAtUV(uv);
        this.setHover(action);
        if (triggerClick && action) {
            return action;
        }
        return null;
    }
    renderIfNeeded() {
        if (!this.dirty)
            return;
        this.dirty = false;
        const { ctx } = this;
        ctx.save();
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = 'rgba(10, 18, 32, 0.85)';
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 4;
        roundRect(ctx, 10, 10, this.canvas.width - 20, this.canvas.height - 20, 20);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#cde2ff';
        ctx.font = '28px "Inter", "Segoe UI", sans-serif';
        ctx.fillText('Spacetime', 30, 48);
        ctx.font = '22px "Inter", "Segoe UI", sans-serif';
        ctx.fillStyle = '#8eb6ff';
        ctx.fillText('Black hole deck', 30, 80);
        ctx.fillStyle = '#cde2ff';
        ctx.font = '20px "Inter", "Segoe UI", sans-serif';
        ctx.fillText(`Selected: ${this.data.selectedLabel}`, 30, 125);
        ctx.fillText(`Mass: ${this.data.mass.toFixed(2)} M`, 30, 160);
        ctx.fillText(`Count: ${this.data.count}`, 30, 195);
        this.buttons.forEach((button) => this.drawButton(button));
        this.texture.needsUpdate = true;
        ctx.restore();
    }
    drawButton(button) {
        const { ctx } = this;
        const [x, y, w, h] = this.rectToPx(button.rect);
        const hovered = this.hovered === button.id;
        ctx.fillStyle = hovered ? 'rgba(102, 174, 255, 0.28)' : 'rgba(255, 255, 255, 0.08)';
        ctx.strokeStyle = hovered ? 'rgba(120, 190, 255, 0.8)' : 'rgba(255,255,255,0.25)';
        ctx.lineWidth = hovered ? 4 : 3;
        roundRect(ctx, x, y, w, h, 14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = hovered ? '#e9f2ff' : '#d8e6ff';
        ctx.font = '20px "Inter", "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(button.label, x + w / 2, y + h / 2 + 1);
    }
    rectToPx(rect) {
        return [
            rect.x * this.canvas.width,
            rect.y * this.canvas.height,
            rect.w * this.canvas.width,
            rect.h * this.canvas.height,
        ];
    }
    findButtonAtUV(uv) {
        for (const button of this.buttons) {
            const { x, y, w, h } = button.rect;
            if (uv.x >= x && uv.x <= x + w && uv.y >= y && uv.y <= y + h) {
                return button.id;
            }
        }
        return null;
    }
}
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}
//# sourceMappingURL=WatchUI.js.map