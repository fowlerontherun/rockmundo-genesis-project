import * as T from 'three';

export const RIPPED_SKINNY_JEANS = 'starter.bottom.black-ripped-skinny-jeans';

/** Called in the common Y-up bind frame. Keep the original skin weights and
 * leg centres: scaling the whole pelvis squeezes the legs together. */
export function fitRippedSkinnyJeans(mesh: T.SkinnedMesh, donorFrame: T.Matrix4) {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  const joints = (side: string) => ['UpperLeg', 'LowerLeg', 'Foot'].map(name => {
    const index = mesh.skeleton.bones.findIndex(b => b.name.replace(/[_.]/g, '').toLowerCase() === `${name}${side}`.toLowerCase());
    if (index < 0) throw new Error(`Missing jeans fit joint: ${name}.${side}`);
    return new T.Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[index].clone().invert())
      .applyMatrix4(mesh.bindMatrixInverse).applyMatrix4(donorFrame);
  });
  const legs = [joints('L'), joints('R')];
  const coordinates = new Float32Array(position.count * 3);
  const point = new T.Vector3();
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i);
    const [hip, knee, ankle] = legs.reduce((a, b) => Math.abs(point.x - a[1].x) < Math.abs(point.x - b[1].x) ? a : b);
    const length = hip.y - ankle.y;
    const lower = point.y < knee.y;
    const start = lower ? ankle : knee, end = lower ? knee : hip;
    const t = T.MathUtils.clamp((point.y - start.y) / (end.y - start.y), 0, 1);
    const centre = start.clone().lerp(end, t);
    // Preserve waist/crotch and ankle joins; taper each leg around its own rig.
    const waistFade = 1 - T.MathUtils.smoothstep(point.y, knee.y + length * .16, hip.y - length * .04);
    const ankleFade = T.MathUtils.smoothstep(point.y, ankle.y, ankle.y + length * .12);
    const scale = 1 - .10 * waistFade * ankleFade;
    point.x = centre.x + (point.x - centre.x) * scale;
    point.z = centre.z + (point.z - centre.z) * scale;
    position.setXYZ(i, point.x, point.y, point.z);
    // Bind-space coordinates interpolate with the skinned surface, preventing
    // the knee details from sliding during walking or stage animations.
    coordinates.set([(point.x - knee.x) / length, (point.y - knee.y) / length, (point.z - knee.z) / length], i * 3);
  }
  geometry.setAttribute('rippedDenimPosition', new T.BufferAttribute(coordinates, 3));
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.userData.avatarV1RippedSkinnyJeans = true;
}

/** Surface inset depicts exposed skin under frayed threads without cutting
 * holes through the donor's only leg surface. Skin tone follows the avatar. */
export function applyRippedDenimMaterial(material: T.MeshStandardMaterial, skin: string) {
  material.normalScale.set(.72, .72);
  material.roughness = .96;
  material.userData.rippedDenimSkin = skin;
  material.customProgramCacheKey = () => 'v1-ripped-skinny-denim-1';
  material.onBeforeCompile = shader => {
    shader.uniforms.rippedDenimSkin = { value: new T.Color(skin) };
    shader.vertexShader = 'attribute vec3 rippedDenimPosition;\nvarying vec3 vRippedDenim;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRippedDenim = rippedDenimPosition;');
    shader.fragmentShader = 'varying vec3 vRippedDenim;\nuniform vec3 rippedDenimSkin;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 p = vRippedDenim;
      float jagged = sin(p.x * 740.0) * .0018 + sin(p.x * 317.0) * .002;
      float edge = abs(p.y + sin(p.x * 36.0) * .004) + jagged;
      float front = smoothstep(.025, .065, p.z);
      float width = 1.0 - smoothstep(.065, .086, abs(p.x));
      float opening = (1.0 - smoothstep(.019, .025, edge)) * width * front;
      float fray = (1.0 - smoothstep(.025, .037, edge)) * width * front;
      float thread = pow(.5 + .5 * sin(p.y * 2000.0 + sin(p.x * 220.0)), 24.0);
      float skinMask = opening * (1.0 - thread * .85);
      // Faded knee whiskers and grey loose fibres remain readable on black.
      diffuseColor.rgb *= 1.0 + .3 * exp(-abs(p.y) * 13.0) * front;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.19), fray * (1.0 - opening) * .7);
      diffuseColor.rgb = mix(diffuseColor.rgb, rippedDenimSkin * .82, skinMask);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.28), opening * thread * .8);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .72, skinMask);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, skinMask));');
  };
  material.needsUpdate = true;
}
