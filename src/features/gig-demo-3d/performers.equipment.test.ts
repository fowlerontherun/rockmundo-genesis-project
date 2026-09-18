import { describe, expect, it } from "vitest";
import * as T from "three";
import { defaultAppearance } from "@/features/player-model/appearance";
import { Musician } from "./performers";

function simpleModel() {
  const root = new T.Group();
  const mesh = new T.Mesh(
    new T.BoxGeometry(.5, 1.8, .35),
    new T.MeshStandardMaterial({ color: "#888888" }),
  );
  mesh.position.y = .9;
  root.add(mesh);
  return root;
}

describe("stationary performer equipment alignment", () => {
  it("keeps stage equipment at world scale instead of avatar body scale", () => {
    const appearance = defaultAppearance("equipment-scale");
    appearance.body.build = 1.28;
    appearance.body.height = 1.16;

    const actor = new Musician(
      simpleModel(),
      "drums",
      [5.4, .4, 2.05],
      0,
      undefined,
      appearance,
      "rock_drums",
      null,
    );

    expect(actor.root.scale.x).toBeCloseTo(1.28);
    expect(actor.root.scale.y).toBeCloseTo(1.16);
    expect(actor.equipment).toBeTruthy();
    expect(actor.equipment!.scale.toArray()).toEqual([1, 1, 1]);
  });

  it("restores stationary gear to its stage anchor after actor movement", () => {
    const actor = new Musician(
      simpleModel(),
      "drums",
      [-4.5, .46, 4.05],
      0,
      undefined,
      defaultAppearance("equipment-anchor"),
      "rock_drums",
      null,
    );

    expect(actor.equipmentAnchor()?.toArray()).toEqual([-4.5, .46, 4.05]);
    actor.root.position.set(-3.2, .46, 4.4);
    actor.equipment!.position.set(99, 99, 99);
    actor.equipment!.scale.set(2, 3, 4);

    actor.restoreEquipmentAnchor();

    expect(actor.equipment!.position.toArray()).toEqual([-4.5, .46, 4.05]);
    expect(actor.equipment!.scale.toArray()).toEqual([1, 1, 1]);
  });
});
