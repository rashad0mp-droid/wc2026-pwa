// Real-time dusk over the Intracoastal. One full-screen fragment shader:
// analytic water plane + procedural sky, sun, skyline and a distant yacht.
// uDay runs 0 (golden hour) -> 0.5 (sunset) -> 1 (night).
import { WebGLRenderer, Scene, OrthographicCamera, PlaneGeometry, Mesh, ShaderMaterial, Vector2 } from 'three';

const frag = /* glsl */`
precision highp float;
uniform vec2 uRes; uniform float uT; uniform float uDay; uniform float uYaz; uniform vec2 uLook;

float hash(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.03+vec2(17.3,9.1); a*=.5; } return s; }
vec3 k3(vec3 a,vec3 b,vec3 c,float d){ return d<.5 ? mix(a,b,smoothstep(0.,1.,d*2.)) : mix(b,c,smoothstep(0.,1.,(d-.5)*2.)); }

vec3 sunDir, cZen, cHor, cSun, cCloudLit, cCloudDark; float sunUp, nightF, lightF, glowF;

void setup(float d){
  float sy = .17 - .34*d;
  sunDir = normalize(vec3(.34, sy, -1.));
  cZen = k3(vec3(.16,.37,.66), vec3(.17,.17,.42), vec3(.010,.022,.058), d);
  cHor = k3(vec3(1.10,.74,.42), vec3(1.15,.44,.20), vec3(.040,.075,.150), d);
  cSun = k3(vec3(1.,.80,.50), vec3(1.,.42,.16), vec3(.10,.12,.2), d);
  cCloudLit = k3(vec3(1.05,.86,.68), vec3(1.05,.48,.36), vec3(.06,.08,.14), d);
  cCloudDark = k3(vec3(.62,.50,.52), vec3(.30,.19,.36), vec3(.018,.028,.06), d);
  sunUp = smoothstep(-.05,.03,sy);
  nightF = smoothstep(.62,1.,d);
  lightF = smoothstep(.36,.70,d);
  glowF = smoothstep(.25,.55,d)*(1.-smoothstep(.60,.90,d));
}

float tier(float x,float x0,float x1,float x2,float h){ return h*smoothstep(x0-.02,x0+.015,x)*(1.-smoothstep(x1,x2,x)); }

// distant event yacht on the horizon. q.x: stern -1 .. bow 1, q.y: height
vec4 yacht(vec2 q){
  float x=q.x,y=q.y;
  float hull=(.165+.035*smoothstep(.3,1.,x))*smoothstep(-.99,-.955,x)*(1.-smoothstep(.985,1.,x));
  float H=hull;
  H=max(H,tier(x,-.86,.44,.58,.305));
  H=max(H,tier(x,-.62,.16,.30,.425));
  H=max(H,tier(x,-.36,-.06,.02,.505));
  H=max(H,.70*(1.-smoothstep(.006,.012,abs(x+.17))));
  float low=max(0.,(x-.80)/1.15);
  float aa=.012;
  float m=smoothstep(H+aa,H-aa,y)*smoothstep(low-aa,low+aa,y)*step(0.,y);
  // window bands
  float w1=step(.205,y)*step(y,.268)*step(-.80,x)*step(x,.40);
  float w2=step(.335,y)*step(y,.392)*step(-.56,x)*step(x,.13);
  float w3=step(.445,y)*step(y,.482)*step(-.32,x)*step(x,-.07);
  float glass=max(max(w1,w2),w3);
  float pane=step(fract(x*17.),.74);
  // string lights, stern rail up to the mast and down to the bow
  float t1=clamp((x+.9)/.73,0.,1.), y1=mix(.33,.69,t1);
  float t2=clamp((x+.17)/1.1,0.,1.), y2=mix(.69,.25,t2)-.05*sin(t2*3.1416);
  float yl=x<-.17?y1:y2;
  float bulbs=smoothstep(.022,.004,abs(y-yl))*smoothstep(.5,.2,abs(fract(x*13.)-.5))*step(-.9,x)*step(x,.93);
  return vec4(m,glass*pane,bulbs,glass);
}

vec3 sky(vec3 rd){
  float h=max(rd.y,0.);
  vec3 col=mix(cHor,cZen,1.-exp(-h*4.2));
  float sd=max(dot(rd,sunDir),0.);
  col+=cSun*(pow(sd,6.)*.50+pow(sd,60.)*.75+pow(sd,700.)*2.2)*mix(.22,1.,sunUp)*(1.-.92*nightF);
  col+=vec3(1.,.93,.72)*smoothstep(.99968,.99984,sd)*9.*sunUp;
  // afterglow hugging the horizon once the sun is gone
  float az=atan(rd.x,-rd.z);
  float saz=atan(sunDir.x,-sunDir.z);
  col+=vec3(1.,.38,.16)*exp(-h*9.)*exp(-pow((az-saz)*1.5,2.))*glowF*.75;
  // clouds
  vec2 cp=rd.xz/(rd.y+.14)*1.05+vec2(uT*.006,0.);
  float c=smoothstep(.56,.92,fbm(cp*vec2(.42,1.5)+3.7));
  c*=smoothstep(.015,.22,rd.y);
  float lit=pow(sd,2.2)*.85+.15;
  col=mix(col,mix(cCloudDark,cCloudLit,lit),c*.5);
  // stars
  vec2 sp=vec2(atan(rd.x,-rd.z),rd.y)*78.; vec2 si=floor(sp); float sr=hash(si);
  vec2 so=vec2(hash(si+3.1),hash(si+7.7))*.6-.3;
  float star=step(.90,sr)*smoothstep(.11*(.5+sr*.6),0.,length(fract(sp)-.5-so))*(.65+.35*sin(uT*1.6+sr*90.));
  col+=vec3(.86,.92,1.)*star*nightF*smoothstep(.05,.22,rd.y)*(1.-c)*1.9;

  // shoreline: condo towers left and right of the channel
  float m=smoothstep(-.33,-.43,az)+smoothstep(.53,.61,az);
  float n=floor(az*64.); float r=hash(vec2(n,3.));
  float bh=.0045+.003*noise(vec2(az*260.,1.))+step(.52,r)*(.007+.036*hash(vec2(n,9.)))*smoothstep(.02,.1,abs(fract(az*64.)-.5)+.06);
  bh*=m;
  float b=smoothstep(bh+.0012,bh-.0012,rd.y)*step(.0001,m);
  vec3 bc=mix(cHor*.42,vec3(.03,.05,.09),.35+.65*lightF);
  vec2 cell=floor(vec2(az*560.,rd.y*560.));
  float won=step(.80,hash(cell))*step(.004,rd.y);
  bc+=mix(vec3(1.,.74,.42),vec3(.7,.86,1.),step(.82,hash(cell+7.)))*won*lightF*.95;
  col=mix(col,bc,b);

  // the yacht
  vec2 q=vec2(-(az-uYaz)/.082,rd.y/.082);
  if(abs(q.x)<1.05&&q.y<.75){
    vec4 Y=yacht(q);
    vec3 yc=mix(vec3(.97,.93,.86)*mix(cSun,vec3(1.),.45),vec3(.035,.05,.08),smoothstep(.3,.75,uDay));
    yc=mix(yc,yc*vec3(.15,.2,.27),Y.w*.9);
    yc+=vec3(1.,.72,.36)*Y.y*lightF*1.5;
    col=mix(col,yc,Y.x);
    col+=vec3(1.,.8,.5)*Y.z*lightF*1.8;
  }
  return col;
}

float wave(vec2 p){
  float t=uT*.55; float s=0.;
  s+=(noise(p*.38+vec2(t*.22,t*.10))-.5)*1.15;
  s+=(noise(p*.92+vec2(-t*.27,t*.20))-.5)*.60;
  s+=(noise(p*2.3+vec2(t*.45,-t*.32))-.5)*.30;
  s+=(noise(p*5.3-vec2(t*.62,t*.38))-.5)*.14;
  s+=(noise(p*11.7+vec2(t*.9,-t*.7))-.5)*.06;
  return s;
}

void main(){
  setup(uDay);
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  float pitch=.052+.07*smoothstep(.55,1.,uDay)+uLook.y; float yaw=uLook.x;
  vec3 rd=normalize(vec3(uv,-1.12));
  float cp=cos(pitch),sp=sin(pitch); rd=vec3(rd.x,rd.y*cp-rd.z*sp*-1.,rd.z*cp+rd.y*sp*-1.);
  float cy=cos(yaw),sy=sin(yaw); rd=vec3(rd.x*cy-rd.z*sy,rd.y,rd.z*cy+rd.x*sy);

  vec3 col;
  vec3 skyc=sky(vec3(rd.x,max(rd.y,.0004),rd.z));
  if(rd.y<0.){
    float t=1.15/-rd.y; vec2 p=rd.xz*t+vec2(0.,-uT*.35);
    float e=.03+t*.006;
    float amp=.52*mix(1.,.34,smoothstep(2.,60.,t));
    float h0=wave(p),hx=wave(p+vec2(e,0.)),hz=wave(p+vec2(0.,e));
    vec3 n=normalize(vec3(-(hx-h0)/e*amp,1.,-(hz-h0)/e*amp));
    vec3 rf=reflect(rd,n); rf.y=abs(rf.y)+.002; rf=normalize(rf);
    float fres=.035+.965*pow(1.-max(dot(-rd,n),0.),5.);
    vec3 deep=k3(vec3(.035,.20,.25),vec3(.035,.09,.16),vec3(.006,.016,.040),uDay);
    vec3 rc=sky(rf);
    col=mix(deep,rc,fres);
    float sd=max(dot(rf,sunDir),0.);
    col+=cSun*pow(sd,48.)*.55*sunUp;
    float f=exp(rd.y*26.);
    col=mix(col,mix(cHor,skyc,.5)*.92,f*.62);
    col=mix(col,skyc,smoothstep(-.0016,0.,rd.y));
  } else col=skyc;

  float L=max(col.r,max(col.g,col.b))+1e-4;
  col*=(1.-exp(-L*1.3))/L;
  col=mix(col,vec3(dot(col,vec3(.3,.59,.11))),-.08);
  col*=1.-.42*dot(uv,uv);
  col+=(hash(gl_FragCoord.xy+fract(uT)*91.)-.5)*.022;
  gl_FragColor=vec4(col,1.);
}`;

export function createSea(canvas) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return null; }

  const uniforms = { uRes: { value: new Vector2() }, uT: { value: 0 }, uDay: { value: 0 }, uYaz: { value: 0.73 }, uLook: { value: new Vector2() } };
  const scene = new Scene();
  const cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({ uniforms, fragmentShader: frag, vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}', depthTest: false })));

  let quality = Math.min(window.devicePixelRatio || 1, 1.5);
  if (window.innerWidth < 720) quality = Math.min(quality, 1.25);
  function resize() {
    renderer.setPixelRatio(quality);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.getDrawingBufferSize(uniforms.uRes.value);
  }
  resize();
  window.addEventListener('resize', resize);

  // drop resolution if the device can't hold ~40fps
  let slow = 0, frames = 0;
  function tune(dt) {
    frames++;
    if (frames < 20) return;
    slow = dt > 30 ? slow + 1 : Math.max(0, slow - 1);
    if (slow > 24 && quality > 0.6) { quality = Math.max(0.6, quality * 0.8); slow = 0; resize(); }
  }

  return {
    uniforms,
    render(time, dt) { uniforms.uT.value = time; renderer.render(scene, cam); tune(dt); },
    ok() { const gl = renderer.getContext(); return gl && !gl.isContextLost(); },
  };
}
