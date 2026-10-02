// @vitest-environment node
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { assemblePlayerModel, disposeModel, type ModelLibrary } from './model';
import { appearanceSchema, defaultAppearance, resolveAppearance, STYLES, modelFile, SLOTS, STARTER_ITEMS, resolveAppearance as roundTrip } from './appearance';
import { Musician } from '@/features/gig-demo-3d/performers';

const library: ModelLibrary = new Map();
beforeAll(async () => {
  for (const frame of ['masculine', 'feminine'] as const) for (const style of STYLES) {
    const file = modelFile(frame, style), data = readFileSync(`public/gig-demo-3d/${file}`);
    library.set(file, (await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, '')).scene);
  }
});

describe('shipped modular stage models', () => {
  it.each(['masculine', 'feminine'] as const)('assembles every %s starter outfit with correctly bound and scaled parts', frame => {
    for (const head of STYLES) for (const top of STYLES) for (const bottom of STYLES) for (const footwear of STYLES) {
      const appearance = defaultAppearance(); appearance.body.frame = frame; appearance.head.style = head;
      appearance.equipment.top.itemId = `starter.top.${top}`; appearance.equipment.bottom.itemId = `starter.bottom.${bottom}`; appearance.equipment.footwear.itemId = `starter.footwear.${footwear}`;
      const model = assemblePlayerModel(library, appearance);
      const boneNames: string[] = []; model.traverse(node => { if (node instanceof T.Bone) boneNames.push(node.name); });
      expect(new Set(boneNames).size).toBe(boneNames.length);
      const parts = new Set<string>(); let skinVertices = 0;
      model.traverse(node => {
        if (!(node instanceof T.SkinnedMesh)) return;
        let parent: T.Object3D | null = node; while (parent && !/_(Body|Head|Legs|Feet)/i.test(parent.name)) parent = parent.parent;
        expect(parent).not.toBeNull(); parts.add(parent!.name.match(/_(Body|Head|Legs|Feet)/i)![1].toLowerCase());
        node.skeleton.update();
        for (let i = 0; i < node.geometry.attributes.position.count; i += 61) {
          const vertex = node.getVertexPosition(i, new T.Vector3()).applyMatrix4(node.matrixWorld);
          expect(vertex.toArray().every(Number.isFinite)).toBe(true);
          expect(vertex.length()).toBeLessThan(3); skinVertices++;
        }
      });
      expect([...parts].sort()).toEqual(['body', 'feet', 'head', 'legs']); expect(skinVertices).toBeGreaterThan(20);
      const bounds = new T.Box3().setFromObject(model);
      expect(bounds.max.y - bounds.min.y).toBeGreaterThan(1.5); expect(bounds.max.y - bounds.min.y).toBeLessThan(2.2);
      disposeModel(model);
    }
  });
  it.each(['masculine', 'feminine'] as const)('keeps %s hands on the guitar after customisation, walking and seeking backwards', frame => {
    const appearance = defaultAppearance(); appearance.body = { ...appearance.body, frame, height: 1.1, build: .85 }; appearance.head.style = 'punk'; appearance.equipment.top.itemId = 'starter.top.suit';
    const source = assemblePlayerModel(library, appearance), actor = new Musician(source, 'guitar', [0, 0, 0], 0, undefined, appearance); disposeModel(source);
    const instrument = actor.root.getObjectByName('instrument')!;
    for (const time of [0, 12, 37, 4, 20]) {
      actor.walking = time === 12; actor.update(time, .8, false);
      const hand = actor.bones.get('Hand.L')!.getWorldPosition(new T.Vector3());
      const localHand = instrument.worldToLocal(hand);
      expect(Math.abs(localHand.x)).toBeLessThan(.1); expect(localHand.y).toBeGreaterThan(.5); expect(localHand.y).toBeLessThan(.9);
      const bounds = new T.Box3().setFromObject(actor.root); expect(bounds.max.y).toBeLessThan(2.8); expect(bounds.min.y).toBeGreaterThan(-.25);
    }
    actor.walking = false; actor.update(4, .8, false); const first = actor.bones.get('Head')!.matrixWorld.toArray(); actor.update(90, .8, false); actor.update(4, .8, false); expect(actor.bones.get('Head')!.matrixWorld.toArray()).toEqual(first);
    disposeModel(actor.root);
  });
  it.each(['masculine', 'feminine'] as const)('assembles %s hats, glasses, earrings and owned tattoo visuals on the animated rig', frame => {
    const appearance = defaultAppearance();
    appearance.body.frame = frame;
    appearance.accessories = { hat: 'beanie', hatColor: '#bd3548', glasses: 'round', glassesColor: '#d8ad49', earrings: 'hoops', earringColor: '#d8ad49' };
    const tattoos = [{
      id: 'tattoo-visual-1', profile_id: 'profile-1', body_slot: 'left_upper_arm' as const,
      ink_color: '#18202b', quality_score: 88, is_infected: false, category: 'musical' as const,
    }];
    expect(roundTrip(JSON.parse(JSON.stringify(appearance)))).toEqual(appearance);
    const model = assemblePlayerModel(library, appearance, tattoos);
    expect(model.getObjectByName('avatar-hat-beanie')).toBeTruthy();
    expect(model.getObjectByName('avatar-glasses-round')).toBeTruthy();
    expect(model.getObjectByName('avatar-earrings-hoops')).toBeTruthy();
    expect(model.getObjectByName('avatar-tattoo-tattoo-visual-1')).toBeTruthy();
    const actor = new Musician(model, 'vocals', [0, 0, 0], 0, undefined, appearance);
    actor.update(8, .75, false);
    expect(actor.root.getObjectByName('avatar-hat-beanie')).toBeTruthy();
    expect(actor.root.getObjectByName('avatar-glasses-round')).toBeTruthy();
    expect(actor.root.getObjectByName('avatar-earrings-hoops')).toBeTruthy();
    expect(actor.root.getObjectByName('avatar-tattoo-tattoo-visual-1')).toBeTruthy();
    disposeModel(model); disposeModel(actor.root);
  });
  it.each(['masculine', 'feminine'] as const)('renders detailed %s face choices on the same animated Head rig', frame => {
    const appearance = defaultAppearance();
    appearance.body.frame = frame;
    appearance.head.faceShape = 'angular';
    appearance.head.eyeColor = '#4f755a';
    appearance.head.eyebrowStyle = 'arched';
    appearance.head.eyebrowColor = '#854b32';
    appearance.head.skinDetail = 'freckles';
    const model = assemblePlayerModel(library, appearance);
    const head = model.getObjectByName('Head') as T.Bone;
    expect(head?.userData.avatarFaceShape).toBe('angular');
    expect(model.getObjectByName('avatar-face-details')).toBeTruthy();
    expect(model.getObjectByName('avatar-eyebrow-left')).toBeTruthy();
    expect(model.getObjectByName('avatar-eyebrow-right')).toBeTruthy();
    expect(model.getObjectByName('avatar-freckle-0')).toBeTruthy();
    const actor = new Musician(model, 'vocals', [0, 0, 0], 0, undefined, appearance);
    actor.update(7, .75, false);
    expect(actor.root.getObjectByName('avatar-face-details')).toBeTruthy();
    expect(actor.root.getObjectByName('avatar-eyebrow-left')).toBeTruthy();
    expect(actor.root.getObjectByName('avatar-freckle-0')).toBeTruthy();
    disposeModel(model); disposeModel(actor.root);
  });
  it.each(['masculine', 'feminine'] as const)('renders %s stomach, thigh and calf catalogue tattoos', frame => {
    const appearance = defaultAppearance(); appearance.body.frame = frame;
    const tattoos = [
      { id: 'stomach', profile_id: 'profile-1', body_slot: 'stomach' as const, ink_color: '#101010', quality_score: 95, is_infected: false, category: 'blackwork' as const },
      { id: 'thigh', profile_id: 'profile-1', body_slot: 'right_thigh' as const, ink_color: '#111111', quality_score: 83, is_infected: false, category: 'realism' as const },
      { id: 'calf', profile_id: 'profile-1', body_slot: 'left_calf' as const, ink_color: '#222222', quality_score: 78, is_infected: false, category: 'fine_line' as const },
    ];
    const model = assemblePlayerModel(library, appearance, tattoos);
    for (const tattoo of tattoos) expect(model.getObjectByName(`avatar-tattoo-${tattoo.id}`)).toBeTruthy();
    const actor = new Musician(model, 'vocals', [0, 0, 0], 0, undefined, appearance);
    actor.update(5, .6, false);
    for (const tattoo of tattoos) expect(actor.root.getObjectByName(`avatar-tattoo-${tattoo.id}`)).toBeTruthy();
    disposeModel(model); disposeModel(actor.root);
  });

  it.each(['masculine', 'feminine'] as const)('renders the %s topless option from the real skinned body instead of a transparent fake shirt', frame => {
    const appearance = defaultAppearance('topless');
    appearance.body.frame = frame;
    appearance.equipment.top.itemId = 'starter.top.topless';
    const model = assemblePlayerModel(library, appearance);
    let visibleSkin = 0;
    let hiddenGarment = 0;
    model.traverse(node => {
      if (!(node instanceof T.Mesh) || !/Body/i.test(node.name + node.parent?.name)) return;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (/skin/i.test(material.name) && material.visible !== false) visibleSkin += 1;
        if (!/skin/i.test(material.name) && material.visible === false) hiddenGarment += 1;
      }
    });
    expect(visibleSkin).toBeGreaterThan(0);
    expect(hiddenGarment).toBeGreaterThan(0);
    expect(model.getObjectByName('avatar-v1-skin-underlay-torso')).toBeTruthy();
    for (const side of ['l', 'r']) {
      expect(model.getObjectByName(`avatar-v1-skin-underlay-upper-arm-${side}`)).toBeTruthy();
      expect(model.getObjectByName(`avatar-v1-skin-underlay-lower-arm-${side}`)).toBeTruthy();
      expect(model.getObjectByName(`avatar-v1-skin-underlay-elbow-${side}`)).toBeTruthy();
    }
    expect(model.userData.rockmundoAvatarPresentation).toBe('stage');
    disposeModel(model);
  });

  it.each(['masculine', 'feminine'] as const)('renders the %s Tattoo Parlour model unclothed without changing the saved outfit', frame => {
    const appearance = defaultAppearance('tattoo-unclothed');
    appearance.body.frame = frame;
    appearance.equipment.top.itemId = 'starter.top.suit';
    appearance.equipment.bottom.itemId = 'starter.bottom.punk';
    const tattoos = [{
      id: 'tattoo-visible', profile_id: 'profile-1', body_slot: 'chest' as const,
      ink_color: '#111111', quality_score: 90, is_infected: false, category: 'blackwork' as const,
    }];
    const model = assemblePlayerModel(library, appearance, tattoos, [], 'balanced', 'tattoo');
    let hiddenClothingMaterials = 0;
    let visibleSkinMaterials = 0;
    model.traverse(node => {
      if (!(node instanceof T.Mesh) || /Head/i.test(node.name + node.parent?.name)) return;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (/skin/i.test(material.name) && material.visible !== false) visibleSkinMaterials += 1;
        if (!/skin/i.test(material.name) && material.visible === false) hiddenClothingMaterials += 1;
      }
    });
    expect(hiddenClothingMaterials).toBeGreaterThan(0);
    expect(visibleSkinMaterials).toBeGreaterThan(0);
    expect(model.getObjectByName('avatar-v1-skin-underlay-torso')).toBeTruthy();
    expect(model.getObjectByName('avatar-v1-skin-underlay-upper-leg-l')).toBeTruthy();
    expect(model.getObjectByName('avatar-tattoo-tattoo-visible')).toBeTruthy();
    expect(model.userData.rockmundoAvatarPresentation).toBe('tattoo');
    expect(appearance.equipment.top.itemId).toBe('starter.top.suit');
    expect(appearance.equipment.bottom.itemId).toBe('starter.bottom.punk');
    disposeModel(model);
  });

  it.each(['masculine', 'feminine'] as const)('uses stable donor-skinned V1 clothing on the %s live avatar', frame => {
    for (const [slot, itemIds] of [
      ['top', ['starter.top.casual','starter.top.v-neck','starter.top.long-sleeve','starter.top.hoodie','starter.top.denim-jacket']],
      ['bottom', ['starter.bottom.denim-shorts','starter.bottom.boxer-briefs','starter.bottom.pleated-skirt','starter.bottom.chinos','starter.bottom.wide-leg']],
    ] as const) {
      for (const itemId of itemIds) {
        const appearance = defaultAppearance(itemId);
        appearance.body.frame = frame;
        appearance.equipment[slot].itemId = itemId;
        const model = assemblePlayerModel(library, appearance);
        let proceduralPieces = 0;
        let visibleDonorMaterials = 0;
        model.traverse(node => {
          if (!(node instanceof T.Mesh)) return;
          if (node.name.startsWith('Starter_Body_') || node.name.startsWith('Starter_Legs_')) proceduralPieces += 1;
          const partName = `${node.name} ${node.parent?.name ?? ''}`;
          if (!new RegExp(slot === 'top' ? 'Body' : 'Legs', 'i').test(partName)) return;
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            if (!/skin/i.test(material.name) && material.visible !== false) visibleDonorMaterials += 1;
          }
        });
        expect(proceduralPieces).toBe(0);
        expect(visibleDonorMaterials).toBeGreaterThan(0);
        disposeModel(model);
      }
    }
  });

  it.each(['masculine', 'feminine'] as const)('polishes the %s Rockmundo tee on the existing skinned donor mesh', frame => {
    const appearance = defaultAppearance('crew-tee-donor-polish');
    appearance.body.frame = frame;
    appearance.equipment.top.itemId = 'starter.top.casual';
    const model = assemblePlayerModel(library, appearance);
    const polished: T.SkinnedMesh[] = [];
    model.traverse(node => {
      if (node instanceof T.SkinnedMesh && node.userData.avatarV1CrewTeePolished) polished.push(node);
      expect(node.name.startsWith('Starter_Body_')).toBe(false);
    });
    expect(polished.length).toBeGreaterThan(0);
    expect(polished.some(mesh => Number(mesh.userData.avatarV1CrewTeeVertexCount) > 20)).toBe(true);
    expect(polished.some(mesh => Number(mesh.userData.avatarV1CrewTeeSleeveVertexCount) > 0)).toBe(true);
    for (const mesh of polished) {
      expect(mesh.skeleton.bones.length).toBeGreaterThan(10);
      expect(mesh.geometry.getAttribute('skinWeight')).toBeTruthy();
      expect(mesh.geometry.getAttribute('skinIndex')).toBeTruthy();
    }
    disposeModel(model);
  });

  it.each(['masculine', 'feminine'] as const)('polishes the %s stable skinned tee family without enabling procedural clothing', frame => {
    for (const itemId of [
      'starter.top.casual',
      'starter.top.stripe',
      'starter.top.plain-black',
      'starter.top.plain-white',
      'starter.top.vintage-charcoal',
      'starter.top.v-neck',
    ] as const) {
      const appearance = defaultAppearance(itemId);
      appearance.body.frame = frame;
      appearance.equipment.top.itemId = itemId;
      const model = assemblePlayerModel(library, appearance);
      const polished: T.SkinnedMesh[] = [];
      model.traverse(node => {
        if (node instanceof T.SkinnedMesh && node.userData.avatarV1CrewTeeVariant === itemId) polished.push(node);
        expect(node.name.startsWith('Starter_Body_')).toBe(false);
      });
      expect(polished.length).toBeGreaterThan(0);
      for (const mesh of polished) {
        expect(mesh.geometry.getAttribute('skinWeight')).toBeTruthy();
        expect(mesh.geometry.getAttribute('skinIndex')).toBeTruthy();
      }
      if (itemId === 'starter.top.v-neck') expect(model.getObjectByName('avatar-v1-v-neck-trim')).toBeTruthy();
      disposeModel(model);
    }
  });

  it.each(['masculine', 'feminine'] as const)('refines the %s stable long-sleeve and outerwear family on the donor rig', frame => {
    for (const [itemId, detail] of [
      ['starter.top.long-sleeve', null],
      ['starter.top.hoodie', null],
      ['starter.top.zip-hoodie', 'avatar-v1-zip-hoodie-zip'],
      ['starter.top.denim-jacket', 'avatar-v1-denim-jacket-seam'],
      ['starter.top.flannel-shirt', 'avatar-v1-flannel-placket'],
    ] as const) {
      const appearance = defaultAppearance(itemId);
      appearance.body.frame = frame;
      appearance.equipment.top.itemId = itemId;
      const model = assemblePlayerModel(library, appearance);
      const polished: T.SkinnedMesh[] = [];
      model.traverse(node => {
        if (node instanceof T.SkinnedMesh && node.userData.avatarV1OuterwearVariant === itemId) polished.push(node);
        expect(node.name.startsWith('Starter_Body_')).toBe(false);
      });
      expect(polished.length).toBeGreaterThan(0);
      expect(polished.some(mesh => Number(mesh.userData.avatarV1OuterwearArmVertexCount) > 0)).toBe(true);
      for (const mesh of polished) {
        expect(mesh.geometry.getAttribute('skinWeight')).toBeTruthy();
        expect(mesh.geometry.getAttribute('skinIndex')).toBeTruthy();
      }
      if (detail) expect(model.getObjectByName(detail)).toBeTruthy();
      disposeModel(model);
    }
  });

  it.each(['masculine', 'feminine'] as const)('refines the %s tank top on the stable skinned donor mesh', frame => {
    const appearance = defaultAppearance('tank-safe');
    appearance.body.frame = frame;
    appearance.equipment.top.itemId = 'starter.top.tank';
    const model = assemblePlayerModel(library, appearance);
    const tanks: T.SkinnedMesh[] = [];
    model.traverse(node => {
      if (node instanceof T.SkinnedMesh && node.userData.avatarV1TankPolished) tanks.push(node);
      expect(node.name.startsWith('Starter_Body_')).toBe(false);
    });
    expect(tanks.length).toBeGreaterThan(0);
    expect(tanks.some(mesh => Number(mesh.userData.avatarV1TankArmVertexCount) > 0)).toBe(true);
    disposeModel(model);
  });

  it.each(['masculine', 'feminine'] as const)('crops %s shorts and underwear from the stable skinned donor geometry', frame => {
    for (const itemId of [
      'starter.bottom.denim-shorts',
      'starter.bottom.cargo-shorts',
      'starter.bottom.athletic-shorts',
      'starter.bottom.boxer-briefs',
      'starter.bottom.briefs',
    ] as const) {
      const appearance = defaultAppearance(itemId);
      appearance.body.frame = frame;
      appearance.equipment.bottom.itemId = itemId;
      const model = assemblePlayerModel(library, appearance);
      const cropped: T.SkinnedMesh[] = [];
      model.traverse(node => {
        if (node instanceof T.SkinnedMesh && node.userData.avatarV1CroppedBottomVariant === itemId) cropped.push(node);
        expect(node.name.startsWith('Starter_Legs_')).toBe(false);
      });
      expect(cropped.length).toBeGreaterThan(0);
      expect(cropped.every(mesh => Number(mesh.userData.avatarV1CroppedBottomIndexCount) > 0)).toBe(true);
      for (const mesh of cropped) {
        expect(mesh.geometry.getAttribute('skinWeight')).toBeTruthy();
        expect(mesh.geometry.getAttribute('skinIndex')).toBeTruthy();
      }
      disposeModel(model);
    }
  });

  it.each(['masculine', 'feminine'] as const)('shapes %s chinos and wide-leg trousers without replacing the donor rig', frame => {
    for (const itemId of ['starter.bottom.chinos', 'starter.bottom.wide-leg'] as const) {
      const appearance = defaultAppearance(itemId);
      appearance.body.frame = frame;
      appearance.equipment.bottom.itemId = itemId;
      const model = assemblePlayerModel(library, appearance);
      const shaped: T.SkinnedMesh[] = [];
      model.traverse(node => {
        if (node instanceof T.SkinnedMesh && node.userData.avatarV1TrouserVariant === itemId) shaped.push(node);
        expect(node.name.startsWith('Starter_Legs_')).toBe(false);
      });
      expect(shaped.length).toBeGreaterThan(0);
      disposeModel(model);
    }
  });

  it.each(['masculine', 'feminine'] as const)('keeps the %s Rockmundo chest print nearly flush to the garment surface', frame => {
    const appearance = defaultAppearance('logo-surface');
    appearance.body.frame = frame;
    appearance.equipment.top.itemId = 'starter.top.casual';
    const model = assemblePlayerModel(library, appearance);
    const logo = model.getObjectByName('avatar-rockmundo-logo');
    expect(logo).toBeTruthy();
    expect(Number(logo?.userData.surfaceOffset)).toBeLessThanOrEqual(.0005);
    expect(logo?.userData.surfaceBound).toBe(true);
    disposeModel(model);
  });

  it.each(['masculine', 'feminine'] as const)('shortens the %s V1 finger chains without removing their animation bones', frame => {
    const appearance = defaultAppearance('hand-proportions');
    appearance.body.frame = frame;
    const model = assemblePlayerModel(library, appearance);
    for (const side of ['L', 'R'] as const) {
      const expected = { Thumb: .94, Index: .955, Middle: .95, Ring: .925, Pinky: .89 } as const;
      for (const [digit, scale] of Object.entries(expected)) {
        const bone = model.getObjectByName(`${digit}1.${side}`) as T.Bone | undefined;
        if (!bone) continue;
        expect(bone.scale.x).toBeCloseTo(scale, 3);
        expect(bone.scale.y).toBeCloseTo(scale, 3);
        expect(bone.scale.z).toBeCloseTo(scale, 3);
        expect(bone.userData.avatarV1FingerScale).toBeCloseTo(scale, 3);
      }
    }
    disposeModel(model);
  });

  it.each(['masculine', 'feminine'] as const)('gives the %s V1 hand a relaxed neutral finger pose', frame => {
    const appearance = defaultAppearance('relaxed-hands');
    appearance.body.frame = frame;
    const model = assemblePlayerModel(library, appearance);
    let adjusted = 0;
    model.traverse(node => {
      if (!(node instanceof T.Bone) || !/^(Index|Middle|Ring|Pinky|Thumb)1[._]?[LR]$/i.test(node.name)) return;
      if (Math.abs(node.rotation.x) > .02) adjusted += 1;
    });
    expect(adjusted).toBeGreaterThanOrEqual(4);
    disposeModel(model);
  });

  it('dyes the feminine casual shirt and keeps skin and eyes independent', () => {
    const appearance = defaultAppearance(); appearance.body.frame = 'feminine'; appearance.equipment.top = { itemId: 'starter.top.casual', color: '#00ff00' }; appearance.body.skin = '#8d5524';
    const model = assemblePlayerModel(library, appearance); const found = new Map<string, string>();
    model.traverse(node => { if (node instanceof T.Mesh && /Body/.test(node.name + node.parent?.name)) for (const material of Array.isArray(node.material) ? node.material : [node.material]) found.set(material.name, (material as T.MeshStandardMaterial).color.getHexString()); });
    expect(found.get('White')).toBe('00ff00'); expect(found.get('Skin')).toBe('8d5524'); disposeModel(model);
  });
  it.each(['masculine', 'feminine'] as const)('moves the visible %s clothing with the IK bones, not an unbound duplicate rig', frame => {
    const appearance = defaultAppearance(); appearance.body.frame = frame; appearance.equipment.top.itemId = 'starter.top.suit';
    const source = assemblePlayerModel(library, appearance), actor = new Musician(source, 'drums', [0, 0, 0], 0, undefined, appearance); disposeModel(source);
    const meshes: T.SkinnedMesh[] = []; actor.model.traverse(node => { if (node instanceof T.SkinnedMesh) meshes.push(node); });
    for (const mesh of meshes) for (const bone of mesh.skeleton.bones) {
      const key = bone.name.replace(/([a-z0-9])([LR])$/, '$1.$2').replace(/_/g, '.').replace(/^Wrist\./, 'Hand.');
      expect(actor.bones.get(key)).toBe(bone);
    }
    const body = meshes.find(mesh => /Body/.test(mesh.name + mesh.parent?.name))!;
    const points = () => { body.skeleton.update(); return Array.from({ length: body.geometry.attributes.position.count }, (_, i) => body.getVertexPosition(i, new T.Vector3()).applyMatrix4(body.matrixWorld)); };
    actor.update(.1, 1, false); const before = points(); actor.update(.32, 1, false); const after = points();
    expect(Math.max(...before.map((point, i) => point.distanceTo(after[i])))).toBeGreaterThan(.02);
    disposeModel(actor.root);
  });
});
describe('appearance boundaries', () => {
  it('upgrades saved appearances without a muscle field to the natural body type', () => {
    const old = defaultAppearance('legacy-muscle');
    delete old.body.muscle;
    const resolved = resolveAppearance(JSON.parse(JSON.stringify(old)), 'legacy-muscle');
    expect(resolved.body.muscle).toBe('natural');
    expect(appearanceSchema.safeParse(old).success).toBe(true);
  });
  it('rejects unknown items, URLs, non-finite dimensions, invalid colours and extra keys', () => {
    for (const edit of [
      (a: ReturnType<typeof defaultAppearance>) => { a.equipment.top.itemId = 'paid.exclusive'; },
      (a: ReturnType<typeof defaultAppearance>) => { a.equipment.top.itemId = 'https://example.com/model.glb'; },
      (a: ReturnType<typeof defaultAppearance>) => { a.body.height = Infinity; },
      (a: ReturnType<typeof defaultAppearance>) => { a.head.hair = 'red'; },
      (a: ReturnType<typeof defaultAppearance>) => { a.accessories!.hat = 'crown' as never; },
      (a: ReturnType<typeof defaultAppearance>) => { a.accessories!.glassesColor = 'transparent'; },
      (a: ReturnType<typeof defaultAppearance>) => { a.accessories!.earrings = 'chains' as never; },
      (a: ReturnType<typeof defaultAppearance>) => { a.head.faceShape = 'triangle' as never; },
      (a: ReturnType<typeof defaultAppearance>) => { a.head.eyebrowStyle = 'zigzag' as never; },
      (a: ReturnType<typeof defaultAppearance>) => { a.head.skinDetail = 'glitter' as never; },
      (a: ReturnType<typeof defaultAppearance>) => { a.head.eyeColor = 'green'; },
      (a: ReturnType<typeof defaultAppearance>) => { a.body.muscle = 'impossible' as never; },
    ]) { const value = defaultAppearance(); edit(value); expect(appearanceSchema.safeParse(value).success).toBe(false); expect(resolveAppearance(value, 'safe')).toEqual(defaultAppearance('safe')); }
    expect(appearanceSchema.safeParse({ ...defaultAppearance(), bonus: 100 }).success).toBe(false);
  });
});

describe('V1 starter clothing safety gate', () => {
  it('only exposes visually verified starter clothing in the live wardrobe', () => {
    expect(starterItemsForWardrobe('top').map(item => item.id)).not.toEqual(expect.arrayContaining([
      'starter.top.hoodie',
      'starter.top.zip-hoodie',
      'starter.top.denim-jacket',
      'starter.top.flannel-shirt',
      'starter.top.long-sleeve',
      'starter.top.tank',
    ]));
    expect(starterItemsForWardrobe('bottom').map(item => item.id)).not.toEqual(expect.arrayContaining([
      'starter.bottom.cargo-shorts',
      'starter.bottom.athletic-shorts',
      'starter.bottom.wide-leg',
      'starter.bottom.pleated-skirt',
      'starter.bottom.mini-skirt',
    ]));
    expect(starterItemsForWardrobe('bottom').map(item => item.id)).toEqual(expect.arrayContaining([
      'starter.bottom.denim-shorts',
      'starter.bottom.boxer-briefs',
      'starter.bottom.briefs',
      'starter.bottom.chinos',
    ]));
  });

  it('keeps previously saved experimental clothing valid but renders a safe donor fallback', () => {
    for (const [savedId, fallbackId] of Object.entries(STARTER_VISUAL_FALLBACKS)) {
      const appearance = defaultAppearance(savedId);
      const slot = savedId.includes('.top.') ? 'top' : 'bottom';
      appearance.equipment[slot].itemId = savedId;
      expect(appearanceSchema.safeParse(appearance).success).toBe(true);
      expect(visualEquipmentItem(appearance, slot).id).toBe(fallbackId);
    }
  });

  it.each(['masculine', 'feminine'] as const)('never injects experimental rigid garments for saved %s avatars', frame => {
    for (const savedId of Object.keys(STARTER_VISUAL_FALLBACKS)) {
      const appearance = defaultAppearance(savedId);
      appearance.body.frame = frame;
      const slot = savedId.includes('.top.') ? 'top' : 'bottom';
      appearance.equipment[slot].itemId = savedId;
      const model = assemblePlayerModel(library, appearance);
      let procedural = 0;
      model.traverse(node => {
        if (node.name.startsWith('Starter_Body_') || node.name.startsWith('Starter_Legs_')) procedural += 1;
      });
      expect(procedural).toBe(0);
      disposeModel(model);
    }
  });
});

describe('expanded starter wardrobe', () => {
  it.each(['masculine', 'feminine'] as const)('renders and preserves the full starter wardrobe on the %s gig rig', frame => {
    const expectedCounts = { top: 17, bottom: 18, footwear: 10 } as const;
    for (const slot of SLOTS) {
      expect(STARTER_ITEMS[slot]).toHaveLength(expectedCounts[slot]);
      expect(new Set(STARTER_ITEMS[slot].map(item => item.id)).size).toBe(STARTER_ITEMS[slot].length);
      for (const item of STARTER_ITEMS[slot]) {
        const appearance = defaultAppearance(); appearance.body.frame = frame;
        appearance.equipment[slot] = { itemId: item.id, color: '#338b8d' };
        expect(roundTrip(JSON.parse(JSON.stringify(appearance)))).toEqual(appearance);
        const assembled = assemblePlayerModel(library, appearance);
        const actor = new Musician(assembled, 'guitar', [0, 0, 0], 0, undefined, appearance);
        if (item.fabric !== 'plain') {
          const maps: T.Texture[] = [], sourceMaps: T.Texture[] = [];
          assembled.traverse(node => { if (node instanceof T.Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) if ((material as T.MeshStandardMaterial).map) sourceMaps.push((material as T.MeshStandardMaterial).map!); });
          actor.model.traverse(node => { if (node instanceof T.Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) { const mat = material as T.MeshStandardMaterial; if (mat.map?.name === `starter-fabric-${item.fabric}`) { maps.push(mat.map); expect(mat.color.getHexString()).toBe('338b8d'); if (item.fabric === 'patent') expect(mat.roughness).toBe(.2); } } });
          expect(maps.length).toBeGreaterThan(0);
          for (const map of maps) expect(sourceMaps).not.toContain(map);
        }
        disposeModel(assembled); actor.update(3, .8, false);
        const bounds = new T.Box3().setFromObject(actor.root); expect(bounds.max.y).toBeLessThan(2.8); expect(bounds.min.y).toBeGreaterThan(-.25);
        disposeModel(actor.root);
      }
    }
  });
});
