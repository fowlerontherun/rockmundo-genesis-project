import { describe, expect, it } from "vitest";
import * as T from "three";
import { defaultAppearance } from "@/features/player-model/appearance";
import { Musician } from "./performers";

function simpleRiggedModel() {
  const root = new T.Group();
  const hips = new T.Bone(); hips.name = "Hips"; hips.position.y = .9;
  const torso = new T.Bone(); torso.name = "Torso"; torso.position.y = .45; hips.add(torso);

  for (const side of ["L", "R"] as const) {
    const upper = new T.Bone(); upper.name = `UpperArm.${side}`; upper.position.set(side === "L" ? .18 : -.18, .28, 0);
    const lower = new T.Bone(); lower.name = `LowerArm.${side}`; lower.position.set(side === "L" ? .24 : -.24, -.05, 0);
    const hand = new T.Bone(); hand.name = `Hand.${side}`; hand.position.set(side === "L" ? .22 : -.22, -.02, .02);
    torso.add(upper); upper.add(lower); lower.add(hand);
  }
  root.add(hips);

  const mesh = new T.Mesh(
    new T.BoxGeometry(.6, 1.8, .38),
    new T.MeshStandardMaterial({ color: "#888" }),
  );
  mesh.position.y = .9;
  root.add(mesh);
  return root;
}

describe("performer instrument body clearance", () => {
  it("pushes a guitar rig farther forward on a broad avatar", () => {
    const normal = defaultAppearance("normal");
    normal.body.build = 1;
    const broad = defaultAppearance("broad");
    broad.body.build = 1.35;

    const a = new Musician(simpleRiggedModel(), "guitar", [0, 0, 0], 0, undefined, normal, "electric_guitar");
    const b = new Musician(simpleRiggedModel(), "guitar", [0, 0, 0], 0, undefined, broad, "electric_guitar");

    expect(b.instrumentRig!.root.position.z).toBeGreaterThan(a.instrumentRig!.root.position.z);
  });

  it("parents drumsticks directly to the drummer hands", () => {
    const actor = new Musician(simpleRiggedModel(), "drums", [0, 0, 0], 0, undefined, defaultAppearance("drummer-sticks"), "rock_drums");

    const left = actor.instrumentRig!.tools.find((tool) => tool.name === "playing-stick-l");
    const right = actor.instrumentRig!.tools.find((tool) => tool.name === "playing-stick-r");

    expect(left).toBeTruthy();
    expect(right).toBeTruthy();
    expect(left!.parent).toBe(actor.bones.get("Hand.L"));
    expect(right!.parent).toBe(actor.bones.get("Hand.R"));
    expect(left!.userData.attachedToHand).toBe(true);
    expect(right!.userData.attachedToHand).toBe(true);

    actor.update(2.2, .9, false);
    expect(left!.getWorldPosition(new T.Vector3()).distanceTo(actor.bones.get("Hand.L")!.getWorldPosition(new T.Vector3()))).toBeLessThan(.4);
    expect(right!.getWorldPosition(new T.Vector3()).distanceTo(actor.bones.get("Hand.R")!.getWorldPosition(new T.Vector3()))).toBeLessThan(.4);
  });

  it("keeps arm IK finite after applying wider pole clearance", () => {
    const broad = defaultAppearance("broad-ik");
    broad.body.build = 1.35;
    const actor = new Musician(simpleRiggedModel(), "guitar", [0, 0, 0], 0, undefined, broad, "electric_guitar");

    actor.update(5.2, .9, false);

    for (const name of ["UpperArm.L", "LowerArm.L", "Hand.L", "UpperArm.R", "LowerArm.R", "Hand.R"]) {
      const bone = actor.bones.get(name)!;
      expect(bone.matrixWorld.elements.every(Number.isFinite)).toBe(true);
    }
  });
});
