import * as THREE from 'three';
import { CONFIG } from '../config.js';

const POST_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const POST_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uRes;
uniform float uTime;
uniform float uGrain;
uniform float uVignette;
uniform float uCA;
uniform float uSat;
uniform float uContrast;
uniform float uLevels;
uniform float uPS1;
uniform float uFlash;
uniform vec3 uTint;
varying vec2 vUv;

// hash12 (Dave Hoskins) – dobře funguje i pro celočíselné souřadnice
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int i = x + y * 4;
  float m[16];
  m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0;
  m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
  m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0;
  m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
  for (int k = 0; k < 16; k++) { if (k == i) return m[k] / 16.0; }
  return 0.0;
}

void main() {
  vec2 uv = vUv;
  vec2 d = uv - 0.5;
  vec2 off = d * uCA;
  vec3 col;
  col.r = texture2D(tDiffuse, uv + off).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - off).b;

  // lineární -> sRGB
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));

  // odsycení, kontrast, studený tón
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, uSat);
  col = (col - 0.5) * uContrast + 0.5;
  col *= uTint;

  // vinětace
  float v = smoothstep(0.82, 0.18, length(d * vec2(1.0, 0.92)));
  col *= mix(1.0, v, uVignette);

  // zrno (animované, po pixelech nízkého rozlišení)
  vec2 px = floor(uv * uRes);
  float n = hash(px + fract(floor(uTime * 24.0) * 0.1234) * 1000.0) - 0.5;
  col += n * uGrain * (0.6 + 0.8 * (1.0 - l));

  col += uFlash;

  // PS1: dithering + snížená barevná hloubka
  if (uPS1 > 0.5) {
    float b = (bayer4(px) - 0.5) * 0.6;
    col = floor(col * uLevels + 0.5 + b) / uLevels;
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// Renderuje scénu do malého render targetu a pak ho přes post-process shader roztáhne
// na canvas (canvas má CSS image-rendering: pixelated => upscale bez vyhlazení).
export class Renderer {
  constructor(canvas, { lowQuality = false } = {}) {
    this.canvas = canvas;
    this.lowQuality = lowQuality;
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.gl.setPixelRatio(1);
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.BasicShadowMap;
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.gl.toneMapping = THREE.NoToneMapping;

    this.target = new THREE.WebGLRenderTarget(4, 4, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      depthBuffer: true,
    });

    const p = CONFIG.post;
    this.postMaterial = new THREE.ShaderMaterial({
      vertexShader: POST_VERT,
      fragmentShader: POST_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: this.target.texture },
        uRes: { value: new THREE.Vector2(4, 4) },
        uTime: { value: 0 },
        uGrain: { value: p.grain },
        uVignette: { value: p.vignette },
        uCA: { value: p.chromaticAberration },
        uSat: { value: p.saturation },
        uContrast: { value: p.contrast },
        uLevels: { value: p.colorLevels },
        uPS1: { value: 1 },
        uFlash: { value: 0 },
        uTint: { value: new THREE.Vector3(...p.tint) },
      },
    });
    // jeden přes celou obrazovku přesahující trojúhelník
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.postScene = new THREE.Scene();
    const quad = new THREE.Mesh(tri, this.postMaterial);
    quad.frustumCulled = false;
    this.postScene.add(quad);
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.width = 4;
    this.height = 4;
  }

  setPS1(on) {
    this.postMaterial.uniforms.uPS1.value = on ? 1 : 0;
  }

  resize(camera) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const base = CONFIG.render.baseHeight;
    const scale = Math.min(w, h) / base;
    this.width = Math.max(64, Math.round(w / scale));
    this.height = Math.max(64, Math.round(h / scale));
    this.gl.setSize(this.width, this.height, false);
    this.target.setSize(this.width, this.height);
    this.postMaterial.uniforms.uRes.value.set(this.width, this.height);
    if (camera) {
      camera.aspect = this.width / this.height;
      camera.updateProjectionMatrix();
    }
  }

  render(scene, camera, time) {
    this.postMaterial.uniforms.uTime.value = time;
    this.gl.setRenderTarget(this.target);
    this.gl.render(scene, camera);
    this.gl.setRenderTarget(null);
    this.gl.render(this.postScene, this.postCamera);
  }
}
