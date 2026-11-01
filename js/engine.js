// Mesin 3D: renderer, kamera, kontrol, pencahayaan waktu, efek LED, mode jalan, drag signage
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeSky } from './environment.js';

const TIME = {
  day:   { cloud: '#ffffff', cloudAmt: 0.62, sunAmt: 1, stars: 0, top: '#5f9fd8', bottom: '#e6eef5', glow: '#ffffff', glowAmt: 0.05, hemiSky: '#e4f0ff', hemiGround: '#8b877c', hemi: 0.6, sun: '#fff4e2', sunI: 3.3, sunPos: [28, 48, 30], exp: 0.95, bloom: 0.35, thr: 1.6, env: 0.45, windows: 0, lamps: 0, fog: '#dfe7ee' },
  dusk:  { cloud: '#f1b39a', cloudAmt: 0.55, sunAmt: 0.9, stars: 0.15, top: '#1f2d55', bottom: '#f09a68', glow: '#ff9a5a', glowAmt: 0.35, hemiSky: '#9fb0dc', hemiGround: '#4a3a30', hemi: 0.42, sun: '#ff9c5a', sunI: 1.1, sunPos: [-45, 10, 26], exp: 0.95, bloom: 0.6, thr: 1.0, env: 0.28, windows: 0.55, lamps: 0.7, fog: '#a98a86' },
  night: { cloud: '#1c2438', cloudAmt: 0.35, sunAmt: 0, stars: 0.9, top: '#03050b', bottom: '#111a2d', glow: '#2a3f6a', glowAmt: 0.25, hemiSky: '#2f3d60', hemiGround: '#0a0a0d', hemi: 0.22, sun: '#9fb4ff', sunI: 0.2, sunPos: [20, 40, -15], exp: 1.0, bloom: 0.55, thr: 0.95, env: 0.1, windows: 1, lamps: 1.4, fog: '#0d1320' },
};

export class Engine {
  constructor(container, hooks = {}) {
    this.container = container;
    this.hooks = hooks;
    this.clock = new THREE.Clock();
    this.items = new Map(); // id -> { root, sign, support, dims, fx }
    this.selectedId = null;
    this.showSelection = false;
    this.ctx = { windowMats: [], lampMats: [], lampLights: [] };
    this.timeKey = 'dusk';
    this.mode = 'orbit';

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);
    r.domElement.classList.add('gl');

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 900);
    this._baseFov = 45;
    this.camera.position.set(8, 4, 18);

    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;

    this.sky = makeSky();
    this.scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight('#fff', '#888', 1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff', 2);
    this.sun.castShadow = true;
    const hiQ = Math.min(window.innerWidth, window.innerHeight) > 700;
    this.sun.shadow.mapSize.set(hiQ ? 4096 : 2048, hiQ ? 4096 : 2048);
    this.sun.shadow.radius = 3;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    const sc = this.sun.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 160;
    this.scene.add(this.sun, this.sun.target);

    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 0.8;
    this.controls.maxDistance = 120;
    this.controls.screenSpacePanning = true;

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.3, 1.0);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.roots = { city: new THREE.Group(), hero: new THREE.Group(), items: new THREE.Group() };
    for (const g of Object.values(this.roots)) this.scene.add(g);
    this.selBox = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color('#5b8cff'));
    this.selBox.material.depthTest = false;
    this.selBox.material.transparent = true;
    this.selBox.material.opacity = 0.9;
    this.selBox.renderOrder = 20;
    this.selBox.visible = false;
    this.scene.add(this.selBox);

    this._setupWalk();
    this._setupDrag();
    this._camAnim = null;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this._tick());
  }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- waktu & latar ----------
  setTime(key, bg, bgTexture) {
    this.timeKey = key;
    const t = TIME[key] || TIME.day;
    const u = this.sky.material.uniforms;
    u.top.value.set(t.top); u.bottom.value.set(t.bottom); u.glowCol.value.set(t.glow); u.glowAmt.value = t.glowAmt;
    u.sunDir.value.set(...t.sunPos).normalize(); u.sunCol.value.set(t.sun); u.sunAmt.value = t.sunAmt;
    u.cloudCol.value.set(t.cloud); u.cloudAmt.value = t.cloudAmt; u.stars.value = t.stars;
    this.hemi.color.set(t.hemiSky); this.hemi.groundColor.set(t.hemiGround); this.hemi.intensity = t.hemi;
    this.sun.color.set(t.sun); this.sun.intensity = this.indoor ? t.sunI * 0.08 : t.sunI;
    if (this.indoor) { this.hemi.color.set('#fff6ea'); this.hemi.groundColor.set('#8c8577'); this.hemi.intensity = 0.55; }
    this.sunOffset = new THREE.Vector3(...t.sunPos);
    this.renderer.toneMappingExposure = this.indoor ? 0.85 : t.exp;
    this.bloom.strength = this.indoor ? 0.45 : t.bloom;
    this.bloom.threshold = this.indoor ? 1.2 : t.thr;
    this.scene.environmentIntensity = this.indoor ? 0.35 : t.env;
    this.windowLevel = t.windows;
    this.lampLevel = t.lamps;
    this._applyEnvLevels();
    // latar
    this.sky.visible = !bg || bg.mode === 'sky';
    if (bg && bg.mode === 'color') this.scene.background = new THREE.Color(bg.color);
    else if (bg && bg.mode === 'studio') this.scene.background = new THREE.Color(key === 'night' ? '#15181e' : '#d5d9de');
    else if (bg && bg.mode === 'image' && bgTexture) this.scene.background = bgTexture;
    else { this.scene.background = null; this.sky.visible = true; }
    this.scene.fog = this.sky.visible ? new THREE.Fog(t.fog, 90, 380) : null;
  }

  _applyEnvLevels() {
    for (const m of this.ctx.windowMats) m.emissiveIntensity = this.windowLevel * 0.55;
    for (const m of this.ctx.lampMats) m.emissiveIntensity = this.lampLevel * 1.6;
    for (const l of this.ctx.lampLights) l.intensity = this.lampLevel * 14;
  }

  setCity(group, ctx) {
    this._replace('city', group);
    this.ctx.windowMats.push(...ctx.windowMats);
    this.ctx.lampMats.push(...ctx.lampMats);
    this.ctx.lampLights.push(...ctx.lampLights);
    this._applyEnvLevels();
  }
  setHero(group, ctx) {
    // simpan material kota, ganti material hero
    this.ctx.windowMats = this.ctx.windowMats.filter((m) => !m.userData.hero);
    ctx.windowMats.forEach((m) => (m.userData.hero = true));
    this.ctx.windowMats.push(...ctx.windowMats);
    this._replace('hero', group);
    this._applyEnvLevels();
  }
  setCityVisible(v) { this.roots.city.visible = v; }

  static dispose(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const k of ['map', 'emissiveMap']) if (m[k] && !m[k].userData.shared && !m[k].userData.keep) m[k].dispose();
        m.dispose();
      }
    });
  }

  _replace(key, group) {
    const root = this.roots[key];
    for (const c of [...root.children]) { root.remove(c); Engine.dispose(c); }
    if (group) root.add(group);
  }

  // ---------- item signage ----------
  _item(id) {
    let it = this.items.get(id);
    if (!it) {
      const root = new THREE.Group();
      root.userData.itemId = id;
      const sign = new THREE.Group(); sign.userData.itemId = id;
      const support = new THREE.Group();
      const dims = new THREE.Group(); dims.userData.noPick = true;
      sign.add(dims);
      root.add(sign, support);
      this.roots.items.add(root);
      it = { root, sign, support, dims, body: null, fx: { glow: [], halo: null, light: null, lightBase: 0, effect: 'static', ledColor: new THREE.Color('#fff') } };
      this.items.set(id, it);
    }
    return it;
  }

  setItemSign(id, group, fx) {
    const it = this._item(id);
    if (it.body) { it.sign.remove(it.body); Engine.dispose(it.body); }
    it.body = group;
    if (group) it.sign.add(group);
    it.fx = { ...it.fx, ...fx };
    for (const g of it.fx.glow || []) g.mat.userData.baseEmissive = g.mat.emissive.clone();
  }

  setItemSupport(id, group) {
    const it = this._item(id);
    for (const c of [...it.support.children]) { it.support.remove(c); Engine.dispose(c); }
    if (group) it.support.add(group);
  }

  setItemTransform(id, signPos, signRot, supportPos, supportRot) {
    const it = this._item(id);
    it.sign.position.copy(signPos);
    it.sign.rotation.set(0, signRot, 0);
    it.support.position.copy(supportPos);
    it.support.rotation.set(0, supportRot, 0);
    if (id === this.selectedId) this._updateSelBox();
  }

  setItemDims(id, group) {
    const it = this._item(id);
    for (const c of [...it.dims.children]) { it.dims.remove(c); Engine.dispose(c); }
    if (group) it.dims.add(group);
  }

  removeItem(id) {
    const it = this.items.get(id);
    if (!it) return;
    this.roots.items.remove(it.root);
    Engine.dispose(it.root);
    this.items.delete(id);
    if (this.selectedId === id) { this.selectedId = null; this.selBox.visible = false; }
  }

  select(id, show) {
    this.selectedId = id;
    this.showSelection = show;
    this._updateSelBox();
  }

  _updateSelBox() {
    const it = this.items.get(this.selectedId);
    if (!it || !it.body || !this.showSelection || this.mode === 'walk') { this.selBox.visible = false; return; }
    it.sign.updateMatrixWorld(true);
    const b = new THREE.Box3();
    it.body.traverse((o) => {
      if (o.isMesh && !o.userData.noPick && o.geometry) {
        o.geometry.computeBoundingBox();
        b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
      }
    });
    if (b.isEmpty()) { this.selBox.visible = false; return; }
    b.expandByScalar(0.06);
    this.selBox.box.copy(b);
    this.selBox.visible = true;
  }

  // ---------- kamera ----------
  focus(target, size, rotY = 0) { this.focusTarget = target.clone(); this.focusSize = size; this.focusRot = rotY; }

  cameraPreset(name, instant = false) {
    if (this.mode === 'walk') this.exitWalk();
    const t = this.focusTarget || new THREE.Vector3(0, 3, 0);
    const s = this.focusSize || { w: 3, h: 1 };
    const yaw = this.focusRot || 0;
    const d = Math.max(s.w, s.h * 2.2) * 1.45 + 3.2;
    const local = {
      hero: new THREE.Vector3(d * 0.42, s.h * 0.35 + 1.2, d * 1.05),
      front: new THREE.Vector3(0, s.h * 0.15 + 0.4, d),
      side: new THREE.Vector3(d * 0.85, s.h * 0.4 + 1, d * 0.45),
      top: new THREE.Vector3(0.01, d * 0.95, d * 0.45),
      close: new THREE.Vector3(s.w * 0.12, s.h * 0.05, Math.max(1.3, d * 0.4)),
      street: null,
    }[name];
    let pos;
    if (name === 'street') {
      // sudut pandang pejalan kaki di trotoar seberang
      pos = new THREE.Vector3(t.x + 6, 1.65, Math.max(t.z + 6, 14.5));
    } else {
      pos = local.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(t);
      pos.y = Math.max(pos.y, 0.4);
      if (this.camYMax) { pos.y = Math.min(pos.y, this.camYMax); if (this.camZMax) pos.z = Math.min(pos.z, this.camZMax); }
    }
    this._animateCam(pos, t.clone(), instant ? 0 : 0.9);
  }

  _animateCam(pos, target, dur) {
    if (!dur) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.controls.update();
      return;
    }
    this._camAnim = { p0: this.camera.position.clone(), t0: this.controls.target.clone(), p1: pos, t1: target, t: 0, dur };
  }

  // ---------- efek LED per frame ----------
  _applyFx(time) {
    const tk = this.timeKey === 'day' ? 0.55 : this.timeKey === 'dusk' ? 0.85 : 1;
    const nightK = this.timeKey === 'night' ? 1 : this.timeKey === 'dusk' ? 0.6 : 0.15;
    for (const it of this.items.values()) {
      const f = it.fx;
      let k = 1;
      if (f.effect === 'breath') k = 0.55 + 0.45 * Math.sin(time * 2.2);
      else if (f.effect === 'blink') k = Math.sin(time * Math.PI * 1.6) > -0.2 ? 1 : 0.04;
      const col = f.effect === 'rgb' ? new THREE.Color().setHSL((time * 0.12) % 1, 1, 0.55) : null;
      for (const g of f.glow || []) {
        g.mat.emissiveIntensity = g.base * k * tk;
        if (col) g.mat.emissive.copy(col); else if (g.mat.userData.baseEmissive) g.mat.emissive.copy(g.mat.userData.baseEmissive);
      }
      if (f.halo) {
        f.halo.mat.opacity = Math.min(1, f.halo.base * k * (this.timeKey === 'day' ? 0.5 : 1));
        f.halo.mat.color.copy(col || f.ledColor);
      }
      if (f.light) {
        f.light.intensity = f.lightBase * k * nightK;
        f.light.color.copy(col || f.ledColor);
      }
    }
  }

  _tick() {
    const raw = this.clock.getDelta();
    this._fpsTick(raw);
    const dt = Math.min(raw, 0.05);
    const time = this.clock.elapsedTime;
    if (this._camAnim) {
      const a = this._camAnim;
      a.t += dt / a.dur;
      const e = a.t >= 1 ? 1 : 1 - Math.pow(1 - a.t, 3);
      this.camera.position.lerpVectors(a.p0, a.p1, e);
      this.controls.target.lerpVectors(a.t0, a.t1, e);
      if (a.t >= 1) this._camAnim = null;
    }
    if (this.mode === 'walk') this._walkUpdate(dt);
    else this.controls.update();
    if (this.camYMax && this.camera.position.y > this.camYMax) this.camera.position.y = this.camYMax;
    // matahari mengikuti area fokus agar bayangan tajam
    const ft = this.focusTarget || new THREE.Vector3();
    if (this.sunOffset) {
      this.sun.position.copy(ft).add(this.sunOffset);
      this.sun.target.position.copy(ft);
    }
    this.sky.position.copy(this.camera.position);
    this._applyFx(time);
    this.composer.render();
  }

  // ---------- drag signage ----------
  _setupDrag() {
    const el = this.renderer.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hitPoint = new THREE.Vector3();
    let drag = null;
    const toNdc = (e) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, this.camera);
    };
    const pickSign = () => {
      const meshes = [];
      this.roots.items.traverse((o) => { if (o.isMesh && !o.userData.noPick && o.visible) meshes.push(o); });
      const hit = ray.intersectObjects(meshes, false)[0];
      if (!hit) return null;
      let o = hit.object;
      while (o && o.userData.itemId === undefined) o = o.parent;
      return o ? { id: o.userData.itemId, hit } : null;
    };
    el.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'orbit' || e.button !== 0) return;
      toNdc(e);
      const hit = pickSign();
      if (!hit) return;
      const info = this.hooks.onPick ? this.hooks.onPick(hit.id) : null;
      if (!info) return;
      this.dragPlane = info.plane; this.dragOrigin = info.origin;
      if (!ray.ray.intersectPlane(this.dragPlane, hitPoint)) return;
      drag = { offset: new THREE.Vector3().subVectors(this.dragOrigin(), hitPoint), id: e.pointerId, item: hit.id };
      this.controls.enabled = false;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
      this.hooks.onDragStart && this.hooks.onDragStart();
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (this.mode !== 'orbit') return;
      toNdc(e);
      if (drag) {
        if (ray.ray.intersectPlane(this.dragPlane, hitPoint)) {
          this.hooks.onDrag && this.hooks.onDrag(drag.item, hitPoint.add(drag.offset));
        }
        return;
      }
      if (e.pointerType === 'mouse' && !e.buttons) el.style.cursor = pickSign() ? 'grab' : '';
    });
    const end = (e) => {
      if (!drag) return;
      drag = null;
      this.controls.enabled = true;
      el.style.cursor = '';
      try { el.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
      this.hooks.onDragEnd && this.hooks.onDragEnd();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }


  // ---------- mode jalan 3D (third / first person) ----------
  _setupWalk() {
    const av = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: '#e0b48f', roughness: 0.7 });
    const shirt = new THREE.MeshStandardMaterial({ color: '#2f5bff', roughness: 0.6 });
    const pants = new THREE.MeshStandardMaterial({ color: '#1d2230', roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 6, 12), shirt); body.position.y = 1.15;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), skin); head.position.y = 1.62;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), pants); hair.position.y = 1.64;
    const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.6, 4, 8), pants); legL.position.set(-0.1, 0.42, 0);
    const legR = legL.clone(); legR.position.x = 0.1;
    const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.5, 4, 8), shirt); armL.position.set(-0.28, 1.15, 0);
    const armR = armL.clone(); armR.position.x = 0.28;
    av.add(body, head, hair, legL, legR, armL, armR);
    av.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.noPick = true; } });
    av.visible = false;
    this.scene.add(av);
    this.avatar = { group: av, legL, legR, armL, armR, phase: 0 };
    this.walk = { yaw: Math.PI, pitch: -0.08, yawS: Math.PI, pitchS: -0.08, keys: new Set(), joy: { x: 0, y: 0 }, view: 'third', sprint: false, camDist: 4.6 };

    const isTyping = (e) => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
    window.addEventListener('keydown', (e) => {
      if (this.mode !== 'walk' || isTyping(e)) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyE'].includes(e.code)) {
        this.walk.keys.add(e.code); e.preventDefault();
      }
      if (e.code === 'KeyV') this.toggleWalkView();
      if (e.code === 'Escape') this.exitWalk();
    });
    window.addEventListener('keyup', (e) => this.walk.keys.delete(e.code));
    window.addEventListener('blur', () => this.walk.keys.clear());

    // geser layar untuk melihat sekeliling saat jalan.
    // Hanya satu pointer yang dipakai, perubahan per-gerakan dibatasi, dan
    // status selalu direset saat pointer lepas/batal → kamera tidak "muter-muter".
    const el = this.renderer.domElement;
    let look = null;
    const stopLook = (e) => {
      if (!look || (e && e.pointerId !== look.id)) return;
      try { el.releasePointerCapture(look.id); } catch (_) { /* noop */ }
      look = null;
    };
    // cubit dua jari = zoom saat mode jalan
    const touches = new Map();
    let pinch = 0;
    const pinchDist = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    el.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'walk' || e.pointerType !== 'touch') return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) { stopLook(); pinch = pinchDist(); }
    });
    el.addEventListener('pointermove', (e) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2 && pinch > 0) {
        const d = pinchDist();
        this.zoom(THREE.MathUtils.clamp(pinch / d, 0.8, 1.25));
        pinch = d;
      }
    });
    const endTouch = (e) => { touches.delete(e.pointerId); if (touches.size < 2) pinch = 0; };
    el.addEventListener('pointerup', endTouch);
    el.addEventListener('pointercancel', endTouch);
    el.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'walk' || look || touches.size > 1 || (e.pointerType === 'mouse' && e.button !== 0)) return;
      look = { id: e.pointerId, x: e.clientX, y: e.clientY };
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (this.mode !== 'walk' || !look || e.pointerId !== look.id) return;
      if (e.pointerType === 'mouse' && !(e.buttons & 1)) { stopLook(e); return; }
      const dx = THREE.MathUtils.clamp(e.clientX - look.x, -60, 60);
      const dy = THREE.MathUtils.clamp(e.clientY - look.y, -60, 60);
      look.x = e.clientX; look.y = e.clientY;
      const k = e.pointerType === 'touch' ? 0.0055 : 0.0038;
      this.walk.yaw -= dx * k;
      this.walk.pitch = THREE.MathUtils.clamp(this.walk.pitch - dy * k * 0.85, -0.75, 0.75);
    });
    el.addEventListener('pointerup', stopLook);
    el.addEventListener('pointercancel', stopLook);
    el.addEventListener('lostpointercapture', stopLook);
    window.addEventListener('blur', () => stopLook());
    el.addEventListener('wheel', (e) => {
      if (this.mode !== 'walk') return;
      this.zoom(e.deltaY > 0 ? 1.08 : 0.93);
    }, { passive: true });
  }

  enterWalk(bounds) {
    this.mode = 'walk';
    this.walkBounds = bounds;
    this.controls.enabled = false;
    this._camAnim = null;
    const t = this.focusTarget || new THREE.Vector3();
    const start = new THREE.Vector3(t.x + 3, 0.15, Math.min(Math.max(t.z + 7, 9), 16));
    if (bounds && bounds.startZ !== undefined) start.z = bounds.startZ;
    this.avatar.group.position.copy(start);
    // hadapkan ke signage
    this.walk.yaw = Math.atan2(t.x - start.x, t.z - start.z) + Math.PI;
    this.walk.pitch = -0.05 + Math.min(0.5, Math.max(0, (t.y - 2) / 25));
    this.walk.yawS = this.walk.yaw; this.walk.pitchS = this.walk.pitch;
    this.avatar.group.rotation.y = this.walk.yaw + Math.PI;
    this.avatar.group.visible = this.walk.view === 'third';
    this.selBox.visible = false;
    this.hooks.onModeChange && this.hooks.onModeChange('walk');
  }

  exitWalk() {
    if (this.mode !== 'walk') return;
    this.mode = 'orbit';
    this.controls.enabled = true;
    if (this.camera.fov !== this._baseFov) { this.camera.fov = this._baseFov; this.camera.updateProjectionMatrix(); }
    this.avatar.group.visible = false;
    this.walk.keys.clear();
    this.walk.joy.x = this.walk.joy.y = 0;
    this.hooks.onModeChange && this.hooks.onModeChange('orbit');
    this._updateSelBox();
    this.cameraPreset('front');
  }

  toggleWalkView() {
    this.walk.view = this.walk.view === 'third' ? 'first' : 'third';
    this.avatar.group.visible = this.mode === 'walk' && this.walk.view === 'third';
    this.hooks.onWalkView && this.hooks.onWalkView(this.walk.view);
  }

  // ---------- kualitas grafis ----------
  /** 'high' | 'low' — resolusi, bayangan, dan objek detail kota. */
  setQuality(level) {
    this.quality = level;
    const low = level === 'low';
    this.renderer.setPixelRatio(low ? Math.min(window.devicePixelRatio, 1) : Math.min(window.devicePixelRatio, 2));
    const big = Math.min(window.innerWidth, window.innerHeight) > 700;
    const size = low ? 1024 : big ? 4096 : 2048;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.roots.city.traverse((o) => { if (o.userData.detail) o.visible = !low; });
    this.resize();
  }
  /** Pantau FPS; panggil cb sekali jika terlalu lambat. */
  watchFps(cb) { this._fps = cb ? { t: 0, n: 0, slow: 0, cb } : null; }
  _fpsTick(dt) {
    const f = this._fps;
    if (!f || document.hidden) return;
    f.t += dt; f.n++;
    if (f.t < 2) return;
    const fps = f.n / f.t;
    f.t = 0; f.n = 0;
    f.slow = fps < 28 ? f.slow + 1 : 0;
    if (f.slow >= 2) { const cb = f.cb; this._fps = null; cb(fps); }
  }

  /** Zoom kamera: k < 1 mendekat, k > 1 menjauh. */
  zoom(k) {
    if (this.mode === 'walk') {
      if (this.walk.view === 'first') {
        this.camera.fov = THREE.MathUtils.clamp(this.camera.fov * k, 22, 75);
        this.camera.updateProjectionMatrix();
      } else {
        this.walk.camDist = THREE.MathUtils.clamp(this.walk.camDist * k, 1.4, 12);
      }
      return;
    }
    const t = this.controls.target;
    const off = this.camera.position.clone().sub(t);
    const d = THREE.MathUtils.clamp(off.length() * k, this.controls.minDistance, this.controls.maxDistance);
    off.setLength(d);
    this._animateCam(t.clone().add(off), t.clone(), 0.25);
  }

  setJoystick(x, y) { this.walk.joy.x = x; this.walk.joy.y = y; }
  setSprint(v) { this.walk.sprint = v; }

  _walkUpdate(dt) {
    const w = this.walk, k = w.keys;
    let fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) + w.joy.y;
    let str = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + w.joy.x;
    const turn = (k.has('ArrowRight') || k.has('KeyE') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyQ') ? 1 : 0);
    w.yaw -= turn * dt * 1.8;
    // sudut kamera dihaluskan sedikit, tetapi posisi kamera dihitung langsung
    // dari sudut tersebut (tanpa lerp posisi) agar tidak berayun/berputar.
    const sm = 1 - Math.exp(-dt * 18);
    w.yawS += Math.atan2(Math.sin(w.yaw - w.yawS), Math.cos(w.yaw - w.yawS)) * sm;
    w.pitchS += (w.pitch - w.pitchS) * sm;
    fwd = THREE.MathUtils.clamp(fwd, -1, 1); str = THREE.MathUtils.clamp(str, -1, 1);
    const speed = (w.sprint || k.has('ShiftLeft') || k.has('ShiftRight') ? 6.5 : 3.0) * dt;
    const a = this.avatar;
    const dir = new THREE.Vector3(-Math.sin(w.yawS), 0, -Math.cos(w.yawS)); // arah hadap kamera
    const right = new THREE.Vector3(-dir.z, 0, dir.x);
    const move = dir.multiplyScalar(fwd).add(right.multiplyScalar(str));
    const moving = move.lengthSq() > 0.0001;
    if (moving) {
      move.normalize().multiplyScalar(speed);
      a.group.position.add(move);
      const b = this.walkBounds || { x: [-60, 60], z: [-30, 30] };
      a.group.position.x = THREE.MathUtils.clamp(a.group.position.x, b.x[0], b.x[1]);
      a.group.position.z = THREE.MathUtils.clamp(a.group.position.z, b.z[0], b.z[1]);
      // badan menghadap arah jalan kecuali mundur (tetap menghadap depan)
      const face = fwd < -0.2 && Math.abs(str) < 0.3 ? Math.atan2(-move.x, -move.z) : Math.atan2(move.x, move.z);
      let d = face - a.group.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      a.group.rotation.y += d * Math.min(1, dt * 10);
      a.phase += dt * (speed / dt) * 2.6;
    } else {
      a.phase *= 0.9;
    }
    const sw = Math.sin(a.phase) * (moving ? 0.5 : 0);
    a.legL.rotation.x = sw; a.legR.rotation.x = -sw; a.armL.rotation.x = -sw * 0.8; a.armR.rotation.x = sw * 0.8;
    a.group.position.y = a.group.position.z > 3.9 && a.group.position.z < 7.1 ? 0.15 : a.group.position.z > 14 && a.group.position.z < 17 ? 0.15 : 0;

    const head = a.group.position.clone().add(new THREE.Vector3(0, 1.62, 0));
    const lookDir = new THREE.Vector3(-Math.sin(w.yawS) * Math.cos(w.pitchS), Math.sin(w.pitchS), -Math.cos(w.yawS) * Math.cos(w.pitchS));
    if (w.view === 'first') {
      this.camera.position.copy(head);
      this.camera.lookAt(head.clone().add(lookDir));
    } else {
      const pivot = head.clone().add(new THREE.Vector3(0, 0.25, 0));
      const camPos = pivot.clone().addScaledVector(lookDir, -w.camDist);
      camPos.y = Math.max(camPos.y, 0.35);
      this.camera.position.copy(camPos);
      this.camera.lookAt(pivot.clone().addScaledVector(lookDir, 3));
    }
  }

  /** Render satu bidikan dari preset kamera tanpa mengubah tampilan pengguna. */
  captureView(target, size, rotY, preset = 'front', w = 1200, h = 675) {
    const save = { pos: this.camera.position.clone(), tgt: this.controls.target.clone(), ft: this.focusTarget, fs: this.focusSize, fr: this.focusRot, sel: this.selBox.visible, aspect: this.camera.aspect };
    const dims = [];
    this.roots.items.traverse((o) => { if (o.userData.isDims) { dims.push([o, o.visible]); o.visible = false; } });
    this.focus(target, size, rotY);
    this.cameraPreset(preset, true);
    this.selBox.visible = false;
    const cw = this.renderer.domElement.width, ch = this.renderer.domElement.height;
    this.camera.aspect = cw / ch;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.controls.target);
    this.composer.render();
    const src = this.renderer.domElement;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const k = Math.max(w / src.width, h / src.height);
    const dw = src.width * k, dh = src.height * k;
    c.getContext('2d').drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
    // pulihkan
    this.camera.position.copy(save.pos); this.controls.target.copy(save.tgt);
    this.focusTarget = save.ft; this.focusSize = save.fs; this.focusRot = save.fr;
    this.camera.aspect = save.aspect; this.camera.updateProjectionMatrix();
    this.controls.update();
    this.selBox.visible = save.sel;
    for (const [o, v] of dims) o.visible = v;
    this.composer.render();
    return c.toDataURL('image/jpeg', 0.88);
  }

  screenshot() {
    const sel = this.selBox.visible;
    this.selBox.visible = false;
    this.composer.render();
    const url = this.renderer.domElement.toDataURL('image/png');
    this.selBox.visible = sel;
    return url;
  }
}
