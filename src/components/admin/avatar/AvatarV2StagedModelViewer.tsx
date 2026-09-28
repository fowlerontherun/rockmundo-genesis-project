import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

const BUCKET = 'avatar-v2-authoring';
const GROUPS = ['tee', 'denim', 'footwear', 'punk'] as const;

export function AvatarV2StagedModelViewer({ sha }: { sha: string }) {
  const [models, setModels] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [finish, setFinish] = useState('original');
  const [meshInfo, setMeshInfo] = useState('');
  const [message, setMessage] = useState('Loading private review models…');
  const mount = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function listModels() {
      try {
        const results = await Promise.all(GROUPS.map(async group => {
          const prefix = `reviewed/${sha}/assets/${group}`;
          const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 100 });
          if (error) throw error;
          return (data ?? []).filter(file => file.name.toLowerCase().endsWith('.glb'))
            .map(file => `${prefix}/${file.name}`);
        }));
        if (cancelled) return;
        const paths = results.flat().sort();
        setModels(paths);
        setSelected(paths[0] ?? '');
        setMessage(paths.length ? '' : 'No staged GLB models found. Use Extract for review first.');
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Could not list private review models');
      }
    }
    void listModels();
    return () => { cancelled = true; };
  }, [sha]);

  useEffect(() => {
    const host = mount.current;
    if (!host || !selected) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    let frame = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#20232b');
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    camera.position.set(2, 1.5, 2.5);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(3, 6, 5);
    scene.add(key);
    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const animate = () => {
      if (cancelled) return;
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();
    async function load() {
      setMessage('Loading model…');
      try {
        const { data, error } = await supabase.storage.from(BUCKET).download(selected);
        if (error || !data) throw error ?? new Error('Download failed');
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data);
        const gltf = await new GLTFLoader().loadAsync(objectUrl);
        if (cancelled) return;
        let meshes = 0;
        let textured = 0;
        let skinned = 0;
        gltf.scene.traverse(node => {
          if (!(node instanceof THREE.Mesh)) return;
          meshes++;
          if (node instanceof THREE.SkinnedMesh) skinned++;
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          if (materials.some(material => material instanceof THREE.MeshStandardMaterial && !!material.map)) textured++;
          if (finish !== 'original') node.material = materials.map(() => new THREE.MeshStandardMaterial({ color: finish, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }));
        });
        setMeshInfo(meshes + ' meshes, ' + textured + ' textured, ' + skinned + ' skinned');
        scene.add(gltf.scene);
        const bounds = new THREE.Box3().setFromObject(gltf.scene);
        if (bounds.isEmpty()) throw new Error('This model has no visible geometry');
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const radius = Math.max(size.length() * 0.65, 0.2);
        controls.target.copy(center);
        camera.position.copy(center).add(new THREE.Vector3(radius, radius * 0.65, radius));
        camera.near = Math.max(radius / 1000, 0.001);
        camera.far = radius * 100;
        camera.updateProjectionMatrix();
        controls.update();
        setMessage('');
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Could not preview model');
      }
    }
    void load();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.traverse(node => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach(material => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selected, finish]);

  return (
    <div className="mt-3 space-y-2 rounded-lg border p-3">
      <p className="text-sm font-medium">Private 3D model preview · authoring blockouts only</p>
      <label className="block text-sm" htmlFor="avatar-v2-review-model">Choose a model</label>
      <select id="avatar-v2-review-model" className="w-full rounded border bg-background p-2 text-sm"
        value={selected} onChange={event => setSelected(event.target.value)}>
        {models.map(path => <option key={path} value={path}>{path.split('/').slice(-2).join(' / ')}</option>)}
      </select>
      <label className="block text-sm" htmlFor="v2-finish">Material preview</label>
      <select id="v2-finish" className="w-full rounded border bg-background p-2 text-sm" value={finish} onChange={event => setFinish(event.target.value)}>
        <option value="original">Original embedded materials</option>
        <option value="#202026">Black fabric simulation</option>
        <option value="#dedbd2">White fabric simulation</option>
        <option value="#344c72">Blue denim simulation</option>
        <option value="#282024">Dark leather simulation</option>
        <option value="#a51f34">Red fabric simulation</option>
      </select>
      <div ref={mount} className="w-full overflow-hidden rounded-md" style={{ height: 340, touchAction: 'none' }}
        aria-label="Interactive 3D model preview: drag to rotate, pinch to zoom" />
      {meshInfo && selected && <p className="text-xs text-muted-foreground">{meshInfo}</p>}
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Drag to rotate · pinch or scroll to zoom</span>
        <Button type="button" size="sm" variant="outline" onClick={() => setSelected('')}>Clear preview</Button>
        {!selected && models.length > 0 && <Button type="button" size="sm" onClick={() => setSelected(models[0])}>Show first model</Button>}
      </div>
      <p className="text-xs text-muted-foreground">These material finishes are temporary simulations, not saved clothing skins. Rigging, fitting and production textures are still required.</p>
    </div>
  );
}
