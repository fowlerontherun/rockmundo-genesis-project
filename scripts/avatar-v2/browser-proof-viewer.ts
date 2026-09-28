/** CI-only browser renderer for genuine Blender exports; never bundled into the game. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface BrowserProof {
  state: 'loading' | 'loaded' | 'error';
  sourceFrame: string;
  sourceOnly: true;
  meshes: number;
  skinnedMeshes: number;
  uvMappedMeshes: number;
  materialSlots: number;
  embeddedTextureSlots: number;
  triangles: number;
  webglVersion: string;
  error?: string;
}

declare global {
  interface Window {
    __avatarV2BrowserProof?: BrowserProof;
  }
}

const frame = new URLSearchParams(location.search).get('frame') ?? 'unknown';
const status = document.querySelector<HTMLElement>('#proof-status');
const audit = document.querySelector<HTMLElement>('#proof-audit');
const host = document.querySelector<HTMLElement>('#proof-viewer');
if (!status || !audit || !host) throw new Error('Browser proof fixture has no output elements');

const result: BrowserProof = {
  state: 'loading', sourceFrame: frame, sourceOnly: true,
  meshes: 0, skinnedMeshes: 0, uvMappedMeshes: 0, materialSlots: 0,
  embeddedTextureSlots: 0, triangles: 0, webglVersion: '',
};
window.__avatarV2BrowserProof = result;

async function showGenuineBlenderSource() {
  try {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#222733');
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host!.appendChild(renderer.domElement);
    const gl = renderer.getContext();
    result.webglVersion = String(gl.getParameter(gl.VERSION) ?? '');
    if (!result.webglVersion.toLowerCase().includes('webgl')) {
      throw new Error('Browser failed to create a real WebGL rendering context');
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x666677, 2));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(3, 5, 5);
    scene.add(key);

    // Playwright intercepts this URL and supplies the actual GLB from the
    // pinned Blender workflow. No experiment enters public/avatar-v2.
    const gltf = await new GLTFLoader().loadAsync('/avatar-v2-real-source-fixture.glb');
    gltf.scene.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      result.meshes += 1;
      if (node instanceof THREE.SkinnedMesh) result.skinnedMeshes += 1;
      const geometry = node.geometry;
      if (geometry.getAttribute('uv')) result.uvMappedMeshes += 1;
      result.triangles += geometry.index
        ? geometry.index.count / 3
        : (geometry.getAttribute('position')?.count ?? 0) / 3;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      result.materialSlots += materials.length;
      result.embeddedTextureSlots += materials.filter(material => (
        material instanceof THREE.MeshStandardMaterial
        && Boolean(material.map || material.normalMap)
      )).length;
    });
    if (result.meshes < 1 || result.skinnedMeshes < 1 || result.triangles < 1000 || result.materialSlots < 1) {
      throw new Error('Actual Blender GLB is missing skinned visible geometry or materials');
    }
    scene.add(gltf.scene);
    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    if (bounds.isEmpty()) throw new Error('GLB browser scene has empty geometry');
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(bounds.getSize(new THREE.Vector3()).length * 0.65, 0.3);
    camera.near = Math.max(radius / 1000, 0.001);
    camera.far = radius * 100;
    camera.position.copy(center).add(new THREE.Vector3(radius, radius * 0.65, radius));
    controls.target.copy(center);
    camera.updateProjectionMatrix();

    const resize = () => {
      const width = Math.max(host!.clientWidth, 1);
      const height = Math.max(host!.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host!);
    resize();
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(render);
    };
    render();
    result.triangles = Math.round(result.triangles);
    result.state = 'loaded';
    status!.textContent = 'Real GLB loaded and browser-rendered; experimental source only.';
    audit!.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    result.state = 'error';
    result.error = error instanceof Error ? error.message : String(error);
    status!.textContent = 'Browser rendering failed: ' + result.error;
    audit!.textContent = JSON.stringify(result, null, 2);
    throw error;
  }
}

void showGenuineBlenderSource();
