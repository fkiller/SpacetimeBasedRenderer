import { AmbientLight, Color, DirectionalLight, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, RingGeometry, SphereGeometry, Vector3, } from 'three';
import { createLensedSkyMaterial, MAX_BLACK_HOLES } from '../blackhole/LensedSkyMaterial';
export class SpacetimeWorld {
    root;
    sky;
    uniforms;
    blackHoles = new Map();
    idCounter = 0;
    selectedId = null;
    worldPosScratch = new Vector3();
    constructor() {
        this.root = new Group();
        this.root.name = 'SpacetimeWorld';
        const skyMaterial = createLensedSkyMaterial();
        this.uniforms = skyMaterial.uniforms;
        this.sky = new Mesh(new SphereGeometry(500, 64, 64), skyMaterial);
        this.sky.name = 'SkyDome';
        this.sky.frustumCulled = false;
        this.root.add(this.sky);
        const ambient = new AmbientLight(new Color(0x1a2a45), 0.8);
        this.root.add(ambient);
        const directional = new DirectionalLight(new Color(0xffffff), 0.35);
        directional.position.set(5, 3, 2);
        this.root.add(directional);
    }
    addBlackHole(position = new Vector3(0, 0, -4), mass = 1.2) {
        if (this.blackHoles.size >= MAX_BLACK_HOLES) {
            console.warn('Reached maximum black hole count for shader budget');
            return Array.from(this.blackHoles.keys())[this.blackHoles.size - 1];
        }
        const id = `bh-${++this.idCounter}`;
        const { group, horizon, disk, radius } = this.createBlackHoleMesh(id, mass);
        group.position.copy(position);
        group.name = `BlackHole-${id}`;
        const data = {
            id,
            mass,
            group,
            position: group.position,
            horizon,
            disk,
            radius,
        };
        this.blackHoles.set(id, data);
        this.root.add(group);
        this.refreshUniforms();
        this.setSelected(id);
        return id;
    }
    removeBlackHole(id) {
        const data = this.blackHoles.get(id);
        if (!data)
            return;
        this.root.remove(data.group);
        data.group.traverse((obj) => obj.removeFromParent());
        this.blackHoles.delete(id);
        this.refreshUniforms();
        if (this.selectedId === id) {
            this.selectedId = this.blackHoles.size ? Array.from(this.blackHoles.keys())[0] : null;
            this.updateSelectionEmissive();
        }
    }
    updateBlackHoleMass(id, delta) {
        const data = this.blackHoles.get(id);
        if (!data)
            return;
        data.mass = Math.max(0.2, Math.min(8, data.mass + delta));
        const radius = this.computeHorizonRadius(data.mass);
        data.radius = radius;
        data.horizon.scale.setScalar(radius / data.horizon.userData.baseRadius);
        data.disk.scale.setScalar(radius / data.disk.userData.baseRadius);
        this.refreshUniforms();
    }
    setSelected(id) {
        if (id && !this.blackHoles.has(id))
            return;
        this.selectedId = id;
        this.updateSelectionEmissive();
    }
    getSelected() {
        if (!this.selectedId)
            return null;
        return this.blackHoles.get(this.selectedId) ?? null;
    }
    getAll() {
        return Array.from(this.blackHoles.values());
    }
    update(elapsed, cameraPosition) {
        this.uniforms.uTime.value = elapsed;
        this.sky.position.copy(cameraPosition);
        this.updateUniformWorldPositions();
    }
    interactableObjects() {
        return Array.from(this.blackHoles.values()).map((bh) => bh.horizon);
    }
    refreshUniforms() {
        const entries = Array.from(this.blackHoles.values());
        this.uniforms.uBlackHoleCount.value = entries.length;
        for (let i = 0; i < MAX_BLACK_HOLES; i += 1) {
            const bh = entries[i];
            if (bh) {
                this.uniforms.uBlackHoleMasses.value[i] = bh.mass;
            }
            else {
                this.uniforms.uBlackHoleMasses.value[i] = 0;
            }
        }
        this.updateUniformWorldPositions();
    }
    computeHorizonRadius(mass) {
        return 0.35 + 0.25 * Math.sqrt(Math.max(0.2, mass));
    }
    createBlackHoleMesh(id, mass) {
        const radius = this.computeHorizonRadius(mass);
        const geometry = new SphereGeometry(radius, 64, 48);
        const material = new MeshStandardMaterial({
            color: new Color(0x050505),
            emissive: new Color(0x0c1122),
            metalness: 0.7,
            roughness: 0.25,
        });
        const horizon = new Mesh(geometry, material);
        horizon.userData.blackHoleId = id;
        horizon.userData.baseRadius = radius;
        horizon.castShadow = false;
        horizon.receiveShadow = false;
        const diskGeometry = new RingGeometry(radius * 1.6, radius * 3.2, 72, 1);
        diskGeometry.rotateX(Math.PI / 2);
        const diskMaterial = new MeshBasicMaterial({
            color: new Color(0xffc184),
            transparent: true,
            opacity: 0.65,
            side: DoubleSide,
            depthWrite: false,
        });
        const disk = new Mesh(diskGeometry, diskMaterial);
        disk.userData.blackHoleId = id;
        disk.userData.baseRadius = radius;
        const group = new Group();
        group.add(horizon);
        group.add(disk);
        return { group, horizon, disk, radius };
    }
    updateSelectionEmissive() {
        const entries = Array.from(this.blackHoles.values());
        for (const bh of entries) {
            const selected = bh.id === this.selectedId;
            const mat = bh.horizon.material;
            mat.emissive = new Color(selected ? 0x22335f : 0x0c1122);
        }
    }
    updateUniformWorldPositions() {
        const entries = Array.from(this.blackHoles.values());
        for (let i = 0; i < MAX_BLACK_HOLES; i += 1) {
            const bh = entries[i];
            const target = this.uniforms.uBlackHolePositions.value[i];
            if (bh) {
                bh.group.getWorldPosition(this.worldPosScratch);
                target.copy(this.worldPosScratch);
            }
            else {
                target.set(0, 0, 0);
            }
        }
    }
}
//# sourceMappingURL=SpacetimeWorld.js.map