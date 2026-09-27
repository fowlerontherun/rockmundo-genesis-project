import * as T from 'three';

/** Preview-only scaling. Always derive scale from the original source height,
 * never compound slider edits on a previously modified scale. */
export function applyAvatarV2PreviewProportions(
  model: T.Object3D,
  referenceScale: number,
  proportions: { height: number; build: number },
): void {
  if (![referenceScale, proportions.height, proportions.build].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('Invalid V2 reference preview proportions.');
  }
  model.scale.set(
    referenceScale * proportions.build,
    referenceScale * proportions.height,
    referenceScale * proportions.build,
  );
  model.updateMatrixWorld(true);
  const minY = new T.Box3().setFromObject(model).min.y;
  if (!Number.isFinite(minY)) throw new Error('Cannot ground an empty V2 reference model.');
  model.position.y -= minY;
  model.updateMatrixWorld(true);
}
