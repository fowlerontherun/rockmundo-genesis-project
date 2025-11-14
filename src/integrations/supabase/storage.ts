import { nanoid } from "nanoid";
import { supabase } from "./client";

interface StorageFileObject {
  id: string;
  name: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string | null;
  metadata: Record<string, any> | null;
}

export interface StorageUsageBreakdown {
  bytes: number;
  count: number;
}

export interface StorageUsageSummary {
  bucketId: string;
  totalBytes: number;
  fileCount: number;
  contentTypeBreakdown: Record<string, StorageUsageBreakdown>;
  lastUpdatedAt: string | null;
  error?: string;
}

export interface UploadMediaParams {
  bucketId: string;
  file: File | Blob;
  path?: string;
  upsert?: boolean;
  metadata?: Record<string, unknown>;
  cacheControl?: string;
}

export interface UploadMediaResult {
  bucketId: string;
  path: string;
  publicUrl: string | null;
}

export interface MediaMetadata {
  bucketId: string;
  path: string;
  name: string;
  size: number;
  mimeType?: string;
  createdAt?: string;
  updatedAt?: string;
  lastAccessedAt?: string | null;
  rawMetadata?: Record<string, any> | null;
}

const normalizeMetadata = (metadata?: Record<string, unknown>) => {
  if (!metadata) return undefined;

  return Object.entries(metadata).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = typeof value === "string" ? value : JSON.stringify(value);
    return acc;
  }, {});
};

const listAllFiles = async (bucketId: string, path = ""): Promise<StorageFileObject[]> => {
  const { data, error } = await supabase.storage.from(bucketId).list(path, {
    limit: 1000,
    offset: 0,
  });

  if (error) {
    throw new Error(error.message);
  }

  const files: StorageFileObject[] = [];

  for (const item of data ?? []) {
    const fullPath = path ? `${path}/${item.name}` : item.name;

    if (!item.metadata) {
      const nestedItems = await listAllFiles(bucketId, fullPath);
      files.push(...nestedItems);
      continue;
    }

    files.push({
      ...item,
      name: fullPath,
    });
  }

  return files;
};

export const fetchBucketUsage = async (bucketId: string): Promise<StorageUsageSummary> => {
  try {
    const files = await listAllFiles(bucketId);

    const summary = files.reduce<Omit<StorageUsageSummary, "bucketId" | "error">>(
      (acc, file) => {
        const size = Number(file.metadata?.size ?? 0);
        const mimeType =
          (file.metadata?.mimetype as string | undefined) ||
          (file.metadata?.contentType as string | undefined) ||
          "unknown";

        acc.totalBytes += size;
        acc.fileCount += 1;
        acc.lastUpdatedAt = acc.lastUpdatedAt
          ? acc.lastUpdatedAt > file.updated_at
            ? acc.lastUpdatedAt
            : file.updated_at
          : file.updated_at;

        const existing = acc.contentTypeBreakdown[mimeType] ?? { bytes: 0, count: 0 };
        existing.bytes += size;
        existing.count += 1;
        acc.contentTypeBreakdown[mimeType] = existing;

        return acc;
      },
      {
        totalBytes: 0,
        fileCount: 0,
        contentTypeBreakdown: {},
        lastUpdatedAt: null,
      },
    );

    return {
      bucketId,
      ...summary,
    };
  } catch (error) {
    return {
      bucketId,
      totalBytes: 0,
      fileCount: 0,
      contentTypeBreakdown: {},
      lastUpdatedAt: null,
      error: error instanceof Error ? error.message : "Unable to load storage usage",
    };
  }
};

export const uploadMediaAsset = async ({
  bucketId,
  file,
  path,
  upsert = false,
  metadata,
  cacheControl,
}: UploadMediaParams): Promise<UploadMediaResult> => {
  const objectPath = path ?? `uploads/${nanoid()}-${(file as File).name ?? "asset"}`;

  const { error } = await supabase.storage.from(bucketId).upload(objectPath, file, {
    upsert,
    contentType: (file as File).type || undefined,
    cacheControl,
    metadata: normalizeMetadata(metadata),
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data: publicUrlData } = supabase.storage.from(bucketId).getPublicUrl(objectPath);

  return {
    bucketId,
    path: objectPath,
    publicUrl: publicUrlData?.publicUrl ?? null,
  };
};

export const getMediaMetadata = async (
  bucketId: string,
  path: string,
): Promise<MediaMetadata | null> => {
  const sanitizedPath = path.replace(/^\/+/, "");
  const folder = sanitizedPath.includes("/")
    ? sanitizedPath.slice(0, sanitizedPath.lastIndexOf("/"))
    : "";
  const fileName = sanitizedPath.split("/").pop() ?? sanitizedPath;

  const { data, error } = await supabase.storage.from(bucketId).list(folder, {
    limit: 1000,
  });

  if (error) {
    throw new Error(error.message);
  }

  const entry = (data ?? []).find((item) => item.name === fileName);

  if (!entry || !entry.metadata) {
    return null;
  }

  const metadata = entry.metadata;
  const size = Number(metadata.size ?? 0);
  const mimeType =
    (metadata.mimetype as string | undefined) ||
    (metadata.contentType as string | undefined) ||
    undefined;

  return {
    bucketId,
    path: sanitizedPath,
    name: fileName,
    size,
    mimeType,
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,
    lastAccessedAt: entry.last_accessed_at,
    rawMetadata: metadata,
  };
};
