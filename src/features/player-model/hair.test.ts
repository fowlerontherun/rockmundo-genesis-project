// @vitest-environment node
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { assemblePlayerModel, disposeModel, requiredModelFiles, type ModelLibrary } from './model';
import { appearanceSchema, defaultAppearance, resolveAppearance, STYLES, HAIR_STYLES, FACIAL_HAIR_STYLES, modelFile } from './appearance';
import { Musician } from '@/features/gig-demo-3d/performers';

const library: ModelLibrary = new Map();
beforeAll(async () => {
  for (const frame of ['masculine', 'feminine'] as const) for (const style of STYLES) {
    const file=modelFile(frame,style),data=readFileSync(`public/gig-demo-3d/${file}`);
    library.set(file,(await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength) as ArrayBuffer,'')).scene);
  }
});
describe('hairstyles and facial hair', () => {
  it.each(['masculine','feminine'] as const)('renders every cut and beard on the %s head and follows animation', frame => {
    for(const hairStyle of HAIR_STYLES) for(const facialHair of FACIAL_HAIR_STYLES) {
      const a=defaultAppearance();a.body.frame=frame;a.head={...a.head,hairStyle,facialHair,hair:'#426baa',facialHairColor:'#b75e32'};
      expect(resolveAppearance(JSON.parse(JSON.stringify(a)))).toEqual(a);
      const assembled=assemblePlayerModel(library,a);
      if(hairStyle!=='original') expect(requiredModelFiles([a])).toContain(modelFile(frame,'casual'));
      const hair=assembled.getObjectByName('avatar-hairstyle') as T.Mesh | undefined,beard=assembled.getObjectByName('avatar-facial-hair') as T.Mesh | undefined;
      expect(!!hair).toBe(!['original','bald'].includes(hairStyle)); expect(!!beard).toBe(facialHair!=='none');
      if(hair) expect((hair.material as T.MeshStandardMaterial).color.getHexString()).toBe('426baa');
      if(beard) expect((beard.material as T.MeshStandardMaterial).color.getHexString()).toBe('b75e32');
      if(hair||beard) expect(assembled.getObjectByName('avatar-head-details')!.parent?.name).toBe('Head');
      const actor=new Musician(assembled,'vocals',[0,0,0],0,undefined,a);disposeModel(assembled);
      actor.update(.1,.8,false);const detail=actor.model.getObjectByName('avatar-head-details');
      if(detail) {
        const head=actor.bones.get('Head')!,relative=()=>head.matrixWorld.clone().invert().multiply(detail.matrixWorld).elements;
        const before=relative();actor.update(4,.8,false);relative().forEach((value,i)=>expect(value).toBeCloseTo(before[i],5));
      }
      const bounds=new T.Box3().setFromObject(actor.root);expect(bounds.max.y).toBeLessThan(2.2);expect(bounds.min.y).toBeGreaterThan(-.1);
      disposeModel(actor.root);
    }
  });
  it('keeps every procedural feminine hairstyle closed across the crown', () => {
    for(const hairStyle of HAIR_STYLES.filter(style => !['original','bald'].includes(style))) {
      const a=defaultAppearance();a.body.frame='feminine';a.head={...a.head,hairStyle,facialHair:'none'};
      const assembled=assemblePlayerModel(library,a);
      const anchor=assembled.getObjectByName('avatar-head-details')!;
      const hair=assembled.getObjectByName('avatar-hairstyle') as T.Mesh;
      const faceBounds=anchor.userData.faceBounds as { min:number[]; max:number[] };
      const hairBounds=new T.Box3().setFromObject(hair);
      const faceWidth=faceBounds.max[0]-faceBounds.min[0];
      expect(hairBounds.max.y).toBeGreaterThanOrEqual(faceBounds.max[1]-.005);
      expect(hairBounds.max.x-hairBounds.min.x).toBeGreaterThan(faceWidth*.8);
      disposeModel(assembled);
    }
  });
  it('preserves legacy appearances and rejects unknown or malformed new fields', () => {
    const legacy=defaultAppearance();expect(resolveAppearance(legacy)).toEqual(legacy);
    for(const [key,value] of [['hairStyle','premium'],['facialHair','https://invalid'],['facialHairColor','red'],['hairStyle',null],['other',true]] as const) expect(appearanceSchema.safeParse({...legacy,head:{...legacy.head,[key]:value}}).success).toBe(false);
  });
});
