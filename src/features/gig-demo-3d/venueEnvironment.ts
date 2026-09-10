import { venueArchitecture } from './venueArchitecture';
import * as T from 'three';
import { buildVenueAudience } from './venueAudience';
import { box, cylinder, rod, matte, metal, batchStaticMeshes } from './stage';
import { seededRandom } from './config';
import type { VenueProfile } from './venueProfile';

/** Architecture surrounds the human-scale performance area. Detail is batched
 * by material; distant spectators use bounded instance batches for standing and seated people. */
export function buildVenueEnvironment(scene: T.Scene, p: VenueProfile, seed: number, wood: T.Material, brick: T.Material) {
  const root = new T.Group(); root.name = `environment-${p.kind}`; root.userData.profile = p; scene.add(root);
  const random = seededRandom(seed), half = p.roomWidth / 2, back = .65 - p.stageDepth - 1.4;
  const dark = matte('#141b24'), stone = matte('#67696b'), concrete = matte('#383e46'), grass = matte('#344c39'), sand = matte('#9d8b68');
  const accent = matte(p.accent), steel = metal('#64717c'), brass = metal('#a88b54'), pale = matte('#c6c1b2'), glass = new T.MeshStandardMaterial({ color: '#83a5ba', metalness: .45, roughness: .24 });
  const glow = new T.MeshStandardMaterial({ color: '#ffd9a4', emissive: '#ffd09b', emissiveIntensity: 1.8 });
  const led = new T.MeshStandardMaterial({ color: p.accent, emissive: p.accent, emissiveIntensity: .7 });
  const outdoorGround = p.kind === 'beach_stage' ? sand : ['festival_stage','amphitheatre','park_bandstand'].includes(p.kind) ? grass : concrete;
  box(root, [p.roomWidth + 12, .15, p.roomDepth + p.stageDepth + 8], [0, -.12, (p.roomDepth + back) / 2], p.outdoor ? outdoorGround : ['concert_hall','church_hall','jazz_lounge'].includes(p.kind) ? wood : concrete);
  const wallMat = p.kind === 'concert_hall' || p.kind === 'church_hall' ? wood : p.kind === 'warehouse' ? concrete : brick;
  if (!p.outdoor && p.kind !== 'festival_tent') {
    box(root, [p.roomWidth, p.roofHeight, .3], [0, p.roofHeight / 2, back], wallMat);
    for (const side of [-1, 1]) box(root, [.25, p.roofHeight, p.roomDepth - back], [side * half, p.roofHeight / 2, (p.roomDepth + back) / 2], wallMat);
    if (p.kind !== 'church_hall') box(root, [p.roomWidth, .2, p.roomDepth - back], [0, p.roofHeight, (p.roomDepth + back) / 2], dark);
  } else {
    const sky = new T.Mesh(new T.SphereGeometry(180, 24, 12), new T.MeshBasicMaterial({ color: p.kind === 'beach_stage' ? '#1a2c3e' : '#090e18', side: T.BackSide })); sky.position.y = 20; root.add(sky);
  }
  const lamp = (x: number, z: number, h = 4) => { rod(root, [x,0,z],[x,h,z],.045,steel); box(root,[.32,.12,.32],[x,h,z],glow); };
  const tree = (x: number, z: number, palm = false) => {
    const h = p.kind === 'cafe_stage' ? 1.2 : palm ? 6 : 4 + random() * 2; cylinder(root,.13,.23,h,[x,h/2,z],wood,8);
    if (palm) for(let i=0;i<6;i++) { const leaf = new T.Mesh(new T.SphereGeometry(1,8,4),grass); leaf.scale.set(2.6,.09,.45); leaf.rotation.y=i*Math.PI/3; leaf.position.set(x+Math.cos(i*Math.PI/3),h,z+Math.sin(i*Math.PI/3)); root.add(leaf); }
    else { const crown = new T.Mesh(new T.IcosahedronGeometry(p.kind === 'cafe_stage' ? .5 : 1.5,1),grass); crown.scale.y=1.3; crown.position.set(x,h,z); root.add(crown); }
  };
  const table = (x: number, z: number) => { cylinder(root,.58,.58,.09,[x,.76,z],wood,20); cylinder(root,.065,.065,.73,[x,.36,z],steel,8); for(const dx of [-.83,.83]) { cylinder(root,.24,.24,.1,[x+dx,.46,z],accent,12); rod(root,[x+dx,0,z],[x+dx,.42,z],.045,steel); } cylinder(root,.045,.045,.11,[x,.86,z],glow,8); };
  const bar = (x: number, z: number) => { box(root,[1.2,1.05,5],[x,.525,z],wood); box(root,[1.4,.12,5.2],[x,1.1,z],dark); for(let i=0;i<8;i++) { cylinder(root,.04,.04,.25,[x,1.27,z-2+i*.5],i%2?grass:brass,8); } };
  const screen = (x: number, y: number, z: number, width: number, height: number) => {
    box(root,[width+.3,height+.3,.22],[x,y,z],dark); box(root,[width,height,.025],[x,y,z+.13],led);
    for(let i=0;i<9;i++) box(root,[width/16,.08+height*(.15+random()*.65),.015],[x-width*.43+i*width*.105,y,z+.15],glow);
  };
  // Intimate hospitality venues retain clear central standing areas and side seating.
  if (['cafe_stage','jazz_lounge','dive_bar','university_union','rock_club','live_house'].includes(p.kind)) {
    bar(-half+1.2,5);
    if (['cafe_stage','jazz_lounge'].includes(p.kind)) for(const side of [-1,1]) for(let z=3;z<Math.min(p.roomDepth-2,15);z+=3.3) table(side*(half-2),z);
    if (p.kind === 'cafe_stage') { box(root,[2,1.2,.1],[half-1.4,2.3,back+.2],dark); for(let z=3;z<12;z+=4) tree(half-1,z); }
    if (p.kind === 'jazz_lounge') for(const side of [-1,1]) for(let z=0;z<17;z+=3) { box(root,[.18,2.5,.18],[side*(half-.3),2,z],brass); lamp(side*(half-.6),z,2.8); }
    if (['rock_club','dive_bar','university_union'].includes(p.kind)) for(let i=0;i<6;i++) { const poster=box(root,[.03,1.1,.75],[half-.15,2.2,1+i*2.2],i%2?accent:pale); poster.rotation.x=(random()-.5)*.12; }
    if (p.kind === 'live_house') for(const side of [-1,1]) screen(side*(p.stageWidth/2+.6),p.stageHeight+2.3,back+.2,1,3.5);
    if (p.kind === 'university_union') for(let i=0;i<9;i++) { const flag=new T.Mesh(new T.ConeGeometry(.25,.5,3),i%2?accent:pale); flag.position.set(-half+2+i*(p.roomWidth-4)/8,p.roofHeight-.6,3); flag.rotation.z=Math.PI; root.add(flag); }
  }
  if (p.kind === 'warehouse') {
    for(let z=back+1;z<p.roomDepth;z+=6) { rod(root,[-half+.3,p.roofHeight-.5,z],[half-.3,p.roofHeight-.5,z],.12,steel); for(const side of [-1,1]) rod(root,[side*(half-.4),0,z],[side*(half-.4),p.roofHeight,z],.12,steel); }
    for(const side of [-1,1]) { box(root,[2.2,2.4,5],[side*(half-1.4),1.2,7],accent); for(let z=4.5;z<9.5;z+=.25) box(root,[.04,2.4,.035],[side*(half-2.55),1.2,z],steel); }
  }
  if (p.kind === 'church_hall') {
    for(const side of [-1,1]) { const roof=box(root,[half+1,.2,p.roomDepth-back],[side*half/2,p.roofHeight+.8,(p.roomDepth+back)/2],wood); roof.rotation.z=-side*.25;
      for(let z=1;z<p.roomDepth-2;z+=4) { box(root,[.08,2.5,1.2],[side*(half-.15),2.8,z],glass); rod(root,[side*(half-.2),1.5,z],[side*(half-.2),4.1,z],.035,brass); } }
  }
  if (['theatre','concert_hall'].includes(p.kind)) {
    for(const side of [-1,1]) {
      box(root,[.7,p.rigHeight+1,.65],[side*(p.stageWidth/2+.5),(p.rigHeight+1)/2,.8],p.kind==='theatre'?brass:wood);
      if(p.kind==='concert_hall') for(let z=0;z<p.roomDepth;z+=1.5) box(root,[.45,3,.2],[side*(half-.3),3,z],wood);
      else { box(root,[2,.3,p.roomDepth*.65],[side*(half-1),4,p.roomDepth*.4],accent); rod(root,[side*(half-2),4.8,2],[side*(half-2),4.8,p.roomDepth*.72],.045,brass); }
    }
    box(root,[p.stageWidth+1.8,.55,.6],[0,p.rigHeight+.55,.8],p.kind==='theatre'?brass:wood);
  }
  if (p.kind === 'park_bandstand') {
    const roof=new T.Mesh(new T.ConeGeometry(p.stageWidth*.72,2,8),accent); roof.scale.z=p.stageDepth/p.stageWidth; roof.position.set(0,p.rigHeight+.5,.65-p.stageDepth/2); root.add(roof);
    for(const side of [-1,1]) for(const z of [.5,.9-p.stageDepth]) rod(root,[side*p.stageWidth*.49,0,z],[side*p.stageWidth*.49,p.rigHeight,z],.09,pale);
  }
  if (['park_bandstand','beach_stage','amphitheatre','festival_stage'].includes(p.kind)) for(const side of [-1,1]) for(let i=0;i<5;i++) tree(side*(half+2+random()*3),5+i*p.roomDepth/5,p.kind==='beach_stage');
  if (p.kind === 'beach_stage') box(root,[150,.08,40],[0,-.04,p.roomDepth+24],new T.MeshStandardMaterial({color:'#365e72',metalness:.55,roughness:.18}));
  if (['street_corner','city_square','rooftop_terrace'].includes(p.kind)) {
    for(const side of [-1,1]) for(let i=0;i<7;i++) { const h=p.kind==='rooftop_terrace'?7+random()*20:5+random()*6, x=side*(half+4+random()*3),z=back+i*7; box(root,[5,h,5],[x,h/2- (p.kind==='rooftop_terrace'?6:0),z],concrete); for(let y=1;y<h;y+=2) for(const dx of [-1.3,1.3]) box(root,[.65,.9,.04],[x+dx,y-(p.kind==='rooftop_terrace'?6:0),z+2.53],random()>.3?glow:glass); }
    for(const side of [-1,1]) for(let z=3;z<p.roomDepth;z+=7) lamp(side*(half-1),z);
    if(p.kind==='rooftop_terrace') { for(const side of [-1,1]) { box(root,[.35,1.2,p.roomDepth-back],[side*half,.6,(p.roomDepth+back)/2],stone); for(let z=2;z<p.roomDepth;z+=4) { box(root,[.7,.5,.9],[side*(half-1),.25,z],wood); tree(side*(half-1),z); } } box(root,[p.roomWidth,1.2,.3],[0,.6,p.roomDepth],stone); }
    if(p.kind==='city_square') { cylinder(root,1.5,1.8,.5,[half-3,.25,9],stone); cylinder(root,.35,.65,5,[half-3,3,9],pale); }
    if(p.kind==='street_corner') { box(root,[p.roomWidth+10,.1,3],[0,-.01,p.roomDepth-1],dark); for(let x=-half;x<half;x+=2) box(root,[1,.015,.1],[x,.05,p.roomDepth-1],pale); box(root,[.9,.12,.45],[p.stageWidth*.3,.12,1.3],dark); }
  }
  if (p.kind === 'ice_arena') { for(const side of [-1,1]) { box(root,[.16,1.1,p.crowdDepth+3],[side*(p.crowdWidth/2+.7),.55,p.crowdDepth/2+2],pale); box(root,[.08,.09,p.crowdDepth+3],[side*(p.crowdWidth/2+.7),1.14,p.crowdDepth/2+2],accent); } }
  if (p.production === 'touring') {

    box(root,[4,2,3],[0,1,p.crowdDepth+4],dark); box(root,[4.4,.15,3.5],[0,2.1,p.crowdDepth+4],accent);
    for(const side of [-1,1]) for(let z=2;z<p.crowdDepth;z+=2.5) { rod(root,[side*(p.crowdWidth/2+1),.1,z],[side*(p.crowdWidth/2+1),1.1,z],.035,steel); rod(root,[side*(p.crowdWidth/2+1),1.1,z],[side*(p.crowdWidth/2+1),1.1,z+2.5],.035,steel); }
  }
  if (['festival_stage','beach_stage'].includes(p.kind)) { box(root,[p.stageWidth+1.5,.25,p.stageDepth+1],[0,p.rigHeight+.25,.65-p.stageDepth/2],dark); for(const side of [-1,1]) { const tent=new T.Mesh(new T.ConeGeometry(2.5,1.6,4),accent); tent.rotation.y=Math.PI/4; tent.position.set(side*(half-3),3,12); root.add(tent); box(root,[3.5,1,2],[side*(half-3),.5,12],wood); } }
  const places: [number,number,number,number][] = [];
  if (p.seating) {
    const seat = matte(p.kind === 'theatre' ? '#742f40' : '#344d69');
    if(p.kind==='amphitheatre') {
      for(let row=0;row<p.seatRows;row++) { const radius=p.crowdDepth*.45+row*1.3, y=.35+row*.55; const tier=new T.Mesh(new T.TorusGeometry(radius,.42,4,64,Math.PI*.8),stone); tier.rotation.x=Math.PI/2; tier.rotation.z=Math.PI*.1; tier.position.set(0,y,2); root.add(tier); for(let i=0;i<40;i++){const a=Math.PI*.1+i/39*Math.PI*.8;places.push([Math.cos(a)*radius,y+.35,2+Math.sin(a)*radius,Math.PI-a+Math.PI/2]);} }
    } else for(const side of [-1,1]) for(let row=0;row<p.seatRows;row++) {
      const x=side*(p.crowdWidth/2+2+row*.85), y=.3+row*.48;
      box(root,[.9,.38,p.crowdDepth+4],[x,y,p.crowdDepth/2+2],concrete);
      for(let z=2;z<p.crowdDepth+3;z+=1.1) { box(root,[.65,.12,.65],[x,y+.28,z],seat); box(root,[.1,.55,.65],[x+side*.3,y+.5,z],seat); places.push([x,y+.4,z,side*Math.PI/2]); }
    }
    if(p.kind!=='amphitheatre') for(let row=0;row<p.seatRows;row++) { const z=p.crowdDepth+6+row*.9,y=.3+row*.48; box(root,[p.crowdWidth+3,.4,.9],[0,y,z],concrete); for(let x=-p.crowdWidth/2;x<=p.crowdWidth/2;x+=.85) { box(root,[.65,.55,.12],[x,y+.6,z+.3],seat); places.push([x,y+.4,z,Math.PI]); } }
    if(p.kind==='stadium') { for(const side of [-1,1]) for(let z=0;z<p.roomDepth;z+=8) { rod(root,[side*half,4,z],[side*half,9,z],.055,steel); box(root,[1.4,.8,.03],[side*half+.7,8.5,z],accent); } screen(0,11,p.crowdDepth+10,8,3); }
  }
  venueArchitecture(root,p,wood);
  batchStaticMeshes(root);
  buildVenueAudience(root,p,seed,places);
  return root;
}
