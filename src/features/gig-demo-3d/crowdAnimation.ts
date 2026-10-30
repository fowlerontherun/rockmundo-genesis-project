import * as T from 'three';
import { defaultAppearance, STARTER_ITEMS, HAIR_COLORS, CLOTHING_COLORS, type PlayerAppearance } from '@/features/player-model/appearance';
import { seededRandom } from './config';
export const CROWD_VARIANTS = 16;
export const CROWD_LIMIT = 160;
const CROWD_HAIR_STYLES = ['original', 'original', 'buzz', 'quiff', 'bob', 'ponytail', 'bun', 'curls', 'long', 'bald'] as const;
const CROWD_FEMININE_HAIR_STYLES = ['original', 'bob', 'shoulder', 'layered_long', 'long_waves', 'ponytail', 'high_ponytail', 'side_braid', 'twin_ponytails', 'bun', 'curls', 'long', 'buzz'] as const;
const CROWD_HAIR_COLORS = HAIR_COLORS.slice(0, 7);
/** Reproducible identities; both body frames and a spread across the starter wardrobe appear in every full crowd. */
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
            a.equipment[slot].itemId = STARTER_ITEMS[slot][(Math.floor(i * STARTER_ITEMS[slot].length / CROWD_VARIANTS) + index * 2) % STARTER_ITEMS[slot].length].id;
            a.equipment[slot].color = CLOTHING_COLORS[(i * 5 + index * 3) % CLOTHING_COLORS.length][1];
        }
        return a;
    });
}
export type CrowdMotion = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

function televisionCrowdMotion(reaction: string, personality: number, seconds: number): CrowdMotion | null {
    if (!reaction.startsWith('tv_')) return null;
    const cue = (Math.floor(seconds / 2.75) + Math.floor(personality * 11)) % 8;
    switch (reaction) {
        case 'tv_nervous':
            return personality < .58 ? 0 : cue % 3 === 0 ? 3 : 1;
        case 'tv_settled':
            return ([1, 1, 3, 1, 2, 1, 3, 0] as const)[cue];
        case 'tv_warm':
            return ([3, 1, 3, 2, 4, 1, 3, 2] as const)[cue];
        case 'tv_loud':
            return ([3, 2, 4, 3, 6, 2, 4, 3] as const)[cue];
        case 'tv_roaring':
            return ([6, 3, 2, 6, 4, 7, 3, 6] as const)[cue];
        default:
            return null;
    }
}

/** Motion choice is derived from time and identity, never accumulated between frames. */
export function crowdMotion(reaction: string, energy: number, personality: number, seconds: number): CrowdMotion {
    const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const television = televisionCrowdMotion(reaction, personality, time);
    if (television !== null) return television;
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
    const activity = (Math.floor(time / 7 + personality * 13) + Math.floor(personality * 17)) % 7;
    if (energy < .25)
        return personality < .65 ? 0 : 1;
    return ([1, 1, 3, 2, 7, 1, 6] as const)[energy > .6 ? activity : activity % 3];
}
/** Seven baked pose keyframes interpolate on the GPU. Flat shading computes the
 * moved face normals, so lighting follows articulation without extra attributes. */
export function crowdMaterial(time: {
    value: number;
}) {
    const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .88, flatShading: true });
    material.customProgramCacheKey = () => 'crowd-articulation-v3';
    material.onBeforeCompile = shader => {
        shader.uniforms.crowdTime = time;
        shader.vertexShader = `attribute vec3 poseRaised;
attribute vec3 poseClapOpen;
attribute vec3 poseClapClosed;
attribute vec3 poseDanceLeft;
attribute vec3 poseDanceRight;
attribute vec3 poseRunLeft;
attribute vec3 poseRunRight;
attribute vec4 crowdMotion;
uniform float crowdTime;
${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader.replace('void main() {', `
vec3 crowdPose(float mode, float phase, float amount) {
  vec3 pose = position;
  if (mode < .5) {
    float upper = smoothstep(.8, 1.6, position.y);
    pose.x += sin(phase*.65)*.007*upper*amount;
    pose.z += sin(phase*.43)*.009*upper*amount;
  }
  if (mode > .5 && mode < 1.5) pose = mix(position, mix(poseDanceLeft, poseDanceRight, .5+.5*sin(phase*1.7)), amount);
  if (mode > 1.5 && mode < 2.5) pose = mix(position, poseRaised, (.86+.14*sin(phase*2.1))*amount);
  if (mode > 2.5 && mode < 3.5) pose = mix(position, mix(poseClapOpen, poseClapClosed, .5+.5*cos(phase*12.5663706)), amount);
  if (mode > 3.5 && mode < 4.5) pose = mix(position, poseRaised, amount);
  if (mode > 4.5 && mode < 5.5) pose = mix(position, poseRaised, amount);
  if (mode > 5.5 && mode < 6.5) pose = mix(position, mix(poseDanceRight, poseRaised, .75+.25*sin(phase*5.4)), amount);
  if (mode > 6.5 && mode < 7.5) pose = mix(position, mix(poseDanceLeft, poseDanceRight, .5+.5*sin(phase*4.0)), amount);
  if (mode > 7.5 && mode < 8.5) pose = mix(position, mix(poseRunLeft, poseRunRight, .5+.5*sin(phase*7.2)), amount);
  if (mode > 8.5) pose = mix(position, mix(poseDanceLeft, poseDanceRight, .5+.5*sin(phase*1.6)), .35*amount);
  return pose;
}
void main() {`);
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
float mode = floor(mod(crowdMotion.x, 16.0));
float previousMode = floor(crowdMotion.x / 16.0);
float blend = fract(crowdMotion.x) * 2.0;
float previousAmount = floor(crowdMotion.y / 16.0) / 255.0;
float phase = crowdTime * crowdMotion.z + mod(crowdMotion.y, 16.0);
vec3 transformed = mix(crowdPose(previousMode, phase, previousAmount),
  crowdPose(mode, phase, crowdMotion.w), blend);
`);
    };
    return material;
}
