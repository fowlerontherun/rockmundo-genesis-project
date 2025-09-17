import { useEffect, useRef } from "react";

import type {
  AvatarCameraDefinition,
  AvatarPoseDefinition,
  AvatarStyleDefinition,
} from "@/data/avatarPresets";
import { cn } from "@/lib/utils";

type Vec3 = [number, number, number];
type Vec2 = [number, number];

type Face = [number, number, number];

type Geometry = {
  vertices: Vec3[];
  faces: Face[];
};

type MeshDefinition = {
  geometry: Geometry;
  color: Vec3;
  emissive: Vec3;
  scale: Vec3;
  rotation: Vec3;
  translation: Vec3;
  roughness: number;
  metalness: number;
  attachToHead?: boolean;
};

type AvatarMeshes = {
  body: MeshDefinition;
  head: MeshDefinition;
  accessory?: MeshDefinition;
  floor: MeshDefinition;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scaleVec = (v: Vec3, s: Vec3): Vec3 => [v[0] * s[0], v[1] * s[1], v[2] * s[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
const normalize = (v: Vec3): Vec3 => {
  const len = length(v);
  if (len === 0) {
    return [0, 0, 0];
  }
  return [v[0] / len, v[1] / len, v[2] / len];
};

const rotatePoint = (point: Vec3, rotation: Vec3): Vec3 => {
  let [x, y, z] = point;
  const [rx, ry, rz] = rotation;

  if (rx !== 0) {
    const cos = Math.cos(rx);
    const sin = Math.sin(rx);
    const y1 = y * cos - z * sin;
    const z1 = y * sin + z * cos;
    y = y1;
    z = z1;
  }

  if (ry !== 0) {
    const cos = Math.cos(ry);
    const sin = Math.sin(ry);
    const x1 = x * cos + z * sin;
    const z1 = -x * sin + z * cos;
    x = x1;
    z = z1;
  }

  if (rz !== 0) {
    const cos = Math.cos(rz);
    const sin = Math.sin(rz);
    const x1 = x * cos - y * sin;
    const y1 = x * sin + y * cos;
    x = x1;
    y = y1;
  }

  return [x, y, z];
};

const hexToRgb = (hex: string): Vec3 => {
  let sanitized = hex.trim();
  if (sanitized.startsWith("#")) {
    sanitized = sanitized.slice(1);
  }

  if (sanitized.length === 3) {
    sanitized = sanitized
      .split("")
      .map((char) => char + char)
      .join("");
  }

  if (sanitized.length !== 6) {
    return [1, 1, 1];
  }

  const numericValue = Number.parseInt(sanitized, 16);
  const r = ((numericValue >> 16) & 255) / 255;
  const g = ((numericValue >> 8) & 255) / 255;
  const b = (numericValue & 255) / 255;
  return [r, g, b];
};

const createCylinderGeometry = (radius = 0.5, height = 1.6, radialSegments = 24): Geometry => {
  const vertices: Vec3[] = [];
  const faces: Face[] = [];
  const halfHeight = height / 2;

  for (let i = 0; i < radialSegments; i++) {
    const theta = (i / radialSegments) * Math.PI * 2;
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    vertices.push([x, halfHeight, z]);
    vertices.push([x, -halfHeight, z]);
  }

  const topCenterIndex = vertices.length;
  vertices.push([0, halfHeight, 0]);
  const bottomCenterIndex = vertices.length;
  vertices.push([0, -halfHeight, 0]);

  for (let i = 0; i < radialSegments; i++) {
    const next = (i + 1) % radialSegments;
    const topCurrent = i * 2;
    const bottomCurrent = topCurrent + 1;
    const topNext = next * 2;
    const bottomNext = topNext + 1;

    faces.push([topCurrent, bottomCurrent, bottomNext]);
    faces.push([topCurrent, bottomNext, topNext]);
    faces.push([topCenterIndex, topNext, topCurrent]);
    faces.push([bottomCenterIndex, bottomCurrent, bottomNext]);
  }

  return { vertices, faces };
};

const createBoxGeometry = (width = 1, height = 1, depth = 1): Geometry => {
  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;

  const vertices: Vec3[] = [
    [-hw, -hh, -hd],
    [hw, -hh, -hd],
    [hw, hh, -hd],
    [-hw, hh, -hd],
    [-hw, -hh, hd],
    [hw, -hh, hd],
    [hw, hh, hd],
    [-hw, hh, hd],
  ];

  const faces: Face[] = [
    [0, 1, 2],
    [0, 2, 3],
    [1, 5, 6],
    [1, 6, 2],
    [5, 4, 7],
    [5, 7, 6],
    [4, 0, 3],
    [4, 3, 7],
    [3, 2, 6],
    [3, 6, 7],
    [4, 5, 1],
    [4, 1, 0],
  ];

  return { vertices, faces };
};

const createDiamondGeometry = (size = 1, height = 1.6): Geometry => {
  const halfHeight = height / 2;
  const halfSize = size / 2;

  const vertices: Vec3[] = [
    [0, halfHeight, 0],
    [0, -halfHeight, 0],
    [halfSize, 0, 0],
    [-halfSize, 0, 0],
    [0, 0, halfSize],
    [0, 0, -halfSize],
  ];

  const faces: Face[] = [
    [0, 2, 4],
    [0, 4, 3],
    [0, 3, 5],
    [0, 5, 2],
    [1, 4, 2],
    [1, 3, 4],
    [1, 5, 3],
    [1, 2, 5],
  ];

  return { vertices, faces };
};

const createSphereGeometry = (radius = 0.5, widthSegments = 14, heightSegments = 10): Geometry => {
  const vertices: Vec3[] = [];
  const faces: Face[] = [];

  for (let y = 0; y <= heightSegments; y++) {
    const v = y / heightSegments;
    const phi = v * Math.PI;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);

    for (let x = 0; x <= widthSegments; x++) {
      const u = x / widthSegments;
      const theta = u * Math.PI * 2;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      vertices.push([
        radius * sinPhi * cosTheta,
        radius * cosPhi,
        radius * sinPhi * sinTheta,
      ]);
    }
  }

  const ringVertexCount = widthSegments + 1;
  for (let y = 0; y < heightSegments; y++) {
    for (let x = 0; x < widthSegments; x++) {
      const a = y * ringVertexCount + x;
      const b = a + ringVertexCount;
      const c = b + 1;
      const d = a + 1;

      faces.push([a, b, d]);
      faces.push([b, c, d]);
    }
  }

  return { vertices, faces };
};

const createDiscGeometry = (radius = 1.5, segments = 32): Geometry => {
  const vertices: Vec3[] = [[0, 0, 0]];
  const faces: Face[] = [];

  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push([Math.cos(theta) * radius, 0, Math.sin(theta) * radius]);
  }

  for (let i = 1; i <= segments; i++) {
    const next = i === segments ? 1 : i + 1;
    faces.push([0, i, next]);
  }

  return { vertices, faces };
};

const createRingGeometry = (
  innerRadius = 0.6,
  outerRadius = 0.8,
  height = 0.2,
  segments = 20,
): Geometry => {
  const vertices: Vec3[] = [];
  const faces: Face[] = [];
  const halfHeight = height / 2;

  for (let y = 0; y < 2; y++) {
    const yValue = y === 0 ? halfHeight : -halfHeight;
    for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      vertices.push([cos * outerRadius, yValue, sin * outerRadius]);
      vertices.push([cos * innerRadius, yValue, sin * innerRadius]);
    }
  }

  const outerOffset = 0;
  const innerOffset = segments * 2;

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const topOuterCurrent = outerOffset + i * 2;
    const topInnerCurrent = topOuterCurrent + 1;
    const topOuterNext = outerOffset + next * 2;
    const topInnerNext = topOuterNext + 1;
    const bottomOuterCurrent = innerOffset + i * 2;
    const bottomInnerCurrent = bottomOuterCurrent + 1;
    const bottomOuterNext = innerOffset + next * 2;
    const bottomInnerNext = bottomOuterNext + 1;

    faces.push([topOuterCurrent, bottomOuterCurrent, bottomOuterNext]);
    faces.push([topOuterCurrent, bottomOuterNext, topOuterNext]);
    faces.push([bottomInnerCurrent, topInnerCurrent, topInnerNext]);
    faces.push([bottomInnerCurrent, topInnerNext, bottomInnerNext]);
    faces.push([topOuterCurrent, topOuterNext, topInnerNext]);
    faces.push([topOuterCurrent, topInnerNext, topInnerCurrent]);
    faces.push([bottomOuterNext, bottomOuterCurrent, bottomInnerCurrent]);
    faces.push([bottomOuterNext, bottomInnerCurrent, bottomInnerNext]);
  }

  return { vertices, faces };
};

const buildAvatarMeshes = (style: AvatarStyleDefinition): AvatarMeshes => {
  const baseEmissive = hexToRgb(style.palette.emissive).map((value) => value * 0.25) as Vec3;
  const accentEmissive = hexToRgb(style.palette.emissive).map((value) => value * 0.35) as Vec3;

  const bodyGeometry =
    style.geometry.body.type === "gem"
      ? createDiamondGeometry(1, 1.6)
      : createCylinderGeometry(style.geometry.body.type === "capsule" ? 0.6 : 0.55, 1.8, 28);

  const headGeometry = createSphereGeometry(0.5, 16, 12);
  const floorGeometry = createDiscGeometry(1.6, 40);

  const bodyMesh: MeshDefinition = {
    geometry: bodyGeometry,
    color: hexToRgb(style.palette.primary),
    emissive: baseEmissive,
    scale: style.geometry.body.scale,
    rotation: [0, 0, 0],
    translation: [0, 0, 0],
    roughness: clamp(style.material.roughness, 0, 1),
    metalness: clamp(style.material.metalness, 0, 1),
  };

  const headMesh: MeshDefinition = {
    geometry: headGeometry,
    color: hexToRgb(style.palette.secondary),
    emissive: baseEmissive.map((value) => value * 1.4) as Vec3,
    scale: [style.geometry.head.radius, style.geometry.head.radius, style.geometry.head.radius],
    rotation: [0, 0, 0],
    translation: [0, style.geometry.head.offsetY, 0],
    roughness: clamp(style.material.roughness + 0.15, 0, 1),
    metalness: clamp(style.material.metalness - 0.1, 0, 1),
    attachToHead: true,
  };

  let accessoryMesh: MeshDefinition | undefined;
  if (style.geometry.accessory) {
    const { type, scale, offset, rotation } = style.geometry.accessory;
    if (type === "visor") {
      accessoryMesh = {
        geometry: createBoxGeometry(1.2, 0.4, 0.3),
        color: hexToRgb(style.palette.accent),
        emissive: accentEmissive,
        scale,
        rotation: rotation ?? [0, 0, 0],
        translation: offset,
        roughness: 0.3,
        metalness: 0.6,
        attachToHead: true,
      };
    } else if (type === "crown") {
      accessoryMesh = {
        geometry: createRingGeometry(0.6, 0.82, 0.22, 24),
        color: hexToRgb(style.palette.accent),
        emissive: accentEmissive.map((value) => value * 1.2) as Vec3,
        scale,
        rotation: rotation ?? [0, 0, 0],
        translation: offset,
        roughness: 0.25,
        metalness: 0.75,
        attachToHead: true,
      };
    } else if (type === "orb") {
      accessoryMesh = {
        geometry: createSphereGeometry(0.3, 14, 10),
        color: hexToRgb(style.palette.accent),
        emissive: accentEmissive.map((value) => value * 1.5) as Vec3,
        scale,
        rotation: rotation ?? [0, 0, 0],
        translation: offset,
        roughness: 0.1,
        metalness: 0.5,
      };
    }
  }

  const floorMesh: MeshDefinition = {
    geometry: floorGeometry,
    color: hexToRgb(style.floorColor),
    emissive: [0, 0, 0],
    scale: [1, 1, 1],
    rotation: [Math.PI / 2, 0, 0],
    translation: [0, -0.95, 0],
    roughness: 0.9,
    metalness: 0,
  };

  return {
    body: bodyMesh,
    head: headMesh,
    accessory: accessoryMesh,
    floor: floorMesh,
  };
};

const lightDirection: Vec3 = normalize([0.35, 0.82, 0.55]);

const drawAvatar = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  meshes: AvatarMeshes,
  pose: AvatarPoseDefinition,
  camera: AvatarCameraDefinition,
  timeSeconds: number,
) => {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const sway = Math.sin(timeSeconds * 1.6) * pose.swayAmplitude;
  const headSway = Math.sin(timeSeconds * 2.2) * (pose.swayAmplitude * 0.35);
  const bob = pose.bobOffset + Math.sin(timeSeconds * 1.8) * pose.bobAmplitude;

  const globalRotation: Vec3 = [pose.rotation[0], pose.rotation[1] + sway, pose.rotation[2]];
  const headRotation: Vec3 = [pose.headTilt[0], pose.headTilt[1] + headSway, pose.headTilt[2]];
  const globalTranslation: Vec3 = [0, bob, 0];

  const cameraPosition = camera.position as Vec3;
  const cameraTarget = camera.target as Vec3;
  let up: Vec3 = [0, 1, 0];
  const forward = normalize(subtract(cameraTarget, cameraPosition));

  if (length(cross(forward, up)) < 1e-3) {
    up = [0, 0, 1];
  }

  const right = normalize(cross(forward, up));
  const trueUp = normalize(cross(right, forward));
  const aspect = width / height;
  const f = 1 / Math.tan((camera.fov * Math.PI) / 360);

  const projectPoint = (point: Vec3): { screen: Vec2; depth: number } | null => {
    const relative = subtract(point, cameraPosition);
    const cameraSpace: Vec3 = [
      dot(relative, right),
      dot(relative, trueUp),
      dot(relative, forward),
    ];

    if (cameraSpace[2] <= 0.1) {
      return null;
    }

    const xNdc = (cameraSpace[0] * f) / (cameraSpace[2] * aspect);
    const yNdc = (cameraSpace[1] * f) / cameraSpace[2];

    const screen: Vec2 = [
      width / 2 + (xNdc * width) / 2,
      height / 2 - (yNdc * height) / 2,
    ];

    return { screen, depth: cameraSpace[2] };
  };

  const collectTriangles = (mesh: MeshDefinition, attachToHead: boolean) => {
    const transformedVertices = mesh.geometry.vertices.map((vertex) => {
      let working = scaleVec(vertex, mesh.scale);
      working = rotatePoint(working, mesh.rotation);
      working = add(working, mesh.translation);

      if (attachToHead) {
        const pivot = mesh.translation;
        const relative = subtract(working, pivot);
        const rotated = rotatePoint(relative, headRotation);
        working = add(rotated, pivot);
      }

      working = rotatePoint(working, globalRotation);
      working = add(working, globalTranslation);

      return working;
    });

    const triangles: Array<{ points: Vec2[]; depth: number; color: string }> = [];

    for (const face of mesh.geometry.faces) {
      const [i1, i2, i3] = face;
      const p1 = transformedVertices[i1];
      const p2 = transformedVertices[i2];
      const p3 = transformedVertices[i3];

      const edge1 = subtract(p2, p1);
      const edge2 = subtract(p3, p1);
      let normal = cross(edge1, edge2);
      const normalLength = length(normal);
      if (normalLength === 0) {
        continue;
      }
      normal = [normal[0] / normalLength, normal[1] / normalLength, normal[2] / normalLength];

      const centroid: Vec3 = [
        (p1[0] + p2[0] + p3[0]) / 3,
        (p1[1] + p2[1] + p3[1]) / 3,
        (p1[2] + p2[2] + p3[2]) / 3,
      ];

      const viewDirection = subtract(cameraPosition, centroid);
      if (dot(normal, viewDirection) <= 0) {
        continue;
      }

      const projected1 = projectPoint(p1);
      const projected2 = projectPoint(p2);
      const projected3 = projectPoint(p3);

      if (!projected1 || !projected2 || !projected3) {
        continue;
      }

      const light = Math.max(0, dot(normal, lightDirection));
      const viewVectorNormalized = normalize(viewDirection);
      const halfVector = normalize(add(lightDirection, viewVectorNormalized));
      const specular = Math.pow(Math.max(0, dot(normal, halfVector)), 12) * mesh.metalness * 0.35;
      const baseColor = mesh.color;
      const emissive = mesh.emissive;
      const diffuse = 0.55 + (1 - mesh.roughness) * 0.45;
      const shading = clamp(0.35 + light * diffuse + specular, 0, 1.25);

      const finalColor: Vec3 = [
        clamp(baseColor[0] * shading + emissive[0], 0, 1),
        clamp(baseColor[1] * shading + emissive[1], 0, 1),
        clamp(baseColor[2] * shading + emissive[2], 0, 1),
      ];

      triangles.push({
        points: [projected1.screen, projected2.screen, projected3.screen],
        depth: (projected1.depth + projected2.depth + projected3.depth) / 3,
        color: `rgba(${Math.round(finalColor[0] * 255)}, ${Math.round(finalColor[1] * 255)}, ${Math.round(
          finalColor[2] * 255,
        )}, 1)`,
      });
    }

    return triangles;
  };

  const allTriangles = [
    ...collectTriangles(meshes.floor, false),
    ...collectTriangles(meshes.body, false),
    ...collectTriangles(meshes.head, true),
    ...(meshes.accessory ? collectTriangles(meshes.accessory, meshes.accessory.attachToHead ?? false) : []),
  ];

  allTriangles.sort((a, b) => b.depth - a.depth);

  for (const triangle of allTriangles) {
    const [p1, p2, p3] = triangle.points;
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.closePath();
    ctx.fillStyle = triangle.color;
    ctx.fill();
  }
};

type AvatarPreview3DProps = {
  style: AvatarStyleDefinition;
  pose: AvatarPoseDefinition;
  camera: AvatarCameraDefinition;
  className?: string;
};

const AvatarPreview3D = ({ style, pose, camera, className }: AvatarPreview3DProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number>();
  const meshesRef = useRef<AvatarMeshes>(buildAvatarMeshes(style));
  const poseRef = useRef<AvatarPoseDefinition>(pose);
  const cameraRef = useRef<AvatarCameraDefinition>(camera);

  useEffect(() => {
    meshesRef.current = buildAvatarMeshes(style);
  }, [style]);

  useEffect(() => {
    poseRef.current = pose;
  }, [pose]);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    observer.observe(canvas);

    const render = (time: number) => {
      animationRef.current = requestAnimationFrame(render);
      drawAvatar(ctx, canvas, meshesRef.current, poseRef.current, cameraRef.current, time / 1000);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        "h-48 w-48 overflow-hidden rounded-full bg-gradient-to-tr from-background/20 to-background/5",
        className,
      )}
    />
  );
};

export default AvatarPreview3D;
