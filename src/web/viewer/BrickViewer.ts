import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Brick } from '../../engine/packer';
import { getColor } from '../../engine/palette';
import { STUD_MM } from '../../engine/parts';
import { brickBox } from './geometry';

export interface ViewerOptions {
  autoRotate?: boolean;
  /** Kamera yatay açısı (radyan); 0 = tam önden */
  azimuth?: number;
}

export interface ShowOptions {
  /** Bu adıma kadar (dahil) olan parçaları göster */
  upToStep?: number;
  /** Bu adımın parçalarını vurgula */
  highlightStep?: number;
}

const GAP = 0.15; // parçalar arası görsel boşluk (mm)
const STUD_R = 2.4;
const STUD_H = 1.7;

export class BrickViewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private group = new THREE.Group();
  private resizeObs: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private geoCache = new Map<string, THREE.BufferGeometry>();
  private edgeCache = new Map<string, THREE.EdgesGeometry>();
  private matCache = new Map<string, THREE.Material>();
  private studGeo = new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 20);
  private edgeMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 });
  private highlightEdgeMat = new THREE.LineBasicMaterial({ color: 0xff5a36 });
  private fitted = false;

  constructor(
    private container: HTMLElement,
    private opts: ViewerOptions = {},
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(32, 1, 1, 5000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 120;
    this.controls.maxDistance = 1200;
    this.controls.autoRotate = !!opts.autoRotate;
    this.controls.autoRotateSpeed = 1.6;
    this.controls.addEventListener('start', () => (this.controls.autoRotate = false));

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f9c, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(150, 260, 320);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.8);
    fill.position.set(-260, 120, -80);
    this.scene.add(fill);
    this.scene.add(this.group);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    this.loop();
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  resize(): void {
    const w = this.container.clientWidth || 300;
    const h = this.container.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private material(colorId: string, highlight = false): THREE.Material {
    const key = `${colorId}|${highlight}`;
    let m = this.matCache.get(key);
    if (!m) {
      const c = getColor(colorId);
      m = new THREE.MeshStandardMaterial({
        color: new THREE.Color(c.hex),
        roughness: c.transparent ? 0.05 : 0.32,
        metalness: 0,
        transparent: !!c.transparent,
        opacity: c.transparent ? 0.4 : 1,
        emissive: highlight ? new THREE.Color(0xff5a36) : new THREE.Color(0x000000),
        emissiveIntensity: highlight ? 0.18 : 0,
      });
      this.matCache.set(key, m);
    }
    return m;
  }

  private boxGeo(sx: number, sz: number, h: number): [THREE.BufferGeometry, THREE.EdgesGeometry] {
    const key = `${sx}x${sz}x${h}`;
    let g = this.geoCache.get(key);
    let e = this.edgeCache.get(key);
    if (!g || !e) {
      g = new THREE.BoxGeometry(sx * STUD_MM - GAP * 2, h - GAP, sz * STUD_MM - GAP * 2);
      e = new THREE.EdgesGeometry(g);
      this.geoCache.set(key, g);
      this.edgeCache.set(key, e);
    }
    return [g, e];
  }

  setModel(bricks: Brick[], show: ShowOptions = {}): void {
    // Eski sahneyi temizle. Kutu/stud geometrileri ve malzemeler önbellekte kalır;
    // çağrı başına üretilen birleşik kenar geometrileri burada serbest bırakılır.
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      if (child instanceof THREE.InstancedMesh) child.dispose();
      else if (child instanceof THREE.LineSegments) child.geometry.dispose();
    }
    const visible = bricks.filter((b) => show.upToStep === undefined || b.step <= show.upToStep);
    if (!bricks.length) return;

    const hasBase = bricks.some((b) => b.plate);

    let maxX = 0;
    let maxZ = 0;
    let totalH = 0;
    for (const b of bricks) {
      maxX = Math.max(maxX, b.x + b.sx);
      maxZ = Math.max(maxZ, b.z + b.sz);
      const box = brickBox(b, hasBase);
      totalH = Math.max(totalH, box.bottomMm + box.heightMm);
    }
    const cx = (maxX * STUD_MM) / 2;
    const cz = (maxZ * STUD_MM) / 2;

    // Hangi hücrelerin üstü kapalı (stud görünmez): opak parçaların kapladığı tüm katlar
    const occupied = new Set<string>();
    for (const b of visible) {
      if (getColor(b.color).transparent) continue;
      const top = b.y + (b.h ?? 1);
      for (let l = b.y; l < top; l++)
        for (let z = b.z; z < b.z + b.sz; z++) for (let x = b.x; x < b.x + b.sx; x++) occupied.add(`${x},${l},${z}`);
    }

    // (sx, sz, yükseklik, renk, vurgu) başına tek InstancedMesh
    const bodies = new Map<string, { sx: number; sz: number; h: number; color: string; hl: boolean; m: THREE.Matrix4[] }>();
    const studsByMat = new Map<THREE.Material, THREE.Matrix4[]>();
    const edgeParts: [number[], number[]] = [[], []]; // [normal, vurgulu]
    const v = new THREE.Vector3();

    for (const b of visible) {
      const { bottomMm, heightMm: h } = brickBox(b, hasBase);
      const hl = show.highlightStep !== undefined && b.step === show.highlightStep;
      const px = (b.x + b.sx / 2) * STUD_MM - cx;
      const pz = (b.z + b.sz / 2) * STUD_MM - cz;
      const py = bottomMm + h / 2;

      const key = `${b.sx}|${b.sz}|${h}|${b.color}|${hl}`;
      let body = bodies.get(key);
      if (!body) bodies.set(key, (body = { sx: b.sx, sz: b.sz, h, color: b.color, hl, m: [] }));
      body.m.push(new THREE.Matrix4().makeTranslation(px, py, pz));

      // Kenarlar: önbellekteki kutu kenarları öteleme ile tek diziye eklenir
      const pos = this.boxGeo(b.sx, b.sz, h)[1].getAttribute('position');
      const out = edgeParts[hl ? 1 : 0];
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        out.push(v.x + px, v.y + py, v.z + pz);
      }

      const topLayer = b.y + (b.h ?? 1);
      const studY = bottomMm + h + STUD_H / 2 - GAP;
      const mat = this.material(b.color, hl);
      for (let z = b.z; z < b.z + b.sz; z++)
        for (let x = b.x; x < b.x + b.sx; x++) {
          if (occupied.has(`${x},${topLayer},${z}`)) continue;
          const list = studsByMat.get(mat) ?? [];
          list.push(new THREE.Matrix4().makeTranslation((x + 0.5) * STUD_MM - cx, studY, (z + 0.5) * STUD_MM - cz));
          studsByMat.set(mat, list);
        }
    }

    for (const body of bodies.values()) {
      const inst = new THREE.InstancedMesh(this.boxGeo(body.sx, body.sz, body.h)[0], this.material(body.color, body.hl), body.m.length);
      body.m.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.instanceMatrix.needsUpdate = true;
      this.group.add(inst);
    }
    for (const [mat, list] of studsByMat) {
      const inst = new THREE.InstancedMesh(this.studGeo, mat, list.length);
      list.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.instanceMatrix.needsUpdate = true;
      this.group.add(inst);
    }
    edgeParts.forEach((arr, i) => {
      if (!arr.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      this.group.add(new THREE.LineSegments(g, i ? this.highlightEdgeMat : this.edgeMat));
    });

    if (!this.fitted) {
      this.fitted = true;
      const target = new THREE.Vector3(0, totalH / 2, 0);
      const fov = (this.camera.fov * Math.PI) / 180;
      const dist = (totalH / 2 / Math.tan(fov / 2)) * 1.35;
      const az = this.opts.azimuth ?? 0.5;
      this.camera.position.set(Math.sin(az) * dist, totalH * 0.62, Math.cos(az) * dist);
      this.controls.target.copy(target);
      this.controls.update();
    }
  }

  /** Önizleme görüntüsü (PNG data URL) */
  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObs.disconnect();
    this.controls.dispose();
    for (const g of this.geoCache.values()) g.dispose();
    for (const e of this.edgeCache.values()) e.dispose();
    for (const m of this.matCache.values()) m.dispose();
    this.studGeo.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
