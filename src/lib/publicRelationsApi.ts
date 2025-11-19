import {
  MediaContact,
  OutreachStage,
  OutreachTask,
  OutreachTaskStatus,
  PressRelease,
} from "@/types/publicRelations";
import {
  mockMediaContacts,
  mockOutreachTasks,
  mockPressReleases,
} from "@/features/public-relations/mockData";

const clone = <T>(data: T): T =>
  typeof structuredClone === "function"
    ? structuredClone(data)
    : JSON.parse(JSON.stringify(data));
const generateId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const nowIsoString = () => new Date().toISOString();

export type PressReleasePayload = Omit<PressRelease, "id" | "createdAt" | "updatedAt">;
export type MediaContactPayload = Omit<MediaContact, "id">;
export type OutreachTaskPayload = Omit<OutreachTask, "id" | "createdAt" | "updatedAt">;

let pressReleases: PressRelease[] = clone(mockPressReleases);
let mediaContacts: MediaContact[] = clone(mockMediaContacts);
let outreachTasks: OutreachTask[] = clone(mockOutreachTasks);

export async function listPressReleases(): Promise<PressRelease[]> {
  return clone(pressReleases);
}

export async function getPressRelease(id: string): Promise<PressRelease | undefined> {
  const found = pressReleases.find((item) => item.id === id);
  return found ? clone(found) : undefined;
}

export async function createPressRelease(payload: PressReleasePayload): Promise<PressRelease> {
  const timestamp = nowIsoString();
  const pressRelease: PressRelease = {
    id: generateId("pr"),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...payload,
  };

  pressReleases = [pressRelease, ...pressReleases];
  return clone(pressRelease);
}

export async function updatePressRelease(
  id: string,
  updates: Partial<PressReleasePayload>,
): Promise<PressRelease | null> {
  const existing = pressReleases.find((item) => item.id === id);
  if (!existing) return null;

  const updated: PressRelease = {
    ...existing,
    ...updates,
    updatedAt: nowIsoString(),
  };

  pressReleases = pressReleases.map((item) => (item.id === id ? updated : item));
  return clone(updated);
}

export async function deletePressRelease(id: string): Promise<boolean> {
  const before = pressReleases.length;
  pressReleases = pressReleases.filter((item) => item.id !== id);
  return pressReleases.length < before;
}

export async function listMediaContacts(): Promise<MediaContact[]> {
  return clone(mediaContacts);
}

export async function getMediaContact(id: string): Promise<MediaContact | undefined> {
  const found = mediaContacts.find((item) => item.id === id);
  return found ? clone(found) : undefined;
}

export async function createMediaContact(payload: MediaContactPayload): Promise<MediaContact> {
  const contact: MediaContact = {
    id: generateId("contact"),
    ...payload,
  };

  mediaContacts = [contact, ...mediaContacts];
  return clone(contact);
}

export async function updateMediaContact(
  id: string,
  updates: Partial<MediaContactPayload>,
): Promise<MediaContact | null> {
  const existing = mediaContacts.find((item) => item.id === id);
  if (!existing) return null;

  const updated: MediaContact = {
    ...existing,
    ...updates,
  };

  mediaContacts = mediaContacts.map((item) => (item.id === id ? updated : item));
  return clone(updated);
}

export async function deleteMediaContact(id: string): Promise<boolean> {
  const before = mediaContacts.length;
  mediaContacts = mediaContacts.filter((item) => item.id !== id);
  return mediaContacts.length < before;
}

export async function listOutreachTasks(): Promise<OutreachTask[]> {
  return clone(outreachTasks);
}

export async function getOutreachTask(id: string): Promise<OutreachTask | undefined> {
  const found = outreachTasks.find((item) => item.id === id);
  return found ? clone(found) : undefined;
}

export async function createOutreachTask(payload: OutreachTaskPayload): Promise<OutreachTask> {
  const timestamp = nowIsoString();
  const task: OutreachTask = {
    id: generateId("task"),
    createdAt: timestamp,
    updatedAt: timestamp,
    status: OutreachTaskStatus.Open,
    stage: OutreachStage.Research,
    ...payload,
  };

  outreachTasks = [task, ...outreachTasks];
  return clone(task);
}

export async function updateOutreachTask(
  id: string,
  updates: Partial<OutreachTaskPayload>,
): Promise<OutreachTask | null> {
  const existing = outreachTasks.find((item) => item.id === id);
  if (!existing) return null;

  const updated: OutreachTask = {
    ...existing,
    ...updates,
    updatedAt: nowIsoString(),
  };

  outreachTasks = outreachTasks.map((item) => (item.id === id ? updated : item));
  return clone(updated);
}

export async function deleteOutreachTask(id: string): Promise<boolean> {
  const before = outreachTasks.length;
  outreachTasks = outreachTasks.filter((item) => item.id !== id);
  return outreachTasks.length < before;
}
