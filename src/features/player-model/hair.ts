import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PlayerAppearance } from './appearance';

/** Authored meshes split scalp hair from brows and eyes. New cuts use the
 * complete casual scalp, leaving all skin, eyebrows and facial details intact. */
export function isScalpHair(material: T.Material, frame: PlayerAppearance['body']['frame']) {
  return frame === 'feminine' ? material.name === 'Hair_Blond' : material.name === 'Hair';
}
export function addHair(root: T.Object3D, appearance: PlayerAppearance, head: T.Bone) {
  const cut = appearance.head.hairStyle ?? 'original', facial = appearance.head.facialHair ?? 'none';
  if (cut === 'original' && facial === 'none') return;
  root.updateMatrixWorld(true);
  const bounds = new T.Box3(), skinFaces: T.Vector3[][] = [];
  root.traverse(node => {
    if (!(node instanceof T.SkinnedMesh)) return;
    let parent: T.Object3D | null = node; while (parent && !/_Head(?:_|$)/i.test(parent.name)) parent = parent.parent;
    if (!parent) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (!materials.every(m => /skin/i.test(m.name))) return;
    node.skeleton.update();
    const vertices = Array.from({ length: node.geometry.attributes.position.count }, (_, i) => node.getVertexPosition(i,new T.Vector3()).applyMatrix4(node.matrixWorld));
    vertices.forEach(v => bounds.expandByPoint(v));
    const indices = node.geometry.index?.array ?? vertices.map((_,i)=>i);
    for(let i=0;i<indices.length;i+=3) skinFaces.push([vertices[indices[i]],vertices[indices[i+1]],vertices[indices[i+2]]]);
  });
  if (bounds.isEmpty()) throw new Error('This avatar is missing its face geometry.');
  const center = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
  const rx = size.x*.47, rz = size.z*.49, h = size.y, top = bounds.max.y, base = bounds.min.y, front = bounds.max.z;
  const anchor = new T.Group(); anchor.name = 'avatar-head-details'; anchor.userData.faceBounds = { min: bounds.min.toArray(), max: bounds.max.toArray() };
  // All additions are built in rest world space before attachment to Head.
  const strands: T.BufferGeometry[] = [], beard: T.BufferGeometry[] = [];
  const ellipsoid = (list: T.BufferGeometry[], x: number, y: number, z: number, sx: number, sy: number, sz: number, tilt = 0) => {
    const g = new T.SphereGeometry(1,16,10).toNonIndexed(); g.scale(sx,sy,sz); g.rotateZ(tilt); g.translate(x,y,z); list.push(g);
  };
  const surfaceZ = (x: number, y: number): number | null => {
    let z = -Infinity;
    for(const [a,b,c] of skinFaces) {
      const denominator=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y); if(Math.abs(denominator)<1e-10) continue;
      const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/denominator;
      const v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/denominator, w=1-u-v;
      if(u>=-.0001&&v>=-.0001&&w>=-.0001) z=Math.max(z,u*a.z+v*b.z+w*c.z);
    }
    return Number.isFinite(z)?z:null;
  };
  const cap = () => {
    const hairline=top-h*.23, points: number[]=[];
    for(const face of skinFaces) {
      const polygon: T.Vector3[]=[];
      for(let i=0;i<3;i++) { const a=face[i],b=face[(i+1)%3]; if(a.y>=hairline) polygon.push(a.clone()); if((a.y>=hairline)!==(b.y>=hairline)) polygon.push(a.clone().lerp(b,(hairline-a.y)/(b.y-a.y))); }
      for(let i=1;i<polygon.length-1;i++) for(const v of [polygon[0],polygon[i],polygon[i+1]]) points.push(center.x+(v.x-center.x)*1.035,v.y+.003,center.z+(v.z-center.z)*1.035);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(points.length/3*2),2));g.computeVertexNormals();strands.push(g);
  };
  if(cut !== 'original' && cut !== 'bald') cap();
  if(cut === 'quiff') for(let i=0;i<5;i++) ellipsoid(strands,center.x+(i-2)*rx*.29,top+h*(.1+i*.015),center.z+rz*.5,rx*.31,h*.18,rz*.68,-.25);
  if(cut === 'mohawk') for(let i=0;i<8;i++) ellipsoid(strands,center.x,top+h*(.2+Math.sin(i/7*Math.PI)*.12),center.z-rz*.8+i*rz*1.6/7,rx*.18,h*.33,rz*.2);
  if(['bob','long'].includes(cut)) {
    const length = cut==='long'?h*1.05:h*.5;
    for(let i=0;i<13;i++) { const angle=i*Math.PI/12; ellipsoid(strands,center.x+Math.cos(angle)*rx*.93,top-length*.55,center.z-Math.sin(angle)*rz*.92,rx*.23,length*.7,rz*.23); }
    // Side panels frame the face; the front is deliberately open.
    for(const side of [-1,1]) ellipsoid(strands,center.x+side*rx*.95,top-length*.58,center.z+rz*.28,rx*.23,length*.64,rz*.3);
  }
  if(cut === 'ponytail') { ellipsoid(strands,center.x,top-h*.13,center.z-rz*1.03,rx*.47,h*.16,rz*.4); for(let i=0;i<5;i++) ellipsoid(strands,center.x+Math.sin(i*.8)*rx*.13,top-h*.17-i*h*.17,center.z-rz*(1.3+i*.07),rx*(.45-i*.035),h*.17,rz*.36); }
  if(cut === 'bun') ellipsoid(strands,center.x,top+h*.05,center.z-rz*.35,rx*.65,h*.2,rz*.65);
  if(cut === 'curls') for(let row=0;row<3;row++) for(let i=0;i<12;i++) { const a=i*Math.PI/6+row*.2,r=Math.sin((row+1)*Math.PI/7);ellipsoid(strands,center.x+Math.cos(a)*rx*r,top+h*.02+Math.cos((row+1)*Math.PI/7)*h*.15,center.z+Math.sin(a)*rz*r,rx*.38,h*.14,rz*.34); }
  const chin=appearance.body.frame==='masculine'?.27:.14, lipY=base+h*.34, lipZ=(surfaceZ(center.x,lipY)??front)+.002;
  const moustache = () => { for(const side of [-1,1]) ellipsoid(beard,center.x+side*rx*.25,lipY,lipZ,rx*.36,h*.047,rz*.12,side*.16); };
  if(['moustache','goatee','short_beard','full_beard','long_beard'].includes(facial)) moustache();
  if(facial==='goatee') { const y=base+h*(chin+.045); ellipsoid(beard,center.x,y,(surfaceZ(center.x,y)??front)+.003,rx*.3,h*.095,rz*.1); }
  if(['stubble','short_beard','full_beard','long_beard'].includes(facial)) {
    const length=facial==='long_beard'?.45:facial==='full_beard'?.13:facial==='short_beard'?.025:0;
    const positions: number[] = [], uvs: number[] = [], indexes: number[] = [];
    for(let y=0;y<=10;y++) for(let x=0;x<=24;x++) {
      const u=x/24*2-1, v=y/10, upper=Math.max(chin+.04,.23)+Math.abs(u)*.24, lower=chin-length*(1-Math.abs(u)*.5);
      const px=center.x+u*rx*((facial==='long_beard'?.25:.5)+v*(facial==='long_beard'?.69:.44)), py=base+h*(lower+(upper-lower)*v);
      const z=surfaceZ(px,Math.max(py,base+h*(chin+.01)))??front-rz*(.18+.5*u*u);
      positions.push(px,py,z+(facial==='stubble'?.006:.01)); uvs.push(x/24,y/10);
      if(y<10&&x<24){const a=y*25+x; indexes.push(a,a+1,a+25,a+1,a+26,a+25);}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indexes);g.computeVertexNormals();beard.push(g.toNonIndexed());g.dispose();
  }
  if(facial==='sideburns') for(const side of [-1,1]) ellipsoid(beard,center.x+side*rx*.87,base+h*.44,center.z+rz*.45,rx*.14,h*.22,rz*.16);
  const add = (parts: T.BufferGeometry[], name: string, color: string) => {
    if(!parts.length) return;
    const geometry=mergeGeometries(parts,false)!;parts.forEach(g=>g.dispose());
    const material=new T.MeshStandardMaterial({color,roughness:.92,side:T.DoubleSide});material.name=name;
    if(facial==='stubble'&&name==='FacialHair') {
      const data=new Uint8Array(64*64*4);for(let i=0;i<4096;i++){data[i*4]=data[i*4+1]=data[i*4+2]=255;data[i*4+3]=(i*31+Math.floor(i/64)*17)%11<4?255:0;}
      const texture=new T.DataTexture(data,64,64);texture.needsUpdate=true;material.map=texture;material.alphaTest=.5;
    }
    const mesh=new T.Mesh(geometry,material);mesh.name=name==='Hair'?'avatar-hairstyle':'avatar-facial-hair';mesh.castShadow=true;anchor.add(mesh);
  };
  add(strands,'Hair',appearance.head.hair);add(beard,'FacialHair',appearance.head.facialHairColor??appearance.head.hair);
  root.add(anchor); root.updateMatrixWorld(true); head.attach(anchor); root.updateMatrixWorld(true);
}
