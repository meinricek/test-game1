import { CONFIG } from '../config.js';

// Sdílené uniformy pro všechny "PS1" materiály – přepínají se za běhu bez rekompilace shaderů.
export const ps1Uniforms = {
  uPS1Snap: { value: [CONFIG.render.snapResolution[0] / 2, CONFIG.render.snapResolution[1] / 2, 1] },
  uPS1Affine: { value: 1 },
};

export function setPS1Enabled(on) {
  ps1Uniforms.uPS1Snap.value[2] = on ? 1 : 0;
  ps1Uniforms.uPS1Affine.value = on ? 1 : 0;
}

/**
 * Upraví vestavěný materiál Three.js:
 *  - vertex snapping: vrcholy se přichytí k hrubé mřížce v clip space (typický PS1 "třes")
 *  - affine texture mapping: UV se interpolují bez perspektivní korekce (uv*w / w trik)
 */
export function applyPS1(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPS1Snap = ps1Uniforms.uPS1Snap;
    shader.uniforms.uPS1Affine = ps1Uniforms.uPS1Affine;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uPS1Snap;
varying vec3 vAffineUv;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
{
  vec4 ps1p = gl_Position;
  if (ps1p.w > 0.0) {
    ps1p.xyz /= ps1p.w;
    ps1p.xy = floor(ps1p.xy * uPS1Snap.xy + 0.5) / uPS1Snap.xy;
    ps1p.xyz *= ps1p.w;
  }
  gl_Position = mix(gl_Position, ps1p, uPS1Snap.z);
}
#ifdef USE_MAP
  vAffineUv = vec3(vMapUv * gl_Position.w, gl_Position.w);
#else
  vAffineUv = vec3(0.0, 0.0, 1.0);
#endif`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uPS1Affine;
varying vec3 vAffineUv;`,
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
  vec2 ps1Uv = mix(vMapUv, vAffineUv.xy / vAffineUv.z, uPS1Affine);
  diffuseColor *= texture2D(map, ps1Uv);
#endif`,
      );
  };
  material.customProgramCacheKey = () => 'ps1';
  return material;
}
