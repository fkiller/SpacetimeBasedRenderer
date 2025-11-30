import {
  Clock,
  Color,
  Group,
  Intersection,
  Matrix4,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { SpacetimeWorld } from '../scene/SpacetimeWorld';
import { LaserPointer } from '../controls/LaserPointer';
import { WatchAction, WatchUI } from '../ui/WatchUI';

interface ControllerState {
  index: number;
  controller: Group;
  grip: Group;
  laser: LaserPointer;
  handedness: 'left' | 'right' | 'none';
  selecting: boolean;
  squeezing: boolean;
  hover: Intersection | null;
}

interface TwoHandTransform {
  active: boolean;
  initialDistance: number;
  initialVector: Vector3;
  initialMidpoint: Vector3;
  initialWorldPosition: Vector3;
  initialRotation: Quaternion;
  initialScale: number;
}

export class SpacetimeApp {
  private readonly container: HTMLElement;
  private readonly hud: HTMLElement;
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: PerspectiveCamera;
  private controls: OrbitControls;
  private world: SpacetimeWorld;
  private watchUI: WatchUI;
  private controllers: ControllerState[] = [];
  private interactables: Object3D[] = [];
  private raycaster = new Raycaster();
  private tmpMatrix = new Matrix4();
  private tmpDir = new Vector3();
  private tmpCameraPos = new Vector3();
  private clock = new Clock();
  private twoHand: TwoHandTransform = {
    active: false,
    initialDistance: 1,
    initialVector: new Vector3(),
    initialMidpoint: new Vector3(),
    initialWorldPosition: new Vector3(),
    initialRotation: new Quaternion(),
    initialScale: 1,
  };

  constructor(container: HTMLElement, hud: HTMLElement) {
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

    window.addEventListener('resize', () => this.onResize());
    this.onResize();
  }

  start() {
    this.container.appendChild(this.renderer.domElement);
    document.body.appendChild(VRButton.createButton(this.renderer));
    this.renderer.setAnimationLoop(() => this.render());
    this.updateHud('Ready. Enter VR to begin.');
  }

  private setupInitialScene() {
    this.camera.position.set(0, 1.6, 3);
    this.scene.add(this.camera);

    const firstId = this.world.addBlackHole(new Vector3(0, 1.4, -4), 1.2);
    this.world.addBlackHole(new Vector3(1.2, 1.3, -6), 0.8);
    this.world.setSelected(firstId);
    this.refreshInteractables();
    this.syncWatchUI();
  }

  private setupControllers() {
    const controllerFactory = new XRControllerModelFactory();

    for (let i = 0; i < 2; i += 1) {
      const controller = this.renderer.xr.getController(i);
      const grip = this.renderer.xr.getControllerGrip(i);
      const laser = new LaserPointer(i === 0 ? 0xffa86f : 0x7ab7ff);
      controller.add(laser.line);

      const model = controllerFactory.createControllerModel(grip);
      grip.add(model);

      const state: ControllerState = {
        index: i,
        controller,
        grip,
        laser,
        handedness: 'none',
        selecting: false,
        squeezing: false,
        hover: null,
      };

      controller.addEventListener('connected', (event: any) => {
        state.handedness = event.data.handedness || 'none';
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

  private attachWatchToGrip(grip: Group) {
    if (grip.children.includes(this.watchUI.mesh)) return;
    this.watchUI.mesh.position.set(0, 0.07, 0);
    this.watchUI.mesh.rotation.set(-Math.PI / 2, Math.PI, 0);
    grip.add(this.watchUI.mesh);
  }

  private onSelectStart(state: ControllerState) {
    state.selecting = true;
    state.laser.setActive(true);
    this.handleSelection(state);
  }

  private onSelectEnd(state: ControllerState) {
    state.selecting = false;
    state.laser.setActive(false);
  }

  private onSqueezeStart(state: ControllerState) {
    state.squeezing = true;
    this.tryBeginTwoHand();
  }

  private onSqueezeEnd(state: ControllerState) {
    state.squeezing = false;
    if (!this.isBothSqueezing()) {
      this.twoHand.active = false;
    }
  }

  private tryBeginTwoHand() {
    if (this.twoHand.active) return;
    const left = this.getHand('left');
    const right = this.getHand('right');
    if (!left?.squeezing || !right?.squeezing) return;

    const leftPos = new Vector3().setFromMatrixPosition(left.controller.matrixWorld);
    const rightPos = new Vector3().setFromMatrixPosition(right.controller.matrixWorld);
    this.twoHand.initialDistance = leftPos.distanceTo(rightPos);
    if (this.twoHand.initialDistance < 0.05) return;

    this.twoHand.active = true;
    this.twoHand.initialVector.copy(rightPos).sub(leftPos).normalize();
    this.twoHand.initialMidpoint.copy(leftPos).add(rightPos).multiplyScalar(0.5);
    this.twoHand.initialWorldPosition.copy(this.world.root.position);
    this.twoHand.initialRotation.copy(this.world.root.quaternion);
    this.twoHand.initialScale = this.world.root.scale.x;
  }

  private updateTwoHandTransform() {
    if (!this.twoHand.active) return;
    const left = this.getHand('left');
    const right = this.getHand('right');
    if (!left || !right) return;

    const leftPos = new Vector3().setFromMatrixPosition(left.controller.matrixWorld);
    const rightPos = new Vector3().setFromMatrixPosition(right.controller.matrixWorld);
    const dist = leftPos.distanceTo(rightPos);
    if (dist < 0.0001 || !Number.isFinite(dist)) return;

    const newVector = new Vector3().subVectors(rightPos, leftPos).normalize();
    const scale = dist / this.twoHand.initialDistance;
    const rotationDelta = new Quaternion().setFromUnitVectors(this.twoHand.initialVector, newVector);
    this.world.root.quaternion.copy(rotationDelta.multiply(this.twoHand.initialRotation));
    this.world.root.scale.setScalar(this.twoHand.initialScale * scale);

    const newMid = new Vector3().addVectors(leftPos, rightPos).multiplyScalar(0.5);
    const offset = new Vector3().subVectors(newMid, this.twoHand.initialMidpoint);
    this.world.root.position.copy(this.twoHand.initialWorldPosition.clone().add(offset));
  }

  private isBothSqueezing() {
    return this.controllers.some((c) => c.handedness === 'left' && c.squeezing) &&
      this.controllers.some((c) => c.handedness === 'right' && c.squeezing);
  }

  private handleSelection(state: ControllerState) {
    const intersection = this.findFirstIntersection(state.controller);
    if (!intersection) return;
    if (intersection.object === this.watchUI.mesh && intersection.uv) {
      const action = this.watchUI.handleIntersection(intersection.uv, true);
      this.handleWatchAction(action);
      this.watchUI.renderIfNeeded();
      return;
    }

    const targetId = (intersection.object as any).userData?.blackHoleId as string | undefined;
    if (targetId) {
      this.world.setSelected(targetId);
      this.syncWatchUI();
      return;
    }
  }

  private handleWatchAction(action: WatchAction | null) {
    if (!action) return;
    const selected = this.world.getSelected();
    switch (action) {
      case 'massInc':
        if (selected) this.world.updateBlackHoleMass(selected.id, 0.1);
        break;
      case 'massDec':
        if (selected) this.world.updateBlackHoleMass(selected.id, -0.1);
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
        if (!list.length) break;
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

  private findFirstIntersection(controller: Group): Intersection | null {
    this.tmpMatrix.identity().extractRotation(controller.matrixWorld);
    this.tmpDir.set(0, 0, -1).applyMatrix4(this.tmpMatrix).normalize();

    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.copy(this.tmpDir);

    const objects = [this.watchUI.mesh, ...this.interactables];
    const hits = this.raycaster.intersectObjects(objects, false);
    return hits[0] ?? null;
  }

  private updateControllerHover(state: ControllerState) {
    if (state.handedness !== 'right') return;
    const hit = this.findFirstIntersection(state.controller);
    state.hover = hit;
    if (hit?.object === this.watchUI.mesh && hit.uv) {
      this.watchUI.handleIntersection(hit.uv, false);
      this.watchUI.renderIfNeeded();
    } else {
      this.watchUI.setHover(null);
    }
  }

  private updateLaser(state: ControllerState) {
    this.tmpMatrix.identity().extractRotation(state.controller.matrixWorld);
    this.tmpDir.set(0, 0, -1).applyMatrix4(this.tmpMatrix).normalize();
    const origin = new Vector3().setFromMatrixPosition(state.controller.matrixWorld);
    state.laser.update(origin, this.tmpDir, this.world.getAll());
  }

  private render() {
    this.clock.getDelta();
    const elapsed = this.clock.elapsedTime;

    this.controls.enabled = !this.renderer.xr.isPresenting;
    this.controls.update();

    this.world.update(elapsed, this.getViewerPosition());
    this.watchUI.renderIfNeeded();

    this.controllers.forEach((state) => {
      this.updateLaser(state);
      this.updateControllerHover(state);
      if (state.selecting) {
        this.handleSelection(state);
      }
    });

    this.updateTwoHandTransform();
    this.renderer.render(this.scene, this.camera);
    this.updateHudText();
  }

  private syncWatchUI() {
    const selected = this.world.getSelected();
    this.watchUI.setData({
      count: this.world.getAll().length,
      selectedLabel: selected ? selected.id : 'none',
      mass: selected ? selected.mass : 0,
    });
    this.watchUI.renderIfNeeded();
  }

  private refreshInteractables() {
    this.interactables = this.world.interactableObjects();
  }

  private updateHud(text: string) {
    this.hud.textContent = text;
  }

  private updateHudText() {
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

  private onResize() {
    const { innerWidth, innerHeight } = window;
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  private getViewerPosition(): Vector3 {
    if (this.renderer.xr.isPresenting) {
      const xrCamera = this.renderer.xr.getCamera();
      xrCamera.getWorldPosition(this.tmpCameraPos);
      return this.tmpCameraPos;
    }
    return this.camera.position;
  }

  private getHand(hand: 'left' | 'right'): ControllerState | undefined {
    return this.controllers.find((c) => c.handedness === hand);
  }
}
