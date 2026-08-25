from __future__ import annotations

import os
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"C1 finalizer could not find expected {label} block")
    return text.replace(old, new, 1)


repo = Path(__file__).resolve().parents[2]
pr_number = os.environ.get("PR_NUMBER", "").strip()
pr_link = (
    f" ([#{pr_number}](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/{pr_number}))"
    if pr_number
    else ""
)

backlog_path = repo / "docs" / "IMPLEMENTATION_BACKLOG.md"
backlog = backlog_path.read_text(encoding="utf-8")
backlog = replace_once(
    backlog,
    "_Last updated: 2026-08-24_",
    "_Last updated: 2026-08-25_",
    "backlog update date",
)
backlog = replace_once(
    backlog,
    "## PR B6 — Festival ticket tiers, vendors and operational analytics closure\n\n**Priority:** P1  \n**Status:** PARTIAL",
    "## PR B6 — Festival ticket tiers, vendors and operational analytics closure ([#1641](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1641))\n\n**Priority:** P1  \n**Status:** COMPLETE",
    "B6 status",
)
backlog = replace_once(
    backlog,
    "## PR B7 — Festival performer collaboration, invitations and fan voting\n\n**Priority:** P2  \n**Status:** PARTIAL",
    "## PR B7 — Festival performer collaboration, invitations and fan voting ([#1644](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1644))\n\n**Priority:** P2  \n**Status:** COMPLETE",
    "B7 status",
)
backlog = replace_once(
    backlog,
    "## PR C1 — Festival wristbands and memorabilia inventory\n\n**Priority:** P0  \n**Status:** NOT STARTED",
    f"## PR C1 — Festival wristbands and memorabilia inventory{pr_link}\n\n**Priority:** P0  \n**Status:** COMPLETE",
    "C1 status",
)
backlog = replace_once(
    backlog,
    "### Acceptance criteria\n\n- Buying a valid admission ticket creates exactly one attendee lifecycle and one eligible wristband representation.\n- Add-ons do not create duplicate attendee lifecycles/wristbands.\n\n---\n\n## PR C2 — Festival check-in, readiness and leave lifecycle",
    "### Acceptance criteria\n\n- Buying a valid admission ticket creates exactly one attendee lifecycle and one eligible wristband representation.\n- Add-ons do not create duplicate attendee lifecycles/wristbands.\n\n### Implementation notes\n\n- Wristband issuance now follows canonical admission-backed attendance creation rather than waiting for check-in.\n- Memorabilia links directly to the authoritative admission ticket, edition, launch, and attendance row, with uniqueness at attendee/edition and ticket/item boundaries.\n- Existing ticketed attendees are reconciled; add-ons/upgrades cannot create attendance or wristbands.\n- The existing Inventory → Festival Keepsakes surface shows the same collectible projected into the festival ticket wallet.\n- Purchase success invalidates ticket, attendance, check-in, and memorabilia caches together, and focused regression coverage protects the C1 authority contract.\n\n---\n\n## PR C2 — Festival check-in, readiness and leave lifecycle",
    "C1 implementation notes",
)
backlog_path.write_text(backlog, encoding="utf-8")

inventory_path = repo / "src" / "pages" / "InventoryManager.tsx"
inventory = inventory_path.read_text(encoding="utf-8")
inventory = replace_once(
    inventory,
    "Souvenirs earned by your character through festival attendance. Wristbands are collected when you physically check in.",
    "Festival keepsakes linked to your character's festival history. Wristbands are issued automatically with valid admission.",
    "festival inventory description",
)
inventory = replace_once(
    inventory,
    "Buy admission, travel to the festival and check in to collect your first wristband.",
    "Buy a valid festival admission ticket to receive your first wristband automatically.",
    "festival inventory empty state",
)
inventory = replace_once(
    inventory,
    "<span>Collected {new Date(item.issuedAt).toLocaleDateString(\"en-GB\")}</span>",
    "<span>Issued {new Date(item.issuedAt).toLocaleDateString(\"en-GB\")}</span>",
    "festival inventory issued label",
)
inventory_path.write_text(inventory, encoding="utf-8")
