import * as T from 'three';
import { defaultAppearance, STARTER_ITEMS, HAIR_COLORS, CLOTHING_COLORS, type PlayerAppearance } from '@/features/player-model/appearance';
import { seededRandom } from './config';
export const CROWD_VARIANTS = 16;
export const CROWD_LIMIT = 160;
const CROWD_HAIR_STYLES = ['original', 'original', 'buzz', 'quiff', 'bob', 'ponytail', 'bun', 'curls', 'long', 'bald'] as const;
const CROWD_FEMININE_HAIR_STYLES = ['original', 'bob', 'shoulder', 'layered_long', 'long_waves', 'ponytail', 'high_ponytail', 'side_braid', 'twin_ponytails', 'bun', 'curls', 'long', 'buzz'] as const;
const CROWD_HAIR_COLORS = HAIR_COLORS.slice(0, 7);
/** Reproducible identities; both body frames and all six starter designs appear in every full crowd. */
export function crowdAppearances(seed: number): PlayerAppearance[] {
    const random = seededRandom(seed), skins = ['#edc7a5', '#d4a373', '#ba8258', '#a96f46', '#8d5524', '#754832', '#593a2d', '#3e2c26'];
    return Array.from({ length: CROWD_VARIANTS }, (_, i) => {
        const a = defaultAppearance(`audience-${seed}-${i}`);
        a.body.frame = i % 2 ? 'feminine' : 'masculine';
        a.body.skin = skins[i % skins.length];
        a.body.height = .91 + random() * .18;
        a.body.build = .87 + random() * .26;
        const hairStyles = a.body.frame === 'feminine' ? CROWD_FEMININE_HAIR_STYLES : CROWD_HAIR_STYLES;
        a.head.hairStyle = hairStyles[Math.floor(random() * hairStyles.length)];
        a.head.hair = CROWD_HAIR_COLORS[(i + Math.floor(random() * 4)) % CROWD_HAIR_COLORS.length][1];
        a.head.facialHair = i % 2 ? 'none' : (['none', 'none', 'stubble', 'moustache', 'goatee', 'short_beard', 'full_beard', 'sideburns'] as const)[Math.floor(random() * 8)];
        for (const [index, slot] of (['top', 'bottom', 'footwear'] as const).entries()) {
            a.equipment[slot].itemId = STARTER_ITEMS[slot][(i + index * 2) % 6].id;
            a.equipment[slot].color = CLOTHING_COLORS[(i * 5 + index * 3) % CLOTHING_COLORS.length][1];
        }
        return a;
    });
}
export type CrowdMotion = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
/** Motion choice is derived from time and identity, never accumulated between frames. */
export function crowdMotion(reaction: string, energy: number, personality: number, seconds: number): CrowdMotion {
    if (reaction === 'still' || reaction === 'disperse')
        return 0;
    if (reaction === 'phone_lights')
        return personality < .62 ? 5 : 1;
    if (reaction === 'wave')
        return personality < .88 ? 4 : 1;
    if (/applause|clap/.test(reaction))
        return personality < .8 ? 3 : 2;
    if (/jump|mosh/.test(reaction))
        return personality < .72 ? 6 : 7;
    if (/sway|singalong/.test(reaction))
        return personality < .8 ? 1 : 4;
    if (/cheer|roar/.test(reaction))
        return personality < .5 ? 2 : 3;
    const activity = (Math.floor(seconds / 7 + personality * 13) + Math.floor(personality * 17)) % 7;
    if (energy < .25)
        return personality < .65 ? 0 : 1;
    return ([1, 1, 3, 2, 7, 1, 6] as const)[energy > .6 ? activity : activity % 3];
}
/** Five baked arm keyframes interpolate on the GPU. Flat shading computes the
 * moved face normals, so lighting follows articulation without extra attributes. */
export function crowdMaterial(time: {
    value: number;
}) {
    const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .88, flatShading: true });
    material.customProgramCacheKey = () => 'crowd-articulation-v1';
    material.onBeforeCompile = shader => {
        shader.uniforms.crowdTime = time;
        shader.vertexShader = `attribute vec3 poseRaised;
attribute vec3 poseClapOpen;
attribute vec3 poseClapClosed;
attribute vec3 poseDanceLeft;
attribute vec3 poseDanceRight;
attribute vec4 crowdMotion;
uniform float crowdTime;
${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
vec3 transformed = position;
float mode = crowdMotion.x;
float phase = crowdTime * crowdMotion.z + crowdMotion.y;
float amount = crowdMotion.w;
if (mode > 0.5 && mode < 1.5) transformed = mix(position, mix(poseDanceLeft, poseDanceRight, .5+.5*sin(phase*1.7)), amount);
if (mode > 1.5 && mode < 2.5) transformed = mix(position, poseRaised, .86+.14*sin(phase*2.1));
if (mode > 2.5 && mode < 3.5) transformed = mix(poseClapOpen, poseClapClosed, .5+.5*sin(phase*7.0));
if (mode > 3.5 && mode < 4.5) transformed = mix(poseDanceLeft, poseRaised, .7+.3*sin(phase*2.3));
if (mode > 4.5 && mode < 5.5) transformed = poseRaised;
if (mode > 5.5 && mode < 6.5) transformed = mix(poseDanceRight, poseRaised, .75+.25*sin(phase*5.4));
if (mode > 6.5) transformed = mix(poseDanceLeft, poseDanceRight, .5+.5*sin(phase*4.0));
`);
    };
    return material;
}
