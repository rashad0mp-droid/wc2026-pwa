// A T-style electric guitar modelled entirely in code (units are centimetres).
// Parts sit in groups so the page can pull the instrument apart on scroll.
import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, Shape, ExtrudeGeometry, BoxGeometry, CylinderGeometry, SphereGeometry,
  MeshPhysicalMaterial, MeshStandardMaterial, CanvasTexture, RepeatWrapping, SRGBColorSpace, PMREMGenerator, ACESFilmicToneMapping,
  DirectionalLight, BufferGeometry, Float32BufferAttribute, Color, Vector3, Quaternion,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const SCALE = 64.8, NUT = 55.8, SADDLE = NUT - SCALE, ZT = 2.7; // ZT: front face of the body

/* ---------- procedural textures ---------- */
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.anisotropy = 8; return t;
}
function grainTex(seed, strength, lines, wobble) {
  return canvasTex(1024, 1024, (g, w, h) => {
    const r = rng(seed); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < lines; i++) {
      const x0 = r() * w, a = (0.04 + r() * 0.16) * strength, lw = 0.6 + r() * r() * 5, f = 1.5 + r() * 3, ph = r() * 6.28, amp = wobble * (0.3 + r());
      g.strokeStyle = `rgba(70,38,8,${a})`; g.lineWidth = lw; g.beginPath();
      for (let y = 0; y <= h; y += 16) { const x = x0 + Math.sin((y / h) * f * 6.28 + ph) * amp + Math.sin((y / h) * 23 + ph * 3) * amp * 0.12; y ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(60,30,5,${r() * 0.07 * strength})`; g.fillRect(r() * w, r() * h, 1, 3 + r() * 14); }
  });
}
function tortoiseTex() {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(11); g.fillStyle = '#3a0f08'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = r() * w, y = r() * h, s = 12 + r() * 46; const gr = g.createRadialGradient(x, y, 0, x, y, s);
      const hot = r() > 0.45; gr.addColorStop(0, hot ? 'rgba(214,96,22,.85)' : 'rgba(16,5,4,.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2);
    }
  });
}

/* ---------- geometry helpers ---------- */
function rrect(w, h, r) {
  const s = new Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0); s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI); s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5); return s;
}
const plate = (w, h, r, d, bevel = 0.05) => new ExtrudeGeometry(rrect(w, h, r), { depth: d, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 10 });
// loft a cross-section along Y. profile(i) returns [[x,z],...] for station i.
function loft(ys, profile) {
  const pos = [], idx = []; const n = profile(0).length;
  ys.forEach((y, i) => profile(i).forEach(([x, z]) => pos.push(x, y, z)));
  for (let i = 0; i < ys.length - 1; i++) for (let j = 0; j < n; j++) { const a = i * n + j, b = i * n + ((j + 1) % n), c = a + n, d = b + n; idx.push(a, b, c, b, d, c); }
  const cap = (i, flip) => { const base = pos.length / 3; let cx = 0, cz = 0; const p = profile(i); p.forEach(([x, z]) => { cx += x / n; cz += z / n; }); pos.push(cx, ys[i], cz);
    for (let j = 0; j < n; j++) { const a = i * n + j, b = i * n + ((j + 1) % n); flip ? idx.push(base, b, a) : idx.push(base, a, b); } };
  cap(0, true); cap(ys.length - 1, false);
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function between(a, b, radius, mat) {
  const d = new Vector3().subVectors(b, a), m = new Mesh(new CylinderGeometry(radius, radius, d.length(), 6), mat);
  m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize())); return m;
}
const neckW = (y) => 4.25 + (5.65 - 4.25) * ((NUT - y) / (NUT - 9.4));
const fretY = (n) => NUT - SCALE * (1 - Math.pow(2, -n / 12));

export function createGuitar(canvas) {
  let renderer;
  try { renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;

  const scene = new Scene();
  const pm = new PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.03).texture; scene.environmentIntensity = 0.62;
  const cam = new PerspectiveCamera(28, 1, 10, 500); cam.position.set(0, 0, 150);
  const key = new DirectionalLight(0xffe2bd, 2.6); key.position.set(-60, 80, 90); scene.add(key);
  const rim = new DirectionalLight(0x9db8ff, 1.5); rim.position.set(80, 30, -70); scene.add(rim);
  const fill = new DirectionalLight(0xff9a52, 0.7); fill.position.set(70, -60, 50); scene.add(fill);

  /* materials */
  const ash = grainTex(7, 0.8, 150, 9), fine = grainTex(3, 0.55, 150, 6), rose = grainTex(5, 1.5, 170, 5);
  ash.repeat.set(1 / 34, 1 / 42); ash.offset.set(0.5, 0.5); fine.repeat.set(0.16, 0.02); rose.repeat.set(0.2, 0.025);
  const M = {
    body: new MeshPhysicalMaterial({ color: 0xdb982b, map: ash, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.06 }),
    guard: new MeshPhysicalMaterial({ color: 0x0b0b0b, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
    maple: new MeshPhysicalMaterial({ color: 0xe6bd72, map: fine, roughness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
    board: new MeshPhysicalMaterial({ color: 0xe9c47c, map: fine, roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
    chrome: new MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.14 }),
    nickel: new MeshStandardMaterial({ color: 0xcfd0cc, metalness: 1, roughness: 0.28 }),
    brass: new MeshStandardMaterial({ color: 0xc79a3c, metalness: 1, roughness: 0.3 }),
    black: new MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.5 }),
    bone: new MeshStandardMaterial({ color: 0xece4d2, roughness: 0.6 }),
    dot: new MeshStandardMaterial({ color: 0x15120f, roughness: 0.5 }),
    string: new MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1, roughness: 0.32, transparent: true }),
  };
  const tort = tortoiseTex(); tort.repeat.set(0.08, 0.08);

  const root = new Group(), model = new Group(); root.add(model); scene.add(root);
  const G = {}; ['bodyG', 'guardG', 'hardG', 'neckG', 'strG'].forEach((k) => { G[k] = new Group(); model.add(G[k]); });
  const add = (g, geo, mat, x = 0, y = 0, z = 0) => { const m = new Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const cylZ = (r, h, seg = 28) => { const g = new CylinderGeometry(r, r, h, seg); g.rotateX(Math.PI / 2); return g; };

  /* body */
  const b = new Shape(); b.moveTo(0, -20);
  b.bezierCurveTo(9, -20.3, 16, -17, 16, -9.5); b.bezierCurveTo(16, -3, 11.2, -1.5, 11.2, 3.5); b.bezierCurveTo(11.2, 7.5, 13.6, 9.5, 13.4, 13);
  b.bezierCurveTo(13.2, 16.4, 9.6, 17.2, 8, 14.6); b.bezierCurveTo(6.8, 12.6, 4.6, 11.6, 2.9, 12.6); b.lineTo(2.9, 13.4); b.lineTo(-2.9, 16.2);
  b.bezierCurveTo(-3.6, 18.9, -6.5, 20.2, -9, 19.5); b.bezierCurveTo(-12.6, 18.5, -14, 14.5, -13.2, 11); b.bezierCurveTo(-12.4, 7.8, -11.2, 6.5, -11.2, 3.5);
  b.bezierCurveTo(-11.2, -1.5, -16, -3, -16, -9.5); b.bezierCurveTo(-16, -17, -9, -20.3, 0, -20);
  const bodyGeo = new ExtrudeGeometry(b, { depth: 4.4, bevelEnabled: true, bevelSize: 0.5, bevelThickness: 0.5, bevelSegments: 6, curveSegments: 40 });
  bodyGeo.translate(0, 0, -2.2);
  add(G.bodyG, bodyGeo, M.body);
  add(G.bodyG, new SphereGeometry(0.55, 16, 12), M.chrome, 0, -20.7, 0);
  add(G.bodyG, new SphereGeometry(0.55, 16, 12), M.chrome, -9.6, 20.1, 0);
  // neck pocket shadow so the body reads right when the neck lifts away
  add(G.bodyG, plate(5.5, 6.0, 0.3, 0.06, 0), M.black, 0, 12.5, ZT - 0.02);
  // routed cavities, only seen once the guard and hardware lift away
  add(G.bodyG, plate(7.6, 2.6, 1.2, 0.06, 0), M.black, 0, 6.3, ZT - 0.03);
  add(G.bodyG, plate(7.4, 2.4, 1.1, 0.06, 0), M.black, 0, -6.5, ZT - 0.03).rotation.z = 0.19;
  add(G.bodyG, plate(2.4, 13.6, 1.1, 0.06, 0), M.black, 8.3, -8.6, ZT - 0.03);
  for (let i = 0; i < 6; i++) add(G.bodyG, cylZ(0.2, 0.06, 10), M.black, (i - 2.5) * 1.06, -12.6, ZT - 0.02);

  /* pickguard + neck pickup */
  const pg = new Shape(); pg.moveTo(-3, 15.4);
  pg.bezierCurveTo(-6.5, 17.6, -11.2, 16.2, -11.5, 11.5); pg.bezierCurveTo(-11.7, 8, -9.8, 6.2, -9.8, 3); pg.bezierCurveTo(-9.8, -0.6, -8.5, -3, -6.2, -3.1);
  pg.lineTo(4.4, -2.2); pg.bezierCurveTo(7.2, -1.8, 9.6, 1.6, 9.7, 5.5); pg.bezierCurveTo(9.8, 8, 11.9, 9.8, 11.8, 12.6);
  pg.bezierCurveTo(11.7, 15, 9.9, 15.4, 8.9, 13.6); pg.bezierCurveTo(7.6, 11.2, 5, 10.2, 3, 11.2); pg.lineTo(3, 15.4); pg.lineTo(-3, 15.4);
  add(G.guardG, new ExtrudeGeometry(pg, { depth: 0.2, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1, curveSegments: 24 }), M.guard, 0, 0, ZT + 0.02);
  add(G.guardG, plate(7, 1.85, 0.9, 0.75, 0.12), M.chrome, 0, 6.3, ZT + 0.2);
  [[-10.6, 13], [-9, 4], [-5.6, -2.4], [3.6, -1.6], [10.9, 12.2], [4.2, 11.6], [-4, 15.1], [9, 5.2]].forEach(([x, y]) => add(G.guardG, cylZ(0.22, 0.1, 10), M.nickel, x, y, ZT + 0.3));

  /* hardware: bridge, pickup, controls */
  add(G.hardG, plate(8.4, 9.2, 0.5, 0.26), M.chrome, 0, -9.4, ZT);
  add(G.hardG, new BoxGeometry(0.2, 5.2, 0.95), M.chrome, -4.1, -11.4, ZT + 0.55); add(G.hardG, new BoxGeometry(0.2, 5.2, 0.95), M.chrome, 4.1, -11.4, ZT + 0.55);
  add(G.hardG, new BoxGeometry(8.4, 0.2, 0.95), M.chrome, 0, -13.95, ZT + 0.55);
  [-2.65, 0, 2.65].forEach((x) => { const s = new CylinderGeometry(0.42, 0.42, 2.45, 20); s.rotateZ(Math.PI / 2); add(G.hardG, s, M.brass, x, SADDLE, ZT + 1.14);
    G.hardG.add(between(new Vector3(x, SADDLE, ZT + 1.14), new Vector3(x, -13.9, ZT + 0.95), 0.1, M.nickel)); });
  const bp = add(G.hardG, plate(7, 1.7, 0.84, 0.7, 0.08), M.black, 0, -6.5, ZT + 0.3); bp.rotation.z = 0.19;
  for (let i = 0; i < 6; i++) { const x = (i - 2.5) * 1.06; add(G.hardG, cylZ(0.24, 0.12, 12), M.nickel, x * Math.cos(0.19), -6.5 + x * Math.sin(0.19), ZT + 1.1); add(G.guardG, cylZ(0.2, 0.06, 12), M.nickel, (i - 2.5) * 0.98, 6.3, ZT + 1.08); }
  add(G.hardG, plate(3.3, 15.4, 1.6, 0.2), M.chrome, 8.3, -8.6, ZT);
  [-9.3, -13.6].forEach((y) => { add(G.hardG, cylZ(1.0, 1.25, 40), M.chrome, 8.3, y, ZT + 0.85); add(G.hardG, cylZ(0.86, 0.08, 40), M.nickel, 8.3, y, ZT + 1.5); });
  add(G.hardG, new BoxGeometry(0.3, 2.6, 0.1), M.black, 8.3, -3.6, ZT + 0.24);
  const sw = add(G.hardG, cylZ(0.38, 1.0, 16), M.black, 8.3, -3.0, ZT + 0.75); sw.rotation.x = -0.35;
  add(G.hardG, cylZ(0.9, 0.5, 24), M.chrome, 15.2, -13.2, 0).rotation.y = Math.PI / 2;

  /* neck */
  const zt = ZT + 0.55; // top of the maple, underside of the fretboard
  const ys = []; for (let i = 0; i <= 24; i++) ys.push(9.4 + (NUT - 9.4) * (i / 24));
  add(G.neckG, loft(ys, (i) => { const w = neckW(ys[i]) / 2, d = 2.25 - 0.3 * (i / 24); const p = []; for (let k = 0; k <= 16; k++) { const a = Math.PI + (Math.PI * k) / 16; p.push([w * Math.cos(a), zt + d * Math.sin(a) * (0.82 + 0.18 * Math.abs(Math.cos(a)))]); } return p; }), M.maple);
  const fy = []; for (let i = 0; i <= 24; i++) fy.push(9.0 + (NUT - 9.0) * (i / 24));
  add(G.neckG, loft(fy, (i) => { const w = neckW(fy[i]) / 2; const p = []; for (let k = 0; k <= 8; k++) { const t = -1 + k / 4; p.push([w * t, zt + 0.55 - 0.1 * t * t]); } p.push([w, zt], [-w, zt]); return p; }), M.board);
  for (let n = 1; n <= 21; n++) add(G.neckG, new BoxGeometry(neckW(fretY(n)), 0.24, 0.16), M.nickel, 0, fretY(n), zt + 0.54);
  const dots = [];
  [3, 5, 7, 9, 12, 15, 17, 19, 21].forEach((n) => { const y = (fretY(n) + fretY(n - 1)) / 2; (n === 12 ? [-1.15, 1.15] : [0]).forEach((x) => dots.push(add(G.neckG, cylZ(0.3, 0.03, 16), M.dot, x, y, zt + 0.545))); });
  add(G.neckG, new BoxGeometry(4.3, 0.42, 0.5), M.bone, 0, NUT + 0.2, zt + 0.5);
  const hs = new Shape(); hs.moveTo(-2.12, NUT - 0.4); hs.bezierCurveTo(-2.3, NUT + 2, -3.6, NUT + 2.6, -3.7, NUT + 5); hs.lineTo(-3.95, NUT + 15);
  hs.bezierCurveTo(-4, NUT + 18.4, -1, NUT + 19.6, 1.3, NUT + 18.6); hs.bezierCurveTo(3.2, NUT + 17.7, 3.4, NUT + 15.4, 2.6, NUT + 13.6);
  hs.bezierCurveTo(1.9, NUT + 12, 2.5, NUT + 9, 2.3, NUT + 5); hs.bezierCurveTo(2.2, NUT + 2.6, 2.12, NUT + 1.5, 2.12, NUT - 0.4);
  const hz = zt - 1.45;
  add(G.neckG, new ExtrudeGeometry(hs, { depth: 1.3, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 3, curveSegments: 24 }), M.maple, 0, 0, hz);
  const posts = [];
  for (let i = 0; i < 6; i++) { const x = -2.05 + i * 0.1, y = NUT + 3.4 + i * 2.5; posts.push(new Vector3(x, y, hz + 2.0));
    add(G.neckG, cylZ(0.3, 1.3, 14), M.chrome, x, y, hz + 1.85); add(G.neckG, cylZ(0.52, 0.16, 18), M.chrome, x, y, hz + 1.5);
    const k = add(G.neckG, new SphereGeometry(0.62, 14, 10), M.chrome, -5.0, y, hz - 0.5); k.scale.set(1, 0.7, 0.36);
    const sh = new CylinderGeometry(0.11, 0.11, 1.5, 8); sh.rotateZ(Math.PI / 2); add(G.neckG, sh, M.chrome, -4.2, y, hz - 0.5);
    add(G.neckG, new BoxGeometry(1.1, 1.5, 0.7), M.chrome, -2.9 + i * 0.05, y, hz - 0.45); }
  add(G.bodyG, plate(5, 6.2, 0.6, 0.18), M.chrome, 0, 12.4, -ZT - 0.2);

  /* strings */
  for (let i = 0; i < 6; i++) { const r = 0.075 - i * 0.009, xs = (i - 2.5) * 1.06, xn = (i - 2.5) * 0.7;
    const a = new Vector3(xs, SADDLE, ZT + 1.6), n = new Vector3(xn, NUT + 0.2, zt + 0.82);
    G.strG.add(between(a, n, r, M.string), between(n, posts[i], r, M.string), between(new Vector3(xs, -12.6, ZT + 0.45), a, r, M.string)); }

  /* explode vectors */
  const EX = { guardG: new Vector3(-3, 2, 9), hardG: new Vector3(4, -2, 15), neckG: new Vector3(0, 12, 5), strG: new Vector3(0, 0, 26) };
  const st = { x: 0, y: 0, s: 1, rx: 0, ry: 0, rz: 0, focus: 24, guard: 0, hard: 0, neck: 0, str: 0 };

  function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  resize(); addEventListener('resize', resize);

  return {
    state: st,
    viewW: () => 2 * 150 * Math.tan((14 * Math.PI) / 180) * cam.aspect,
    setFinish({ color, grain, rough = 0.42 }) { M.body.color.set(color); M.body.map = grain ? ash : null; M.body.roughness = rough; M.body.needsUpdate = true; },
    setGuard(id) { const t = id === 'tortoise'; M.guard.map = t ? tort : null; M.guard.color.set(t ? 0xffffff : id === 'parchment' ? 0xe6dfcb : 0x0b0b0b); M.guard.needsUpdate = true; },
    setBoard(id) { const r = id === 'rosewood'; M.board.map = r ? rose : fine; M.board.color.set(r ? 0x4a2a1c : 0xe9c47c); M.board.clearcoat = r ? 0.05 : 0.8; M.board.roughness = r ? 0.62 : 0.42; M.dot.color.set(r ? 0xe9e4d6 : 0x15120f); M.board.needsUpdate = true; },
    render() {
      root.position.set(st.x, st.y, 0); root.scale.setScalar(st.s); root.rotation.set(st.rx, st.ry, st.rz, 'ZXY'); model.position.y = -st.focus;
      G.guardG.position.copy(EX.guardG).multiplyScalar(st.guard); G.hardG.position.copy(EX.hardG).multiplyScalar(st.hard);
      G.neckG.position.copy(EX.neckG).multiplyScalar(st.neck); G.strG.position.copy(EX.strG).multiplyScalar(st.str);
      M.string.opacity = 1 - Math.min(1, st.str * 1.6); G.strG.visible = M.string.opacity > 0.02;
      renderer.render(scene, cam);
    },
  };
}
