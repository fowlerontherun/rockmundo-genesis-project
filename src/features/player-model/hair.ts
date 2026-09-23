import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PlayerAppearance } from './appearance';
import { avatarQualityProfile, type AvatarVisualQuality } from './avatarVisualQuality';
import { applyAvatarHairQuality, type AvatarHairTextureCache } from './avatarMaterialQuality';

/** Authored meshes split scalp hair from brows and eyes. New cuts use the
 * complete casual scalp, leaving all skin, eyebrows and facial details intact. */
function isHeadSurfaceMesh(root: T.Object3D, node: T.SkinnedMesh) {
  let parent: T.Object3D | null = node;
  while (parent) {
    if (/_Head(?:_|$)/i.test(parent.name)) return true;
    if (
      root.userData.rockmundoAvatarEngine === 'rockmundo-v2' &&
      (
        parent.userData?.rockmundoHeadSurface === true ||
        /(?:rmv2|rockmundo)[_-]?(?:head|face)(?:surface)?/i.test(parent.name) ||
        /(?:head|face)[_-]?surface/i.test(parent.name)
      )
    ) return true;
    parent = parent.parent;
  }
  return false;
}
export function isScalpHair(material: T.Material, frame: PlayerAppearance['body']['frame']) {
  return frame === 'feminine' ? material.name === 'Hair_Blond' : material.name === 'Hair';
}
export function addHair(
  root: T.Object3D,
  appearance: PlayerAppearance,
  head: T.Bone,
  quality: AvatarVisualQuality = 'balanced',
  hairTextureCache?: AvatarHairTextureCache,
) {
  const profile = avatarQualityProfile(quality);
  const cut = appearance.head.hairStyle ?? 'original', facial = appearance.head.facialHair ?? 'none';
  if (cut === 'original' && facial === 'none') return;
  root.updateMatrixWorld(true);
  const bounds = new T.Box3(), skinFaces: T.Vector3[][] = [];
  root.traverse(node => {
    if (!(node instanceof T.SkinnedMesh)) return;
    if (!isHeadSurfaceMesh(root, node)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const isV2 = root.userData.rockmundoAvatarEngine === 'rockmundo-v2';
    const hasUsableSkin = isV2
      ? materials.some(m => /skin|face/i.test(m.name))
      : materials.every(m => /skin/i.test(m.name));
    if (!hasUsableSkin) return;
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
    const g = new T.SphereGeometry(1, profile.hairSphereSegments, profile.hairSphereRings).toNonIndexed(); g.scale(sx,sy,sz); g.rotateZ(tilt); g.translate(x,y,z); list.push(g);
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
    // Keep the face-conforming hairline where usable.
    const hairline=top-h*.23, points: number[]=[];
    for(const face of skinFaces) {
      const polygon: T.Vector3[]=[];
      for(let i=0;i<3;i++) { const a=face[i],b=face[(i+1)%3]; if(a.y>=hairline) polygon.push(a.clone()); if((a.y>=hairline)!==(b.y>=hairline)) polygon.push(a.clone().lerp(b,(hairline-a.y)/(b.y-a.y))); }
      for(let i=1;i<polygon.length-1;i++) for(const v of [polygon[0],polygon[i],polygon[i+1]]) points.push(center.x+(v.x-center.x)*1.055,v.y+.006,center.z+(v.z-center.z)*1.055);
    }
    if(points.length) {
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.Float32BufferAttribute(points,3));
      const uv = new Float32Array(points.length / 3 * 2);
      for (let i = 0; i < points.length / 3; i++) {
        const px = points[i * 3], py = points[i * 3 + 1];
        uv[i * 2] = T.MathUtils.clamp((px - (center.x - rx)) / Math.max(.001, rx * 2), 0, 1);
        uv[i * 2 + 1] = T.MathUtils.clamp((py - hairline) / Math.max(.001, top - hairline), 0, 1);
      }
      g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
      g.computeVertexNormals();
      strands.push(g);
    }
    // Some feminine head exports do not expose enough crown skin triangles for
    // the clipped cap above. This shallow shell guarantees a closed crown while
    // retaining the face-conforming hairline and stays outside the skin surface.
    const crown=new T.SphereGeometry(1, Math.max(16, profile.hairSphereSegments), Math.max(10, profile.hairSphereRings),0,Math.PI*2,0,Math.PI*.64).toNonIndexed();
    crown.scale(rx*1.065,h*.195,rz*1.06); crown.translate(center.x,top-h*.18,center.z-rz*.025); strands.push(crown);
  };
  if(cut !== 'original' && cut !== 'bald') cap();
  if(cut === 'quiff') for(let i=0;i<5;i++) ellipsoid(strands,center.x+(i-2)*rx*.26,top+h*(.045+i*.008),center.z+rz*.34,rx*.27,h*.09,rz*.43,-.16);
  if(cut === 'mohawk') for(let i=0;i<8;i++) ellipsoid(strands,center.x,top+h*(.07+Math.sin(i/7*Math.PI)*.045),center.z-rz*.72+i*rz*1.44/7,rx*.105,h*.14,rz*.14);
  if(['bob','long','shoulder','layered_long'].includes(cut)) {
    const length = cut==='long'?h*.72:cut==='layered_long'?h*.8:cut==='shoulder'?h*.5:h*.38;
    const count = cut==='layered_long'?15:13;
    for(let i=0;i<count;i++) {
      const angle=i*Math.PI/(count-1), layer=cut==='layered_long' ? .88+.12*Math.sin(i*.9) : 1;
      ellipsoid(strands,center.x+Math.cos(angle)*rx*.86,top-length*.56*layer,center.z-Math.sin(angle)*rz*.84,rx*.16,length*.5*layer,rz*.17,cut==='layered_long'?Math.sin(i*.7)*.07:0);
    }
    // Side panels frame the face; the front is deliberately open.
    for(const side of [-1,1]) ellipsoid(strands,center.x+side*rx*.95,top-length*.58,center.z-rz*.03,rx*.15,length*.48,rz*.18,side*(cut==='layered_long'?.06:0));
  }
  if(cut === 'long_waves') {
    for(let i=0;i<13;i++) {
      const angle=i*Math.PI/12, x=center.x+Math.cos(angle)*rx*.86, z=center.z-Math.sin(angle)*rz*.84;
      for(let segment=0;segment<3;segment++) {
        const phase=i*.8+segment*1.7;
        ellipsoid(strands,x+Math.sin(phase)*rx*.07,top-h*(.27+segment*.18),z-segment*rz*.025,rx*.14,h*.205,rz*.16,Math.sin(phase)*.14);
      }
    }
    for(const side of [-1,1]) for(let segment=0;segment<3;segment++) {
      const phase=segment*1.8+side;
      ellipsoid(strands,center.x+side*rx*(.95+.03*Math.sin(phase)),top-h*(.28+segment*.18),center.z-rz*.02-segment*rz*.03,rx*.14,h*.2,rz*.17,side*Math.sin(phase)*.12);
    }
  }
  if(cut === 'ponytail') { ellipsoid(strands,center.x,top-h*.1,center.z-rz*.96,rx*.31,h*.105,rz*.27); for(let i=0;i<4;i++) ellipsoid(strands,center.x+Math.sin(i*.8)*rx*.08,top-h*.15-i*h*.12,center.z-rz*(1.12+i*.045),rx*(.26-i*.02),h*.115,rz*.22); }
  if(cut === 'high_ponytail') {
    ellipsoid(strands,center.x,top+h*.005,center.z-rz*.82,rx*.3,h*.105,rz*.28);
    for(let i=0;i<5;i++) ellipsoid(strands,center.x+Math.sin(i*.9)*rx*.1,top-h*(.06+i*.13),center.z-rz*(1.02+i*.045),rx*(.26-i*.018),h*.13,rz*.21,Math.sin(i*.9)*.08);
  }
  if(cut === 'side_braid') {
    const side=1;
    ellipsoid(strands,center.x+side*rx*.72,top-h*.12,center.z-rz*.72,rx*.24,h*.1,rz*.22,side*.2);
    for(let i=0;i<7;i++) ellipsoid(strands,center.x+side*rx*(.88+.05*Math.sin(i*.9)),top-h*(.22+i*.105),center.z-rz*(.72+i*.015),rx*(.18-i*.009),h*.085,rz*.16,side*(i%2?.13:-.13));
  }
  if(cut === 'twin_ponytails') for(const side of [-1,1]) {
    ellipsoid(strands,center.x+side*rx*.78,top-h*.08,center.z-rz*.62,rx*.22,h*.09,rz*.2,side*.12);
    for(let i=0;i<4;i++) ellipsoid(strands,center.x+side*rx*(.96+.03*Math.sin(i)),top-h*(.17+i*.14),center.z-rz*(.68+i*.025),rx*(.2-i*.015),h*.13,rz*.17,side*(.08+Math.sin(i)*.05));
  }
  if(cut === 'bun') ellipsoid(strands,center.x,top+h*.015,center.z-rz*.3,rx*.39,h*.12,rz*.39);
  if(cut === 'curls') for(let row=0;row<3;row++) for(let i=0;i<10;i++) { const a=i*Math.PI/5+row*.17,r=Math.sin((row+1)*Math.PI/7);ellipsoid(strands,center.x+Math.cos(a)*rx*r*.9,top+h*.005+Math.cos((row+1)*Math.PI/7)*h*.08,center.z+Math.sin(a)*rz*r*.9,rx*.21,h*.085,rz*.2); }
  if (cut === 'faux_hawk') for(let i=0;i<7;i++) ellipsoid(strands,center.x,top+h*(.035+Math.sin(i/6*Math.PI)*.025),center.z-rz*.64+i*rz*1.28/6,rx*.15,h*.09,rz*.16);
  if (cut === 'undercut') {
    for(let i=0;i<5;i++) ellipsoid(strands,center.x+(i-2)*rx*.22,top-h*.015,center.z+rz*(.18-i*.08),rx*.25,h*.07,rz*.27,-.13);
  }
  if (cut === 'slick_back') {
    for(let i=0;i<7;i++) ellipsoid(strands,center.x+(i-3)*rx*.22,top-h*.03,center.z+rz*(.22-i*.12),rx*.22,h*.065,rz*.31,-.22);
  }
  if (cut === 'side_part') {
    for(let i=0;i<7;i++) {
      const side=i<2?-1:1, offset=(i-3)*rx*.2;
      ellipsoid(strands,center.x+offset,top-h*(.018+Math.abs(i-3)*.008),center.z+rz*(.24-Math.abs(i-3)*.055),rx*.24,h*.07,rz*.27,side*.18);
    }
  }
  if (cut === 'curtain') for(const side of [-1,1]) for(let i=0;i<4;i++) {
    ellipsoid(strands,center.x+side*rx*(.2+i*.18),top-h*(.04+i*.035),center.z+rz*(.42-i*.06),rx*.2,h*.115,rz*.18,side*.17);
  }
  if (cut === 'pixie') {
    for(let i=0;i<9;i++) {
      const a=i/8*Math.PI*2;
      ellipsoid(strands,center.x+Math.cos(a)*rx*.48,top-h*.055,center.z+Math.sin(a)*rz*.48,rx*.2,h*.075,rz*.2,Math.sin(a)*.16);
    }
  }
  if (cut === 'shag') {
    for(let i=0;i<13;i++) {
      const a=i*Math.PI/12, layer=.7+.25*((i%3)/2);
      ellipsoid(strands,center.x+Math.cos(a)*rx*.88,top-h*.26*layer,center.z-Math.sin(a)*rz*.82,rx*.17,h*.22*layer,rz*.18,Math.sin(i*1.3)*.18);
    }
  }
  if (cut === 'mullet') {
    for(let i=0;i<8;i++) ellipsoid(strands,center.x+(i-3.5)*rx*.2,top-h*.08,center.z-rz*(.2+i*.09),rx*.19,h*.1,rz*.23,Math.sin(i)*.08);
    for(let i=0;i<5;i++) ellipsoid(strands,center.x+Math.sin(i*.9)*rx*.09,top-h*(.18+i*.12),center.z-rz*.92,rx*.28,h*.12,rz*.2,Math.sin(i)*.08);
  }
  if (cut === 'box_braids') {
    for(const side of [-1,1]) for(let row=0;row<4;row++) for(let i=0;i<4;i++) {
      const x=center.x+side*rx*(.34+i*.16), y=top-h*(.18+row*.17), z=center.z-rz*(.25+i*.14);
      ellipsoid(strands,x,y,z,rx*.085,h*.13,rz*.085,side*(i%2?.08:-.08));
    }
  }
  if (cut === 'cornrows') {
    for(let lane=-3;lane<=3;lane++) for(let i=0;i<6;i++) {
      ellipsoid(strands,center.x+lane*rx*.19,top-h*(.035+i*.028),center.z+rz*(.42-i*.25),rx*.075,h*.035,rz*.13,lane*.025);
    }
  }
  if (cut === 'locs_short' || cut === 'locs_long') {
    const rows=cut==='locs_long'?6:3;
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/11, x=center.x+Math.cos(a)*rx*.86, z=center.z-Math.sin(a)*rz*.82;
      for(let row=0;row<rows;row++) ellipsoid(strands,x+Math.sin(i+row)*rx*.025,top-h*(.18+row*.11),z,rx*.07,h*.09,rz*.07,Math.sin(i*.7)*.08);
    }
  }
  if (cut === 'messy_bun') {
    ellipsoid(strands,center.x,top+h*.03,center.z-rz*.28,rx*.36,h*.13,rz*.35);
    for(let i=0;i<7;i++) {
      const a=i*Math.PI*2/7;
      ellipsoid(strands,center.x+Math.cos(a)*rx*.28,top+h*(.04+Math.sin(i)*.02),center.z-rz*.28+Math.sin(a)*rz*.22,rx*.15,h*.075,rz*.15,Math.sin(i)*.2);
    }
  }
  if (cut === 'space_buns') for(const side of [-1,1]) {
    ellipsoid(strands,center.x+side*rx*.58,top+h*.005,center.z-rz*.16,rx*.28,h*.13,rz*.27,side*.08);
  }
  if (cut === 'afro') {
    for(let row=0;row<4;row++) for(let i=0;i<12;i++) {
      const phi=(row+1)*Math.PI/7, a=i*Math.PI/6+row*.13;
      ellipsoid(strands,center.x+Math.cos(a)*Math.sin(phi)*rx*1.02,top-h*.03+Math.cos(phi)*h*.18,center.z+Math.sin(a)*Math.sin(phi)*rz*.98,rx*.22,h*.1,rz*.21);
    }
  }
  if (cut === 'afro_puffs') for(const side of [-1,1]) {
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4;
      ellipsoid(strands,center.x+side*rx*(.76+Math.cos(a)*.18),top-h*.03+Math.sin(a)*h*.11,center.z-rz*.2+Math.cos(a)*rz*.12,rx*.19,h*.09,rz*.18);
    }
  }
  if ((quality === 'high' || quality === 'ultra' || quality === 'cinematic') && ['long','layered_long','long_waves','shoulder','ponytail','high_ponytail','side_braid','twin_ponytails','mullet'].includes(cut)) {
    const flyawayCount = quality === 'cinematic' ? 12 : quality === 'ultra' ? 8 : 4;
    for (let i = 0; i < flyawayCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const phase = i * 1.37;
      const start = new T.Vector3(
        center.x + side * rx * (.72 + (i % 3) * .08),
        top - h * (.18 + (i % 4) * .07),
        center.z - rz * (.30 + (i % 3) * .15),
      );
      const end = start.clone().add(new T.Vector3(
        side * rx * (.10 + .025 * Math.sin(phase)),
        -h * (.16 + .025 * Math.cos(phase)),
        -rz * (.04 + .02 * Math.sin(phase * .7)),
      ));
      const middle = start.clone().lerp(end, .5).add(new T.Vector3(side * rx * .045, h * .018, rz * .015));
      const curve = new T.CatmullRomCurve3([start, middle, end]);
      const strand = new T.TubeGeometry(curve, quality === 'cinematic' ? 18 : quality === 'ultra' ? 14 : 10, rx * (quality === 'cinematic' ? .0105 : quality === 'ultra' ? .012 : .014), 5, false).toNonIndexed();
      strands.push(strand);
    }
  }

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
    const material = quality === 'crowd'
      ? new T.MeshStandardMaterial({ color, roughness: .9, side: T.DoubleSide })
      : new T.MeshPhysicalMaterial({
          color,
          roughness: quality === 'cinematic' ? .44 : quality === 'ultra' ? .48 : quality === 'high' ? .54 : .62,
          metalness: 0,
          sheen: quality === 'cinematic' ? .58 : quality === 'ultra' ? .5 : .35,
          sheenRoughness: .72,
          sheenColor: new T.Color(color).lerp(new T.Color('#ffffff'), .08),
          side: T.DoubleSide,
        });
    material.name=name;
    if (material instanceof T.MeshPhysicalMaterial && quality !== 'crowd') {
      material.anisotropy = quality === 'cinematic' ? .82 : quality === 'ultra' ? .7 : quality === 'high' ? .5 : .28;
      material.anisotropyRotation = 0;
    }
    applyAvatarHairQuality(material, quality, hairTextureCache);
    if(facial==='stubble'&&name==='FacialHair') {
      const stubbleSize = quality === 'cinematic' ? 512 : quality === 'ultra' ? 256 : quality === 'high' ? 128 : 64;
      const data=new Uint8Array(stubbleSize*stubbleSize*4);
      for(let i=0;i<stubbleSize*stubbleSize;i++){
        data[i*4]=data[i*4+1]=data[i*4+2]=255;
        data[i*4+3]=(i*31+Math.floor(i/stubbleSize)*17)%11<4?255:0;
      }
      const texture=new T.DataTexture(data,stubbleSize,stubbleSize);
      texture.minFilter=T.LinearMipmapLinearFilter;
      texture.magFilter=T.LinearFilter;
      texture.generateMipmaps=true;
      texture.anisotropy=profile.anisotropy;
      texture.needsUpdate=true;
      material.map=texture;
      material.transparent=true;
      material.alphaTest=.42;
    }
    const mesh=new T.Mesh(geometry,material);mesh.name=name==='Hair'?'avatar-hairstyle':'avatar-facial-hair';mesh.castShadow=true;anchor.add(mesh);
  };
  add(strands,'Hair',appearance.head.hair);add(beard,'FacialHair',appearance.head.facialHairColor??appearance.head.hair);
  root.add(anchor); root.updateMatrixWorld(true); head.attach(anchor); root.updateMatrixWorld(true);
}
