import * as T from 'three';
import type { PlayerAppearance } from './appearance';
import { avatarQualityProfile, type AvatarVisualQuality } from './avatarVisualQuality';

type FaceShape = NonNullable<PlayerAppearance['head']['faceShape']>;
type SkinDetail = NonNullable<PlayerAppearance['head']['skinDetail']>;
type EyebrowStyle = NonNullable<PlayerAppearance['head']['eyebrowStyle']>;

const FACE_SCALE: Record<FaceShape, [number, number, number]> = {
  classic: [1, 1, 1],
  oval: [.975, 1.025, .99],
  angular: [1.018, .995, .98],
  soft: [1.025, 1.005, 1.025],
  wide: [1.045, .99, 1.012],
};

export function skinRoughness(appearance: PlayerAppearance) {
  const detail = appearance.head.skinDetail ?? 'smooth';
  if (detail === 'smooth') return .61;
  if (detail === 'weathered') return .78;
  return .69;
}

function faceBounds(root: T.Object3D) {
  root.updateMatrixWorld(true);
  const bounds = new T.Box3();
  root.traverse(node => {
    if (!(node instanceof T.SkinnedMesh)) return;
    let parent: T.Object3D | null = node;
    while (parent && !/_Head(?:_|$)/i.test(parent.name)) parent = parent.parent;
    if (!parent) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (!materials.some(material => /skin/i.test(material.name))) return;
    node.skeleton.update();
    for (let index = 0; index < node.geometry.attributes.position.count; index++) {
      bounds.expandByPoint(node.getVertexPosition(index, new T.Vector3()).applyMatrix4(node.matrixWorld));
    }
  });
  return bounds;
}

function detailMaterial(color: T.Color, opacity: number, quality: AvatarVisualQuality) {
  if (quality === 'crowd') {
    return new T.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      toneMapped: true,
    });
  }
  return new T.MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    roughness: quality === 'ultra' ? .72 : .78,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    toneMapped: true,
  });
}

function addFaceMark(group: T.Group, name: string, position: T.Vector3, radius: number, material: T.Material, segments: number) {
  const mesh = new T.Mesh(new T.CircleGeometry(radius, segments), material);
  mesh.name = name;
  mesh.position.copy(position);
  group.add(mesh);
  return mesh;
}

function browCurve(style: EyebrowStyle, center: T.Vector3, width: number, side: -1 | 1) {
  const half = width * .115;
  const x = center.x + side * width * .18;
  const lift = style === 'arched' ? width * .035 : style === 'soft' ? width * .018 : style === 'straight' ? 0 : width * .012;
  const tilt = style === 'straight' ? 0 : side * width * .006;
  return new T.CatmullRomCurve3([
    new T.Vector3(x - half, center.y - tilt, center.z),
    new T.Vector3(x, center.y + lift, center.z),
    new T.Vector3(x + half, center.y + tilt, center.z),
  ]);
}

/**
 * Adds lightweight, rig-attached face detail without introducing a second avatar
 * skeleton. The Head bone remains authoritative, so the same details follow
 * creator previews, gigs and Top of the Pops performance animation.
 */
export function addFaceDetails(
  root: T.Object3D,
  appearance: PlayerAppearance,
  head: T.Bone,
  quality: AvatarVisualQuality = 'balanced',
) {
  const profile = avatarQualityProfile(quality);
  const faceShape = appearance.head.faceShape ?? 'classic';
  const scale = FACE_SCALE[faceShape];
  head.scale.multiply(new T.Vector3(...scale));
  head.userData.avatarFaceShape = faceShape;
  root.updateMatrixWorld(true);

  const bounds = faceBounds(root);
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new T.Vector3());
  const size = bounds.getSize(new T.Vector3());
  const front = bounds.max.z + Math.max(.0015, size.z * .006);
  const group = new T.Group();
  group.name = 'avatar-face-details';
  group.userData.faceShape = faceShape;
  group.userData.eyeColor = appearance.head.eyeColor ?? '#65442d';
  group.userData.eyebrowStyle = appearance.head.eyebrowStyle ?? 'natural';
  group.userData.skinDetail = appearance.head.skinDetail ?? 'smooth';

  const local = (world: T.Vector3) => root.worldToLocal(world.clone());
  const browStyle = appearance.head.eyebrowStyle ?? 'natural';
  if (browStyle !== 'natural') {
    const browColor = new T.Color(appearance.head.eyebrowColor ?? appearance.head.hair);
    const material = detailMaterial(browColor, browStyle === 'soft' ? .58 : .9, quality);
    const browY = center.y + size.y * .145;
    const radius = size.x * (browStyle === 'bold' ? .012 : .008);
    for (const side of [-1, 1] as const) {
      const curveCenter = local(new T.Vector3(center.x, browY, front + size.z * .002));
      const curve = browCurve(browStyle, curveCenter, size.x, side);
      const brow = new T.Mesh(new T.TubeGeometry(curve, profile.faceCurveSegments, radius, Math.max(5, Math.floor(profile.faceCurveSegments / 2)), false), material.clone());
      brow.name = `avatar-eyebrow-${side < 0 ? 'left' : 'right'}`;
      group.add(brow);
    }
  }

  const skinDetail = appearance.head.skinDetail ?? 'smooth';
  const skin = new T.Color(appearance.body.skin);
  const mark = skin.clone().multiplyScalar(skinDetail === 'weathered' ? .54 : .62);
  const cheekY = center.y - size.y * .02;
  if (skinDetail === 'freckles') {
    const material = detailMaterial(mark, .45, quality);
    const positions = [
      [-.23, .005], [-.18, -.012], [-.13, .016], [-.08, -.006], [-.035, .01],
      [.035, .012], [.08, -.008], [.13, .017], [.18, -.01], [.23, .006],
      [-.16, -.045], [-.09, -.052], [.09, -.05], [.16, -.043],
    ] as const;
    positions.forEach(([x, y], index) => addFaceMark(
      group,
      `avatar-freckle-${index}`,
      local(new T.Vector3(center.x + size.x * x, cheekY + size.y * y, front + size.z * .003)),
      size.x * (.006 + (index % 3) * .0015),
      material,
      profile.faceCurveSegments,
    ));
  } else if (skinDetail === 'beauty_marks') {
    const material = detailMaterial(mark.clone().multiplyScalar(.78), .72, quality);
    addFaceMark(group, 'avatar-beauty-mark-left', local(new T.Vector3(center.x - size.x * .18, cheekY - size.y * .055, front + size.z * .003)), size.x * .009, material, profile.faceCurveSegments);
    addFaceMark(group, 'avatar-beauty-mark-right', local(new T.Vector3(center.x + size.x * .14, cheekY + size.y * .018, front + size.z * .003)), size.x * .0065, material.clone(), profile.faceCurveSegments);
  } else if (skinDetail === 'weathered') {
    const material = detailMaterial(mark, .24, quality);
    for (const side of [-1, 1] as const) {
      for (let row = 0; row < 2; row++) {
        const y = center.y + size.y * (.025 - row * .027);
        const x = center.x + side * size.x * .17;
        const z = front + size.z * .0025;
        const curve = new T.CatmullRomCurve3([
          local(new T.Vector3(x - side * size.x * .065, y, z)),
          local(new T.Vector3(x, y - size.y * .008, z)),
          local(new T.Vector3(x + side * size.x * .055, y + size.y * .002, z)),
        ]);
        const line = new T.Mesh(new T.TubeGeometry(curve, profile.faceCurveSegments, size.x * .0033, Math.max(4, Math.floor(profile.faceCurveSegments / 3)), false), material.clone());
        line.name = `avatar-weather-line-${side < 0 ? 'left' : 'right'}-${row}`;
        group.add(line);
      }
    }
  }

  root.add(group);
  root.updateMatrixWorld(true);
  head.attach(group);
  root.updateMatrixWorld(true);
}
