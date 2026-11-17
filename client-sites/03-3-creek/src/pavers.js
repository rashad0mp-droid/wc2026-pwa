// A field of pavers that starts life as a measured drawing and is laid for real.
// One InstancedMesh, one small shader: "drawn" (ink on paper) and "built" (lit stone)
// are blended along a sweep line so the drawing turns into a driveway.
import { SRGBColorSpace, WebGLRenderer, Scene, PerspectiveCamera, InstancedMesh, BoxGeometry, PlaneGeometry, Mesh, ShaderMaterial, InstancedBufferAttribute, Object3D, Vector2, Vector3, Color, Raycaster, Plane } from 'three';

const R = 24; // field radius in paver widths (one paver is 2 x 1)
const PAPER = [0.937, 0.914, 0.867];

export const BLENDS = {
  'Charleston Pearl': { tones: ['#dcd8cf', '#c9c4b9', '#b8b2a6', '#e8e5dd'], sand: '#8f897c' },
  'King St.': { tones: ['#a4533a', '#8f4530', '#b56447', '#7c3a2a'], sand: '#6f5a4c' },
  'River Run': { tones: ['#8d979c', '#7a858b', '#a3abae', '#69747a'], sand: '#565d60' },
  'Earthen Moon': { tones: ['#c9ad88', '#b89a74', '#d6bd9c', '#a98a66'], sand: '#8a775d' },
  'Downtown Alley': { tones: ['#515455', '#434647', '#5f6263', '#393b3c'], sand: '#2c2e2f' },
};

// each layout returns [{x, z, rot}] with x,z the paver centre and rot 0 (long side on x) or 1 (long side on z)
export const PATTERNS = {
  'Herringbone': (push) => { for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) { const d = (((x - y) % 4) + 4) % 4; if (d === 0) push(x + 1, y + 0.5, 0); else if (d === 3) push(x + 0.5, y + 1, 1); } },
  'Running bond': (push) => { for (let y = -R; y <= R; y++) for (let x = -R - 1; x <= R; x += 2) push(x + 1 + (y & 1), y + 0.5, 0); },
  'Basketweave': (push) => { for (let y = -R; y <= R; y += 2) for (let x = -R; x <= R; x += 2) { if ((((x + y) / 2) & 1) === 0) { push(x + 1, y + 0.5, 0); push(x + 1, y + 1.5, 0); } else { push(x + 0.5, y + 1, 1); push(x + 1.5, y + 1, 1); } } },
  'Stack bond': (push) => { for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x += 2) push(x + 1, y + 0.5, 0); },
};

const glslNoise = `
float hash(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y); }`;

const vert = `
attribute vec3 aColor; attribute float aDelay;
uniform float uIn, uLift; uniform vec2 uPointer;
varying vec3 vColor, vN, vW; varying vec2 vUv;
void main(){
  float t=clamp(uIn*2.3-aDelay*1.3,0.,1.); float e=1.-pow(1.-t,3.);
  mat4 m=modelMatrix*instanceMatrix;
  vec4 wp=m*vec4(position*mix(.001,1.,e),1.);
  vec3 c=(m*vec4(0.,0.,0.,1.)).xyz;
  float d=distance(c.xz,uPointer);
  wp.y+=(1.-e)*3.2+uLift*.6*exp(-d*d/13.);
  vColor=aColor; vUv=uv; vW=wp.xyz; vN=normalize(mat3(m)*normal);
  gl_Position=projectionMatrix*viewMatrix*wp;
}`;

const frag = `
precision highp float;
uniform vec3 uPaper, uInk; uniform float uEdge, uR; uniform vec2 uDir;
varying vec3 vColor, vN, vW; varying vec2 vUv;
${glslNoise}
void main(){
  float top=step(.5,vN.y);
  vec2 sz=vec2(1.9,.9); vec2 q=vUv*sz; float ed=min(min(q.x,sz.x-q.x),min(q.y,sz.y-q.y));
  // built: tumbled stone under low sun
  float n=hash(floor(vW.xz*26.)), n2=noise(vW.xz*2.4+7.);
  vec3 base=vColor*(.92+.11*n)*(.93+.12*n2);
  vec3 L=normalize(vec3(-.55,.72,.42));
  float ndl=max(dot(vN,L),0.);
  vec3 built=base*(.56+.60*ndl)*mix(vec3(1.),vec3(1.04,1.,.95),top);
  built*=.93+.14*smoothstep(-20.,20.,vW.x-vW.z);
  built*=1.-.34*(1.-smoothstep(0.,.085,ed))*top;
  // drawn: ink line on paper
  float line=(1.-smoothstep(.022,.05,ed))*top;
  vec3 drawn=mix(uPaper*1.035,uInk,line*.8);
  drawn=mix(drawn,uPaper*.9,1.-top);
  float s=dot(vW.xz,uDir);
  float b=smoothstep(uEdge+1.6,uEdge-1.6,s);
  vec3 col=mix(drawn,built,b);
  float r=length(vW.xz);
  col=mix(uPaper,col,smoothstep(uR,uR*.72,r));
  gl_FragColor=vec4(col,1.);
}`;

const groundFrag = `
precision highp float;
uniform vec3 uPaper, uSand; uniform float uEdge, uR; uniform vec2 uDir; varying vec3 vW;
void main(){
  float s=dot(vW.xz,uDir); float b=smoothstep(uEdge+1.6,uEdge-1.6,s);
  vec3 col=mix(uPaper*1.035,uSand,b);
  col=mix(uPaper,col,smoothstep(uR,uR*.72,length(vW.xz)));
  gl_FragColor=vec4(col,1.);
}`;

export function createField(canvas) {
  let renderer;
  try { renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(new Color().setRGB(PAPER[0], PAPER[1], PAPER[2], SRGBColorSpace), 1);

  const scene = new Scene(); const cam = new PerspectiveCamera(30, 1, 1, 400);
  const U = {
    uIn: { value: 0 }, uLift: { value: 0 }, uPointer: { value: new Vector2(999, 999) }, uPaper: { value: new Vector3(...PAPER) }, uInk: { value: new Vector3(0.14, 0.19, 0.18) },
    uSand: { value: new Vector3(0.5, 0.48, 0.44) }, uEdge: { value: -40 }, uR: { value: R - 1 }, uDir: { value: new Vector2(0.86, -0.5) },
  };
  const MAX = 3200;
  const geo = new BoxGeometry(1.9, 0.5, 0.9);
  const aColor = new InstancedBufferAttribute(new Float32Array(MAX * 3), 3), aDelay = new InstancedBufferAttribute(new Float32Array(MAX), 1);
  geo.setAttribute('aColor', aColor); geo.setAttribute('aDelay', aDelay);
  const mesh = new InstancedMesh(geo, new ShaderMaterial({ uniforms: U, vertexShader: vert, fragmentShader: frag }), MAX);
  mesh.frustumCulled = false; scene.add(mesh);
  const gg = new PlaneGeometry(R * 2.4, R * 2.4); gg.rotateX(-Math.PI / 2);
  const ground = new Mesh(gg, new ShaderMaterial({ uniforms: U, vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }', fragmentShader: groundFrag }));
  ground.position.y = -0.26; scene.add(ground);

  const dummy = new Object3D(), col = new Color();
  let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  function lay(pattern, blend, origin) {
    const B = BLENDS[blend], list = []; seed = 7;
    PATTERNS[pattern]((x, z, rot) => { if (x * x + z * z < R * R) list.push([x, z, rot]); });
    const n = Math.min(list.length, MAX), ox = origin ? origin.x : 0, oz = origin ? origin.y : 0;
    for (let i = 0; i < n; i++) {
      const [x, z, rot] = list[i];
      dummy.position.set(x, 0, z); dummy.rotation.set(0, rot ? Math.PI / 2 : 0, 0); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      const t = B.tones[Math.floor(rnd() * rnd() * B.tones.length * 1.6) % B.tones.length]; col.set(t);
      // write display-referred colour straight through, the shader does no colour management
      const h = parseInt(t.slice(1), 16); aColor.setXYZ(i, ((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);
      aDelay.setX(i, Math.min(1, Math.hypot(x - ox, z - oz) / (R * 1.5)) + rnd() * 0.06);
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true; aColor.needsUpdate = true; aDelay.needsUpdate = true;
    const s = parseInt(B.sand.slice(1), 16); U.uSand.value.set(((s >> 16) & 255) / 255, ((s >> 8) & 255) / 255, (s & 255) / 255);
  }

  function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  resize(); addEventListener('resize', resize);

  const ray = new Raycaster(), plane = new Plane(new Vector3(0, 1, 0), 0), hit = new Vector3(), ndc = new Vector2();
  return {
    U, R, lay,
    setRotation(a) { mesh.rotation.y = a; },
    // camera on a sphere around a target: phi 0 = straight down (plan), theta = azimuth
    setCamera({ tx, tz, d, phi, theta }) {
      cam.position.set(tx + d * Math.sin(phi) * Math.sin(theta), d * Math.cos(phi), tz + d * Math.sin(phi) * Math.cos(theta));
      cam.up.set(0, 1, 0); if (phi < 0.02) cam.up.set(-Math.sin(theta), 0, -Math.cos(theta));
      cam.lookAt(tx, 0, tz);
    },
    pointer(x, y) { ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam); if (ray.ray.intersectPlane(plane, hit)) U.uPointer.value.set(hit.x, hit.z); return hit; },
    render() { renderer.render(scene, cam); },
  };
}
