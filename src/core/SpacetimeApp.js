import { Clock, Color, AxesHelper, Matrix4, PerspectiveCamera, Quaternion, Raycaster, Scene, Vector3, WebGLRenderer, } from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { SpacetimeWorld } from '../scene/SpacetimeWorld';
import { LaserPointer } from '../controls/LaserPointer';
import { BentLaser } from '../controls/BentLaser';
import { WatchUI } from '../ui/WatchUI';
export class SpacetimeApp {
    container;
    hud;
    renderer;
    scene;
    camera;
    controls;
    world;
    watchUI;
    controllers = [];
    interactables = [];
    fieldSources = [];
    bhWorldPositions = [];
    raycaster = new Raycaster();
    tmpMatrix = new Matrix4();
    tmpDir = new Vector3();
    tmpOrigin = new Vector3();
    tmpCameraPos = new Vector3();
    tmpPos = new Vector3();
    clock = new Clock();
    debugPanel = null;
    messagePanel = null;
    twoHand = {
        active: false,
        initialDistance: 1,
        initialVector: new Vector3(),
        initialMidpoint: new Vector3(),
        initialWorldPosition: new Vector3(),
        initialRotation: new Quaternion(),
        initialScale: 1,
    };
    constructor(container, hud) {
        this.container = container;
        this.hud = hud;
        this.renderer = new WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(new Color(0x000000));
        this.renderer.xr.enabled = true;
        this.scene = new Scene();
        this.camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.target.set(0, 1.5, -2.5);
        this.controls.update();
        this.world = new SpacetimeWorld();
        this.scene.add(this.world.root);
        this.watchUI = new WatchUI();
        this.setupControllers();
        this.setupInitialScene();
        this.createDebugPanel();
        this.createMessagePanel();
        window.addEventListener('resize', () => this.onResize());
        this.onResize();
    }
    start() {
        this.container.appendChild(this.renderer.domElement);
        document.body.appendChild(VRButton.createButton(this.renderer));
        this.renderer.setAnimationLoop(() => this.render());
        this.updateHud('Ready. Enter VR to begin.');
    }
    setupInitialScene() {
        this.camera.position.set(0, 1.6, 3);
        this.scene.add(this.camera);
        const firstId = this.world.addBlackHole(new Vector3(0, 1.4, -4), 1.2);
        this.world.addBlackHole(new Vector3(1.2, 1.3, -6), 0.8);
        this.world.setSelected(firstId);
        this.refreshInteractables();
        this.syncWatchUI();
    }
    setupControllers() {
        const controllerFactory = new XRControllerModelFactory();
        for (let i = 0; i < 2; i += 1) {
            const controller = this.renderer.xr.getController(i);
            const grip = this.renderer.xr.getControllerGrip(i);
            const laser = new LaserPointer(i === 0 ? 0xffa86f : 0x7ab7ff);
            const bentLaser = new BentLaser(i === 0 ? 0xffc890 : 0xaad0ff, 12, 140);
            laser.setActive(false);
            bentLaser.setActive(false);
            controller.add(laser.line);
            this.scene.add(bentLaser.line);
            const model = controllerFactory.createControllerModel(grip);
            grip.add(model);
            const axes = new AxesHelper(0.08);
            axes.material.depthTest = false;
            axes.renderOrder = 30;
            controller.add(axes);
            const state = {
                index: i,
                controller,
                grip,
                laser,
                bentLaser,
                handedness: 'none',
                selecting: false,
                squeezing: false,
                hover: null,
                gamepad: null,
                axes,
            };
            controller.addEventListener('connected', (event) => {
                state.handedness = event.data.handedness || 'none';
                state.gamepad = event.data.gamepad ?? null;
                if (state.handedness === 'left') {
                    this.attachWatchToGrip(grip);
                }
            });
            controller.addEventListener('disconnected', () => {
                state.handedness = 'none';
                state.hover = null;
            });
            controller.addEventListener('selectstart', () => this.onSelectStart(state));
            controller.addEventListener('selectend', () => this.onSelectEnd(state));
            controller.addEventListener('squeezestart', () => this.onSqueezeStart(state));
            controller.addEventListener('squeezeend', () => this.onSqueezeEnd(state));
            this.scene.add(controller);
            this.scene.add(grip);
            this.controllers.push(state);
        }
    }
    attachWatchToGrip(grip) {
        if (grip.children.includes(this.watchUI.mesh))
            return;
        this.watchUI.mesh.position.set(0, 0.07, 0);
        this.watchUI.mesh.rotation.set(-Math.PI / 2, Math.PI, 0);
        grip.add(this.watchUI.mesh);
    }
    onSelectStart(state) {
        state.selecting = true;
    }
    onSelectEnd(state) {
        state.selecting = false;
    }
    onSqueezeStart(state) {
        state.squeezing = true;
        this.tryBeginTwoHand();
    }
    onSqueezeEnd(state) {
        state.squeezing = false;
        if (!this.isBothSqueezing()) {
            this.twoHand.active = false;
        }
    }
    tryBeginTwoHand() {
        if (this.twoHand.active)
            return;
        const left = this.getHand('left');
        const right = this.getHand('right');
        if (!left?.squeezing || !right?.squeezing)
            return;
        const leftPos = new Vector3().setFromMatrixPosition(left.controller.matrixWorld);
        const rightPos = new Vector3().setFromMatrixPosition(right.controller.matrixWorld);
        this.twoHand.initialDistance = leftPos.distanceTo(rightPos);
        if (this.twoHand.initialDistance < 0.05)
            return;
        this.twoHand.active = true;
        this.twoHand.initialVector.copy(rightPos).sub(leftPos).normalize();
        this.twoHand.initialMidpoint.copy(leftPos).add(rightPos).multiplyScalar(0.5);
        this.twoHand.initialWorldPosition.copy(this.world.root.position);
        this.twoHand.initialRotation.copy(this.world.root.quaternion);
        this.twoHand.initialScale = this.world.root.scale.x;
    }
    updateTwoHandTransform() {
        if (!this.twoHand.active)
            return;
        const left = this.getHand('left');
        const right = this.getHand('right');
        if (!left || !right)
            return;
        const leftPos = new Vector3().setFromMatrixPosition(left.controller.matrixWorld);
        const rightPos = new Vector3().setFromMatrixPosition(right.controller.matrixWorld);
        const dist = leftPos.distanceTo(rightPos);
        if (dist < 0.0001 || !Number.isFinite(dist))
            return;
        const newVector = new Vector3().subVectors(rightPos, leftPos).normalize();
        const scale = dist / this.twoHand.initialDistance;
        const rotationDelta = new Quaternion().setFromUnitVectors(this.twoHand.initialVector, newVector);
        this.world.root.quaternion.copy(rotationDelta.multiply(this.twoHand.initialRotation));
        this.world.root.scale.setScalar(this.twoHand.initialScale * scale);
        const newMid = new Vector3().addVectors(leftPos, rightPos).multiplyScalar(0.5);
        const offset = new Vector3().subVectors(newMid, this.twoHand.initialMidpoint);
        this.world.root.position.copy(this.twoHand.initialWorldPosition.clone().add(offset));
    }
    isBothSqueezing() {
        return this.controllers.some((c) => c.handedness === 'left' && c.squeezing) &&
            this.controllers.some((c) => c.handedness === 'right' && c.squeezing);
    }
    handleSelection(state) {
        const intersection = this.findFirstIntersection(state.controller);
        if (!intersection)
            return;
        if (intersection.object === this.watchUI.mesh && intersection.uv) {
            const action = this.watchUI.handleIntersection(intersection.uv, true);
            this.handleWatchAction(action);
            this.watchUI.renderIfNeeded();
            return;
        }
        const targetId = intersection.object.userData?.blackHoleId;
        if (targetId) {
            this.world.setSelected(targetId);
            this.syncWatchUI();
            return;
        }
    }
    handleWatchAction(action) {
        if (!action)
            return;
        const selected = this.world.getSelected();
        switch (action) {
            case 'massInc':
                if (selected)
                    this.world.updateBlackHoleMass(selected.id, 0.1);
                break;
            case 'massDec':
                if (selected)
                    this.world.updateBlackHoleMass(selected.id, -0.1);
                break;
            case 'add': {
                const pos = new Vector3(0, 1.4, -4 - this.world.getAll().length * 1.5);
                const id = this.world.addBlackHole(pos, 0.9 + Math.random() * 0.6);
                this.refreshInteractables();
                this.world.setSelected(id);
                break;
            }
            case 'remove':
                if (selected) {
                    this.world.removeBlackHole(selected.id);
                    this.refreshInteractables();
                }
                break;
            case 'next':
            case 'prev': {
                const list = this.world.getAll();
                if (!list.length)
                    break;
                const currentIndex = selected ? list.findIndex((b) => b.id === selected.id) : 0;
                const step = action === 'next' ? 1 : -1;
                const nextIndex = (currentIndex + step + list.length) % list.length;
                this.world.setSelected(list[nextIndex].id);
                break;
            }
            default:
                break;
        }
        this.syncWatchUI();
    }
    findFirstIntersection(controller) {
        this.tmpMatrix.identity().extractRotation(controller.matrixWorld);
        this.tmpDir.set(0, 0, -1).applyMatrix4(this.tmpMatrix).normalize();
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.copy(this.tmpDir);
        const objects = [this.watchUI.mesh, ...this.interactables];
        const hits = this.raycaster.intersectObjects(objects, false);
        return hits[0] ?? null;
    }
    updateControllerHover(state) {
        if (state.handedness !== 'right')
            return;
        const hit = this.findFirstIntersection(state.controller);
        state.hover = hit;
        if (hit?.object === this.watchUI.mesh && hit.uv) {
            this.watchUI.handleIntersection(hit.uv, false);
            this.watchUI.renderIfNeeded();
        }
        else {
            this.watchUI.setHover(null);
        }
    }
    updateLaser(state, active, fieldSources) {
        state.laser.setActive(active);
        state.bentLaser.setActive(active);
        if (active) {
            this.tmpMatrix.identity().extractRotation(state.controller.matrixWorld);
            this.tmpDir.set(0, 0, -1).applyMatrix4(this.tmpMatrix).normalize();
            this.tmpOrigin.setFromMatrixPosition(state.controller.matrixWorld);
            state.bentLaser.updatePath(this.tmpOrigin, this.tmpDir, fieldSources);
        }
        state.laser.update(); // follows controller via parenting
    }
    render() {
        this.clock.getDelta();
        const elapsed = this.clock.elapsedTime;
        this.controls.enabled = !this.renderer.xr.isPresenting;
        this.controls.update();
        this.world.update(elapsed, this.getViewerPosition());
        this.watchUI.renderIfNeeded();
        const fieldSources = this.collectFieldSources();
        this.controllers.forEach((state) => {
            const triggerPressed = this.isTriggerPressed(state);
            state.selecting = triggerPressed;
            if (triggerPressed) {
                this.handleSelection(state);
            }
            this.updateLaser(state, triggerPressed, fieldSources);
            this.updateControllerHover(state);
        });
        this.updateTwoHandTransform();
        this.renderer.render(this.scene, this.camera);
        this.updateHudText();
        this.updateDebugPanel();
    }
    syncWatchUI() {
        const selected = this.world.getSelected();
        this.watchUI.setData({
            count: this.world.getAll().length,
            selectedLabel: selected ? selected.id : 'none',
            mass: selected ? selected.mass : 0,
        });
        this.watchUI.renderIfNeeded();
    }
    refreshInteractables() {
        this.interactables = this.world.interactableObjects();
    }
    collectFieldSources() {
        const blackHoles = this.world.getAll();
        const worldScale = this.world.root.scale.x;
        this.fieldSources.length = 0;
        this.bhWorldPositions.length = blackHoles.length;
        for (let i = 0; i < blackHoles.length; i += 1) {
            const bh = blackHoles[i];
            const pos = this.bhWorldPositions[i] ?? new Vector3();
            bh.group.getWorldPosition(pos);
            this.bhWorldPositions[i] = pos;
            this.fieldSources.push({
                position: pos,
                mass: bh.mass,
                radius: bh.radius * worldScale,
            });
        }
        return this.fieldSources;
    }
    updateHud(text) {
        this.hud.textContent = text;
    }
    isTriggerPressed(state) {
        const gp = state.gamepad ?? state.controller.gamepad ?? state.controller.userData?.gamepad;
        const pressed = gp?.buttons?.[0]?.pressed;
        if (typeof pressed === 'boolean')
            return pressed;
        return state.selecting;
    }
    updateHudText() {
        const bh = this.world.getSelected();
        const lines = [
            'Right hand: trigger to select, laser bends near masses.',
            'Left hand: watch UI to add/remove and tweak masses.',
            'Both grips: pinch to scale/rotate the scene.',
        ];
        if (bh) {
            lines.push(`Selected ${bh.id} mass ${bh.mass.toFixed(2)} M`);
        }
        this.updateHud(lines.join(' \u2022 '));
    }
    onResize() {
        const { innerWidth, innerHeight } = window;
        this.camera.aspect = innerWidth / innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(innerWidth, innerHeight);
    }
    getViewerPosition() {
        if (this.renderer.xr.isPresenting) {
            const xrCamera = this.renderer.xr.getCamera();
            xrCamera.getWorldPosition(this.tmpCameraPos);
            return this.tmpCameraPos;
        }
        return this.camera.position;
    }
    getHand(hand) {
        return this.controllers.find((c) => c.handedness === hand);
    }
    createMessagePanel() {
        const el = document.createElement('div');
        el.id = 'viewport-message';
        el.textContent = 'Spacetime Renderer: Debug overlay active';
        el.style.position = 'fixed';
        el.style.top = '12px';
        el.style.left = '50%';
        el.style.transform = 'translateX(-50%)';
        el.style.padding = '10px 14px';
        el.style.borderRadius = '10px';
        el.style.background = 'rgba(20, 26, 40, 0.82)';
        el.style.color = '#f1f6ff';
        el.style.fontFamily = 'Inter, "Segoe UI", system-ui, sans-serif';
        el.style.fontSize = '14px';
        el.style.fontWeight = '600';
        el.style.letterSpacing = '0.2px';
        el.style.boxShadow = '0 8px 22px rgba(0,0,0,0.35)';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '9998';
        document.body.appendChild(el);
        this.messagePanel = el;
    }
    createDebugPanel() {
        const el = document.createElement('div');
        el.id = 'controller-debug';
        el.style.position = 'fixed';
        el.style.bottom = '12px';
        el.style.left = '12px';
        el.style.padding = '10px 12px';
        el.style.borderRadius = '8px';
        el.style.background = 'rgba(10, 12, 18, 0.78)';
        el.style.color = '#e9f2ff';
        el.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
        el.style.fontSize = '12px';
        el.style.lineHeight = '1.5';
        el.style.pointerEvents = 'none';
        el.style.whiteSpace = 'pre';
        el.style.zIndex = '9999';
        document.body.appendChild(el);
        this.debugPanel = el;
    }
    updateDebugPanel() {
        if (!this.debugPanel)
            return;
        const lines = [];
        for (const state of this.controllers) {
            const hand = state.handedness ?? 'none';
            state.controller.getWorldPosition(this.tmpPos);
            const gp = state.gamepad ?? state.controller.gamepad ?? state.controller.userData?.gamepad;
            const b0 = gp?.buttons?.[0];
            const b1 = gp?.buttons?.[1];
            const b2 = gp?.buttons?.[2];
            const b3 = gp?.buttons?.[3];
            lines.push(`${hand.toUpperCase()} pos: ${this.tmpPos.x.toFixed(2)} ${this.tmpPos.y.toFixed(2)} ${this.tmpPos.z.toFixed(2)}`);
            lines.push(` b0(trigger):${b0?.pressed ? '1' : '0'}(${(b0?.value ?? 0).toFixed(2)})` +
                ` b1(grip):${b1?.pressed ? '1' : '0'}(${(b1?.value ?? 0).toFixed(2)})` +
                ` b2:${b2?.pressed ? '1' : '0'}(${(b2?.value ?? 0).toFixed(2)})` +
                ` b3:${b3?.pressed ? '1' : '0'}(${(b3?.value ?? 0).toFixed(2)})`);
            lines.push(` laser visible: ${state.laser.line.visible}, bent: ${state.bentLaser.line.visible}`);
            lines.push('');
        }
        this.debugPanel.textContent = lines.join('\n');
    }
}
//# sourceMappingURL=SpacetimeApp.js.map
