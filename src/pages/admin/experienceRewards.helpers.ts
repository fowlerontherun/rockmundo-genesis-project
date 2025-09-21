import { z } from "zod";

const targetScopes = ["single", "multiple", "all"] as const;
export type TargetScope = (typeof targetScopes)[number];

export const xpGrantSchema = z
  .object({
    targetScope: z.enum(targetScopes),
    profileId: z.string().uuid().optional(),
    profileIds: z.array(z.string().uuid()).optional(),
    amount: z
      .coerce
      .number({ invalid_type_error: "Amount must be a number" })
      .min(1, "XP amount must be at least 1"),
    reason: z.string().min(1, "Please provide a reason for the XP grant"),
  })
  .superRefine((values, ctx) => {
    if (values.targetScope === "single" && !values.profileId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["profileId"],
        message: "Select a player to grant XP.",
      });
    }

    if (values.targetScope === "multiple") {
      const ids = values.profileIds ?? [];
      if (ids.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["profileIds"],
          message: "Select at least one player.",
        });
      }
    }
  });

export type XpGrantFormValues = z.infer<typeof xpGrantSchema>;

export type PlayerProfileOption = {
  profileId: string;
  userId: string;
  displayName: string | null;
  username: string | null;
};

export const xpGrantDefaultValues: XpGrantFormValues = {
  targetScope: "single",
  profileId: undefined,
  profileIds: [],
  amount: 100,
  reason: "",
};
