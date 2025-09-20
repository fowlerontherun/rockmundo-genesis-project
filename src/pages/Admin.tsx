import React, { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BookOpen, Loader2, Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { AdminRoute } from "@/components/AdminRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { SKILL_TREE_DEFINITIONS, type TierName } from "@/data/skillTree";
import type { SkillDefinitionRecord } from "@/hooks/useSkillSystem.types";
import { adminAwardSpecialXp } from "@/utils/progression";

const UNIVERSITY_PAGE_SIZE = 10;

const BOOK_XP_VALUE = 10;
const BOOK_SEED_COSTS: Record<TierName, number> = {
  Basic: 250,
  Professional: 750,
  Mastery: 1500,
};

type SortColumn = "name" | "city" | "prestige" | "quality_of_learning" | "course_cost";
type SortDirection = "asc" | "desc";

const sortColumnOptions: { value: SortColumn; label: string }[] = [
  { value: "city", label: "City" },
  { value: "name", label: "Name" },
  { value: "prestige", label: "Prestige" },
  { value: "quality_of_learning", label: "Quality of Learning" },
  { value: "course_cost", label: "Course Cost" },
];

const sortDirectionLabels: Record<SortDirection, string> = {
  asc: "Ascending",
  desc: "Descending",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const universitySchema = z.object({
  name: z.string().min(1, "Name is required"),
  city: z.string().min(1, "City is required"),
  prestige: z
    .coerce
    .number({ invalid_type_error: "Prestige must be a number" })
    .min(0, "Prestige must be at least 0")
    .max(100, "Prestige cannot exceed 100"),
  qualityOfLearning: z
    .coerce
    .number({ invalid_type_error: "Quality must be a number" })
    .min(0, "Quality must be at least 0")
    .max(100, "Quality cannot exceed 100"),
  courseCost: z
    .coerce
    .number({ invalid_type_error: "Course cost must be a number" })
    .min(0, "Course cost cannot be negative"),
});

type UniversityFormValues = z.infer<typeof universitySchema>;
type UniversitiesTable = Database["public"]["Tables"] extends { universities: infer T }
  ? T
  : {
      Row: {
        id: string;
        name: string;
        city: string;
        prestige: number | null;
        quality_of_learning: number | null;
        course_cost: number | null;
        created_at: string | null;
      };
      Insert: {
        name: string;
        city: string;
        prestige?: number | null;
        quality_of_learning?: number | null;
        course_cost?: number | null;
      };
      Update: {
        name?: string;
        city?: string;
        prestige?: number | null;
        quality_of_learning?: number | null;
        course_cost?: number | null;
      };
    };

type UniversityRow = UniversitiesTable extends { Row: infer R } ? R : never;
type UniversityInsert = UniversitiesTable extends { Insert: infer I } ? I : never;
type UniversityUpdate = UniversitiesTable extends { Update: infer U } ? U : never;

const skillBookSchema = z.object({
  skillSlug: z.string().min(1, "Skill selection is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  cost: z
    .coerce
    .number({ invalid_type_error: "Cost must be a number" })
    .min(0, "Cost cannot be negative"),
  xpValue: z
    .coerce
    .number({ invalid_type_error: "XP reward must be a number" })
    .min(0, "XP cannot be negative"),
  isActive: z.boolean(),
});

type SkillBookFormValues = z.infer<typeof skillBookSchema>;

type SkillBooksTable = Database["public"]["Tables"] extends { skill_books: infer T }
  ? T
  : {
      Row: {
        id: string;
        skill_slug: string;
        title: string;
        description: string | null;
        cost: number | null;
        xp_value: number | null;
        is_active: boolean | null;
        created_at: string | null;
        updated_at: string | null;
      };
      Insert: {
        skill_slug: string;
        title: string;
        description?: string | null;
        cost?: number | null;
        xp_value?: number | null;
        is_active?: boolean | null;
      };
      Update: {
        skill_slug?: string;
        title?: string;
        description?: string | null;
        cost?: number | null;
        xp_value?: number | null;
        is_active?: boolean | null;
      };
    };

type SkillBookRow = SkillBooksTable extends { Row: infer R } ? R : never;
type SkillBookInsert = SkillBooksTable extends { Insert: infer I } ? I : never;
type SkillBookUpdate = SkillBooksTable extends { Update: infer U } ? U : never;
type SkillDefinitionsTable = Database["public"]["Tables"] extends { skill_definitions: infer T }
  ? T
  : {
      Row: {
        id: string;
        slug: string;
        display_name: string | null;
        metadata?: Record<string, unknown> | null;
        description?: string | null;
      };
    };

type SkillDefinitionRow = SkillDefinitionsTable extends { Row: infer R } ? R : never;
type SkillMetadata = {
  name: string;
  track?: string;
  tier?: TierName;
  category?: string;
};
type SkillOption = SkillMetadata & { value: string };

const xpGrantSchema = z
  .object({
    targetScope: z.enum(["single", "multiple", "all"]),
    profileId: z.string().uuid().optional(),
    profileIds: z.array(z.string().uuid()).optional(),
    amount: z
      .coerce
      .number({ invalid_type_error: "Amount must be a number" })
      .min(1, "XP amount must be at least 1"),
    reason: z.string().min(1, "Please provide a reason for the XP grant"),
  })
  .superRefine((values, ctx) => {
    if (values.targetScope === "single") {
      if (!values.profileId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["profileId"],
          message: "Select a player to grant XP.",
        });
      }
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

type XpGrantFormValues = z.infer<typeof xpGrantSchema>;

type PlayerProfileOption = {
  profileId: string;
  userId: string;
  displayName: string | null;
  username: string | null;
};

const parseString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseTier = (value: unknown): TierName | undefined => {
  const normalized = parseString(value);
  if (!normalized) {
    return undefined;
  }

  if (normalized === "Basic" || normalized === "Professional" || normalized === "Mastery") {
    return normalized;
  }

  return undefined;
};

const getMetadataValue = (metadata: Record<string, unknown> | null | undefined, key: string): unknown => {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  return metadata[key];
};

export default function Admin() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"universities" | "books">("universities");
  const [universities, setUniversities] = useState<UniversityRow[]>([]);
  const [totalUniversities, setTotalUniversities] = useState(0);
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>("city");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isLoadingUniversities, setIsLoadingUniversities] = useState(false);
  const [isSubmittingUniversity, setIsSubmittingUniversity] = useState(false);
  const [editingUniversity, setEditingUniversity] = useState<UniversityRow | null>(null);
  const [deletingUniversityId, setDeletingUniversityId] = useState<string | null>(null);
  const [skillBooks, setSkillBooks] = useState<SkillBookRow[]>([]);
  const [skillDefinitions, setSkillDefinitions] = useState<SkillDefinitionRow[]>([]);
  const [isLoadingSkillBooks, setIsLoadingSkillBooks] = useState(false);
  const [isSubmittingSkillBook, setIsSubmittingSkillBook] = useState(false);
  const [editingSkillBook, setEditingSkillBook] = useState<SkillBookRow | null>(null);
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);
  const [isSeedingBooks, setIsSeedingBooks] = useState(false);
  const [playerProfiles, setPlayerProfiles] = useState<PlayerProfileOption[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [isAwardingXp, setIsAwardingXp] = useState(false);

  const universityForm = useForm<UniversityFormValues>({
    resolver: zodResolver(universitySchema),
    defaultValues: {
      name: "",
      city: "",
      prestige: 50,
      qualityOfLearning: 50,
      courseCost: 0,
    },
  });

  const skillBookForm = useForm<SkillBookFormValues>({
    resolver: zodResolver(skillBookSchema),
    defaultValues: {
      skillSlug: "",
      title: "",
      description: "",
      cost: 0,
      xpValue: BOOK_XP_VALUE,
      isActive: true,
    },
  });

  const xpGrantForm = useForm<XpGrantFormValues>({
    resolver: zodResolver(xpGrantSchema),
    defaultValues: {
      targetScope: "single",
      profileId: undefined,
      profileIds: [],
      amount: 100,
      reason: "",
    },
  });
  const targetScope = xpGrantForm.watch("targetScope");
  const selectedProfileIds = xpGrantForm.watch("profileIds");
  const selectedProfileCount = (selectedProfileIds ?? []).length;
  const isRecipientListReady =
    targetScope === "all" || (!isLoadingPlayers && playerProfiles.length > 0);
  const disableXpSubmit = isAwardingXp || !isRecipientListReady;

  useEffect(() => {
    if (targetScope === "single") {
      xpGrantForm.setValue("profileIds", [], {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    } else if (targetScope === "multiple") {
      xpGrantForm.setValue("profileId", undefined, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    } else if (targetScope === "all") {
      xpGrantForm.setValue("profileId", undefined, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
      xpGrantForm.setValue("profileIds", [], {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [targetScope, xpGrantForm]);

  const fetchPlayerProfiles = useCallback(async () => {
    setIsLoadingPlayers(true);
    try {
      const { data, error } = await supabase
        .from("public_profiles")
        .select("id, user_id, display_name, username")
        .order("display_name", { ascending: true, nullsFirst: false })
        .order("username", { ascending: true, nullsFirst: false })
        .limit(500);

      if (error) throw error;

      const profiles = (data ?? [])
        .filter((row): row is { id: string; user_id: string; display_name: string | null; username: string | null } => {
          return typeof row?.id === "string" && typeof row?.user_id === "string";
        })
        .map((row) => ({
          profileId: row.id,
          userId: row.user_id,
          displayName: parseString(row.display_name) ?? null,
          username: parseString(row.username) ?? null,
        }))
        .sort((a, b) => {
          const nameA = a.displayName ?? a.username ?? a.profileId;
          const nameB = b.displayName ?? b.username ?? b.profileId;
          return nameA.localeCompare(nameB);
        });

      setPlayerProfiles(profiles);
    } catch (error) {
      console.error("Failed to load player profiles", error);
      toast({
        variant: "destructive",
        title: "Unable to load players",
        description: "We couldn't fetch player profiles. Please try again later.",
      });
    } finally {
      setIsLoadingPlayers(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchPlayerProfiles();
  }, [fetchPlayerProfiles]);

  const handleFetchUniversities = useCallback(async () => {
    setIsLoadingUniversities(true);
    try {
      const from = (page - 1) * UNIVERSITY_PAGE_SIZE;
      const to = from + UNIVERSITY_PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from("universities")
        .select("*", { count: "exact" })
        .order(sortColumn, { ascending: sortDirection === "asc" })
        .range(from, to);

      if (error) throw error;

      setUniversities((data as UniversityRow[] | null) ?? []);
      if (typeof count === "number") {
        setTotalUniversities(count);
        if (count === 0) {
          if (page !== 1) {
            setPage(1);
          }
        } else if (from >= count) {
          const lastPage = Math.max(Math.ceil(count / UNIVERSITY_PAGE_SIZE), 1);
          if (lastPage !== page) {
            setPage(lastPage);
          }
        }
      } else {
        setTotalUniversities(0);
      }
    } catch (error) {
      console.error("Failed to load universities", error);
      toast({
        variant: "destructive",
        title: "Unable to load universities",
        description: "We couldn't retrieve the universities list. Please try again later.",
      });
    } finally {
      setIsLoadingUniversities(false);
    }
  }, [page, sortColumn, sortDirection, toast]);

  const handleFetchSkillBooks = useCallback(async () => {
    setIsLoadingSkillBooks(true);
    try {
      const { data, error } = await supabase
        .from("skill_books")
        .select("*")
        .order("cost", { ascending: true })
        .order("title", { ascending: true });

      if (error) throw error;

      setSkillBooks((data as SkillBookRow[] | null) ?? []);
    } catch (error) {
      console.error("Failed to load skill books", error);
      toast({
        variant: "destructive",
        title: "Unable to load skill books",
        description: "We couldn't retrieve the skill books. Please try again later.",
      });
    } finally {
      setIsLoadingSkillBooks(false);
    }
  }, [toast]);

  const handleFetchSkillDefinitions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("skill_definitions")
        .select("id, slug, display_name, metadata, description")
        .order("display_name", { ascending: true });

      if (error) throw error;

      setSkillDefinitions((data as SkillDefinitionRow[] | null) ?? []);
    } catch (error) {
      console.error("Failed to load skill definitions", error);
      toast({
        variant: "destructive",
        title: "Unable to load skills",
        description: "We couldn't fetch the skill catalog. Refresh and try again.",
      });
    }
  }, [toast]);

  useEffect(() => {
    void handleFetchUniversities();
  }, [handleFetchUniversities]);

  useEffect(() => {
    void handleFetchSkillDefinitions();
    void handleFetchSkillBooks();
  }, [handleFetchSkillDefinitions, handleFetchSkillBooks]);

  const formTitle = useMemo(
    () => (editingUniversity ? "Update University" : "Create University"),
    [editingUniversity],
  );
  const formDescription = useMemo(
    () =>
      editingUniversity
        ? "Edit the selected university and update its quality metrics."
        : "Define a new university hub, including its prestige and learning quality.",
    [editingUniversity],
  );

  const totalPages = useMemo(
    () => (totalUniversities > 0 ? Math.ceil(totalUniversities / UNIVERSITY_PAGE_SIZE) : 1),
    [totalUniversities],
  );

  const showingRangeStart =
    totalUniversities === 0 || universities.length === 0
      ? 0
      : (page - 1) * UNIVERSITY_PAGE_SIZE + 1;
  const showingRangeEnd =
    totalUniversities === 0 || universities.length === 0
      ? 0
      : Math.min(showingRangeStart + universities.length - 1, totalUniversities);
  const hasUniversities = totalUniversities > 0;

  const handleSortColumnChange = useCallback(
    (value: SortColumn) => {
      if (sortColumn !== value) {
        setSortColumn(value);
        if (page !== 1) {
          setPage(1);
        }
      }
    },
    [page, sortColumn],
  );

  const handleToggleSortDirection = useCallback(() => {
    setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
  }, []);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (nextPage >= 1 && nextPage <= totalPages && nextPage !== page) {
        setPage(nextPage);
      }
    },
    [page, totalPages],
  );

  const skillDefinitionBySlug = useMemo(() => {
    return skillDefinitions.reduce<Record<string, SkillDefinitionRow>>((acc, definition) => {
      if (definition.slug) {
        acc[definition.slug] = definition;
      }
      return acc;
    }, {});
  }, [skillDefinitions]);

  const skillTreeMetadata = useMemo(() => {
    const metadataMap = new Map<string, SkillMetadata>();

    for (const definition of SKILL_TREE_DEFINITIONS) {
      const slug = definition.slug;
      if (!slug) {
        continue;
      }

      const metadata = definition.metadata ?? null;
      metadataMap.set(slug, {
        name: parseString(definition.display_name) ?? slug,
        track: parseString(getMetadataValue(metadata, "track")),
        tier: parseTier(getMetadataValue(metadata, "tier")),
        category: parseString(getMetadataValue(metadata, "category")),
      });
    }

    return metadataMap;
  }, []);

  const skillOptions = useMemo<SkillOption[]>(() => {
    const options = new Map<string, SkillOption>();

    const upsertOption = (
      slug: string | null | undefined,
      displayName: string | null | undefined,
      metadata: Record<string, unknown> | null | undefined,
    ) => {
      const normalizedSlug = parseString(slug);
      if (!normalizedSlug) {
        return;
      }

      const tree = skillTreeMetadata.get(normalizedSlug);
      const option: SkillOption = {
        value: normalizedSlug,
        name: parseString(displayName) ?? tree?.name ?? normalizedSlug,
        track: parseString(getMetadataValue(metadata, "track")) ?? tree?.track,
        tier: parseTier(getMetadataValue(metadata, "tier")) ?? tree?.tier,
        category: parseString(getMetadataValue(metadata, "category")) ?? tree?.category,
      };

      const existing = options.get(normalizedSlug);
      if (existing) {
        options.set(normalizedSlug, {
          value: normalizedSlug,
          name: option.name ?? existing.name,
          track: option.track ?? existing.track,
          tier: option.tier ?? existing.tier,
          category: option.category ?? existing.category,
        });
      } else {
        options.set(normalizedSlug, option);
      }
    };

    for (const definition of skillDefinitions) {
      upsertOption(definition.slug, definition.display_name ?? null, definition.metadata ?? null);
    }

    for (const definition of SKILL_TREE_DEFINITIONS) {
      upsertOption(definition.slug, definition.display_name ?? null, definition.metadata ?? null);
    }

    return Array.from(options.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [skillDefinitions, skillTreeMetadata]);

  const getSkillMetadata = useCallback(
    (skillSlug: string): SkillMetadata => {
      const normalizedSlug = parseString(skillSlug) ?? skillSlug;
      const treeMetadata = normalizedSlug ? skillTreeMetadata.get(normalizedSlug) : undefined;
      const definition = normalizedSlug ? skillDefinitionBySlug[normalizedSlug] : undefined;
      const metadata = definition?.metadata ?? null;

      return {
        name: parseString(definition?.display_name) ?? treeMetadata?.name ?? normalizedSlug,
        track: parseString(getMetadataValue(metadata, "track")) ?? treeMetadata?.track,
        tier: parseTier(getMetadataValue(metadata, "tier")) ?? treeMetadata?.tier,
        category: parseString(getMetadataValue(metadata, "category")) ?? treeMetadata?.category,
      };
    },
    [skillDefinitionBySlug, skillTreeMetadata],
  );

  const resetUniversityForm = useCallback(() => {
    universityForm.reset({
      name: "",
      city: "",
      prestige: 50,
      qualityOfLearning: 50,
      courseCost: 0,
    });
    setEditingUniversity(null);
  }, [universityForm]);

  const resetSkillBookForm = useCallback(() => {
    skillBookForm.reset({
      skillSlug: "",
      title: "",
      description: "",
      cost: 0,
      xpValue: BOOK_XP_VALUE,
      isActive: true,
    });
    setEditingSkillBook(null);
  }, [skillBookForm]);

  const handleSubmitUniversity = useCallback(
    async (values: UniversityFormValues) => {
      setIsSubmittingUniversity(true);
      const isEditing = Boolean(editingUniversity);
      const editingId = editingUniversity?.id;

      try {
        const payload: UniversityInsert = {
          name: values.name,
          city: values.city,
          prestige: values.prestige,
          quality_of_learning: values.qualityOfLearning,
          course_cost: values.courseCost,
        };

        if (isEditing && editingId) {
          const updatePayload: UniversityUpdate = { ...payload };
          const { error } = await supabase
            .from("universities")
            .update(updatePayload)
            .eq("id", editingId);

          if (error) throw error;

          toast({
            title: "University updated",
            description: `${values.name} has been updated successfully.`,
          });
        } else {
          const { error } = await supabase.from("universities").insert(payload);

          if (error) throw error;

          toast({
            title: "University created",
            description: `${values.name} is now available in the world.`,
          });
        }

        resetUniversityForm();
        if (!isEditing && page !== 1) {
          setPage(1);
        } else {
          await handleFetchUniversities();
        }
      } catch (error) {
        console.error("Failed to submit university", error);
        toast({
          variant: "destructive",
          title: "Save failed",
          description: "We couldn't save the university. Please review the details and try again.",
        });
      } finally {
        setIsSubmittingUniversity(false);
      }
    },
    [editingUniversity, handleFetchUniversities, page, resetUniversityForm, toast],
  );

  const handleSubmitSkillBook = useCallback(
    async (values: SkillBookFormValues) => {
      setIsSubmittingSkillBook(true);
      const isEditing = Boolean(editingSkillBook);
      const editingId = editingSkillBook?.id;

      try {
        const payload: SkillBookInsert = {
          skill_slug: values.skillSlug,
          title: values.title,
          description: values.description.trim() ? values.description.trim() : null,
          cost: values.cost,
          xp_value: values.xpValue,
          is_active: values.isActive,
        };

        if (isEditing && editingId) {
          const updatePayload: SkillBookUpdate = { ...payload };
          const { error } = await supabase
            .from("skill_books")
            .update(updatePayload)
            .eq("id", editingId);

          if (error) throw error;

          toast({
            title: "Skill book updated",
            description: `${values.title} has been saved.`,
          });
        } else {
          const { error } = await supabase.from("skill_books").insert(payload);

          if (error) throw error;

          toast({
            title: "Skill book created",
            description: `${values.title} is now available for players.`,
          });
        }

        resetSkillBookForm();
        await handleFetchSkillBooks();
      } catch (error) {
        console.error("Failed to save skill book", error);
        toast({
          variant: "destructive",
          title: "Save failed",
          description: "We couldn't save the skill book. Please try again.",
        });
      } finally {
        setIsSubmittingSkillBook(false);
      }
    },
    [editingSkillBook, handleFetchSkillBooks, resetSkillBookForm, toast],
  );

  const handleEditUniversity = useCallback(
    (university: UniversityRow) => {
      setEditingUniversity(university);
      universityForm.reset({
        name: university.name ?? "",
        city: university.city ?? "",
        prestige: university.prestige ?? 50,
        qualityOfLearning: university.quality_of_learning ?? 50,
        courseCost: university.course_cost ?? 0,
      });
    },
    [universityForm],
  );

  const handleEditSkillBook = useCallback(
    (book: SkillBookRow) => {
      setEditingSkillBook(book);
      const parsedCost =
        typeof book.cost === "number"
          ? book.cost
          : Number.isNaN(Number(book.cost))
          ? 0
          : Number(book.cost ?? 0);

      const parsedXp =
        typeof book.xp_value === "number"
          ? book.xp_value
          : Number.isNaN(Number(book.xp_value))
          ? BOOK_XP_VALUE
          : Number(book.xp_value ?? BOOK_XP_VALUE);

      skillBookForm.reset({
        skillSlug: book.skill_slug,
        title: book.title,
        description: book.description ?? "",
        cost: parsedCost,
        xpValue: parsedXp,
        isActive: Boolean(book.is_active ?? true),
      });
    },
    [skillBookForm],
  );

  const handleDeleteUniversity = useCallback(
    async (id: string, city: string) => {
      setDeletingUniversityId(id);

      try {
        const { error } = await supabase.from("universities").delete().eq("id", id);

        if (error) throw error;

        setUniversities((prev) => prev.filter((item) => item.id !== id));
        setTotalUniversities((prev) => Math.max(prev - 1, 0));
        if (editingUniversity?.id === id) {
          resetUniversityForm();
        }
        await handleFetchUniversities();
        toast({
          title: "University deleted",
          description: `${city || "the selected university"} has been removed from the roster.`,
        });
      } catch (error) {
        console.error("Failed to delete university", error);
        toast({
          variant: "destructive",
          title: "Delete failed",
          description: "We couldn't remove the university. Please try again.",
        });
      } finally {
        setDeletingUniversityId(null);
      }
    },
    [editingUniversity?.id, handleFetchUniversities, resetUniversityForm, toast],
  );

  const handleDeleteSkillBook = useCallback(
    async (id: string, title: string) => {
      setDeletingBookId(id);
      try {
        const { error } = await supabase.from("skill_books").delete().eq("id", id);

        if (error) throw error;
        setSkillBooks((prev) => prev.filter((item) => item.id !== id));
        if (editingSkillBook?.id === id) {
          resetSkillBookForm();
        }

        toast({
          title: "Book deleted",
          description: `${title} has been removed from the catalog.`,
        });
      } catch (error) {
        console.error("Failed to delete skill book", error);
        toast({
          variant: "destructive",
          title: "Delete failed",
          description: "We couldn't remove the book. Please try again.",
        });
      } finally {
        setDeletingBookId(null);
      }
    },
    [editingSkillBook?.id, resetSkillBookForm, toast],
  );

  const handleSeedSkillBooks = useCallback(async () => {
    setIsSeedingBooks(true);
    try {
      const records: SkillBookInsert[] = SKILL_TREE_DEFINITIONS.map((definition) => {
        const slug = definition.slug;
        const metadata = definition.metadata ?? null;
        const tier = parseTier(getMetadataValue(metadata, "tier")) ?? "Basic";

        return {
          skill_slug: slug,
          title: parseString(definition.display_name) ?? slug,
          description: definition.description ?? null,
          cost: BOOK_SEED_COSTS[tier] ?? BOOK_SEED_COSTS.Basic,
          xp_value: BOOK_XP_VALUE,
          is_active: true,
        };
      });

      const { error } = await supabase
        .from("skill_books")
        .upsert(records, { onConflict: "skill_slug" });

      if (error) throw error;

      toast({
        title: "Skill books synced",
        description: "Skill books have been aligned with the skill tree definitions.",
      });

      await handleFetchSkillBooks();
    } catch (error) {
      console.error("Failed to seed skill books", error);
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: "We couldn't generate the skill books. Please try again.",
      });
    } finally {
      setIsSeedingBooks(false);
    }
  }, [handleFetchSkillBooks, toast]);

  const handleAwardXpGrant = useCallback(
    async (values: XpGrantFormValues) => {
      setIsAwardingXp(true);
      try {
        const profileIds =
          values.targetScope === "single"
            ? values.profileId
              ? [values.profileId]
              : []
            : values.targetScope === "multiple"
              ? values.profileIds ?? []
              : [];

        const response = await adminAwardSpecialXp({
          amount: values.amount,
          reason: values.reason,
          profileIds,
          applyToAll: values.targetScope === "all",
          metadata: { source: "admin_panel" },
        });

        const awardedCount =
          typeof response.result === "object" &&
          response.result !== null &&
          "awarded_count" in response.result
            ? Number((response.result as Record<string, unknown>).awarded_count)
            : values.targetScope === "all"
              ? playerProfiles.length
              : profileIds.length;

        toast({
          title: "XP granted",
          description:
            response.message ??
            `Granted ${values.amount} XP to ${awardedCount} player${awardedCount === 1 ? "" : "s"}.`,
        });

        xpGrantForm.reset({
          targetScope: values.targetScope,
          profileId: undefined,
          profileIds: [],
          amount: values.amount,
          reason: values.reason,
        });
      } catch (error) {
        console.error("Failed to award XP", error);
        toast({
          variant: "destructive",
          title: "Unable to award XP",
          description: error instanceof Error ? error.message : "Something went wrong while granting XP.",
        });
      } finally {
        setIsAwardingXp(false);
      }
    },
    [toast, xpGrantForm, playerProfiles.length],
  );

  return (
    <AdminRoute>
      <div className="container mx-auto max-w-6xl p-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Admin Panel</h1>
          <p className="text-muted-foreground">
            Configure world data and manage gameplay balancing parameters.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle>Experience Rewards</CardTitle>
                <CardDescription>
                  Grant instant XP bonuses to individual players or the entire community.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void fetchPlayerProfiles()}
                disabled={isLoadingPlayers}
              >
                {isLoadingPlayers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Refresh players
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...xpGrantForm}>
              <form
                onSubmit={xpGrantForm.handleSubmit(handleAwardXpGrant)}
                className="space-y-6"
              >
                <FormField
                  control={xpGrantForm.control}
                  name="targetScope"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipients</FormLabel>
                      <FormDescription>Select who should receive the XP award.</FormDescription>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="grid gap-3 md:grid-cols-3"
                        >
                          <div
                            className={`rounded-md border p-3 transition ${field.value === "single" ? "border-primary" : ""}`}
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="single" id="xp-grant-single" />
                              <Label htmlFor="xp-grant-single" className="font-medium">
                                Single player
                              </Label>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Grant XP to one selected player profile.
                            </p>
                          </div>
                          <div
                            className={`rounded-md border p-3 transition ${field.value === "multiple" ? "border-primary" : ""}`}
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="multiple" id="xp-grant-multiple" />
                              <Label htmlFor="xp-grant-multiple" className="font-medium">
                                Multiple players
                              </Label>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Select a custom list of players to receive the bonus.
                            </p>
                          </div>
                          <div
                            className={`rounded-md border p-3 transition ${field.value === "all" ? "border-primary" : ""}`}
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="all" id="xp-grant-all" />
                              <Label htmlFor="xp-grant-all" className="font-medium">
                                All players
                              </Label>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Everyone with a player profile receives the reward.
                            </p>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {targetScope === "single" ? (
                  <FormField
                    control={xpGrantForm.control}
                    name="profileId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Player</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value ?? ""}
                            onValueChange={(value) => {
                              if (value.startsWith("__")) {
                                return;
                              }
                              field.onChange(value);
                            }}
                            disabled={isLoadingPlayers || playerProfiles.length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  isLoadingPlayers ? "Loading players..." : "Select a player"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {isLoadingPlayers ? (
                                <SelectItem value="__loading" disabled>
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading players...
                                  </div>
                                </SelectItem>
                              ) : playerProfiles.length === 0 ? (
                                <SelectItem value="__empty" disabled>
                                  No player profiles found
                                </SelectItem>
                              ) : (
                                playerProfiles.map((player) => (
                                  <SelectItem key={player.profileId} value={player.profileId}>
                                    <div className="flex flex-col">
                                      <span>
                                        {player.displayName ?? player.username ?? player.profileId}
                                      </span>
                                      {player.displayName && player.username ? (
                                        <span className="text-xs text-muted-foreground">
                                          {player.username}
                                        </span>
                                      ) : null}
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormDescription>
                          Select the player profile that should receive the XP grant.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

                {targetScope === "multiple" ? (
                  <FormField
                    control={xpGrantForm.control}
                    name="profileIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Players</FormLabel>
                        <FormDescription>
                          Choose one or more player profiles to receive the reward.
                        </FormDescription>
                        <FormControl>
                          <div className="rounded-md border">
                            <ScrollArea className="h-48">
                              <div className="space-y-2 p-3">
                                {isLoadingPlayers ? (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading players...
                                  </div>
                                ) : playerProfiles.length === 0 ? (
                                  <div className="text-sm text-muted-foreground">
                                    No player profiles found.
                                  </div>
                                ) : (
                                  (() => {
                                    const currentSelection = new Set(field.value ?? []);
                                    return playerProfiles.map((player) => {
                                      const id = player.profileId;
                                      const isChecked = currentSelection.has(id);
                                      return (
                                        <label
                                          key={id}
                                        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted"
                                      >
                                        <Checkbox
                                          checked={isChecked}
                                          onCheckedChange={(checked) => {
                                            const next = new Set(field.value ?? []);
                                            if (checked === true) {
                                              next.add(id);
                                            } else {
                                              next.delete(id);
                                            }
                                            field.onChange(Array.from(next));
                                          }}
                                        />
                                        <div className="flex flex-col">
                                          <span className="text-sm font-medium">
                                            {player.displayName ?? player.username ?? id}
                                          </span>
                                          {player.displayName && player.username ? (
                                            <span className="text-xs text-muted-foreground">
                                              {player.username}
                                            </span>
                                          ) : null}
                                        </div>
                                      </label>
                                    );
                                    });
                                  })()
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

                {targetScope === "all" ? (
                  <div className="rounded-md border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
                    {isLoadingPlayers
                      ? "Loading player roster..."
                      : playerProfiles.length > 0
                        ? `This will grant XP to all ${playerProfiles.length} player${playerProfiles.length === 1 ? "" : "s"}.`
                        : "This will grant XP to every player profile currently in the world."}
                  </div>
                ) : null}

                <div className="grid gap-6 md:grid-cols-[minmax(0,200px)_1fr]">
                  <FormField
                    control={xpGrantForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>XP amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            step={50}
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value)}
                          />
                        </FormControl>
                        <FormDescription>Each recipient receives this amount of XP.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={xpGrantForm.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            placeholder="Explain why the XP is being granted"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          This message appears in the player notification so they know why they were rewarded.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  {targetScope === "multiple" ? (
                    <p className="text-sm text-muted-foreground">
                      Selected {selectedProfileCount} player{selectedProfileCount === 1 ? "" : "s"}.
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    disabled={disableXpSubmit}
                  >
                    {isAwardingXp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isAwardingXp ? "Granting XP" : "Award XP"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>Maintain reference data that powers the game world.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as "universities" | "books")}
              className="space-y-6"
            >
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="universities" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Universities
                </TabsTrigger>
                <TabsTrigger value="books" className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Skill Books
                </TabsTrigger>
              </TabsList>

              <TabsContent value="universities" className="space-y-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl flex items-center justify-between">
                      {formTitle}
                      {editingUniversity ? <Badge variant="secondary">Editing</Badge> : null}
                    </CardTitle>
                    <CardDescription>{formDescription}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...universityForm}>
                      <form
                        onSubmit={universityForm.handleSubmit(handleSubmitUniversity)}
                        className="grid gap-6 md:grid-cols-2"
                      >
                        <FormField
                          control={universityForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>University Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter university name"
                                  autoComplete="organization"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={universityForm.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>City</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter city name"
                                  autoComplete="address-level2"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={universityForm.control}
                          name="prestige"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prestige (0-100)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={Number.isFinite(field.value) ? field.value : ""}
                                  onChange={(event) => field.onChange(event.target.valueAsNumber)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={universityForm.control}
                          name="qualityOfLearning"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quality of Learning (0-100)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={Number.isFinite(field.value) ? field.value : ""}
                                  onChange={(event) => field.onChange(event.target.valueAsNumber)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={universityForm.control}
                          name="courseCost"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Average Course Cost</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  step={100}
                                  value={Number.isFinite(field.value) ? field.value : ""}
                                  onChange={(event) => field.onChange(event.target.valueAsNumber)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="md:col-span-2 flex items-center justify-end gap-2">
                          {editingUniversity ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={resetUniversityForm}
                              disabled={isSubmittingUniversity}
                            >
                              Reset
                            </Button>
                          ) : null}
                          <Button type="submit" disabled={isSubmittingUniversity}>
                            {isSubmittingUniversity ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                              </>
                            ) : (
                              formTitle
                            )}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xl">
                      <span>Universities</span>
                      <div className="flex items-center gap-2">
                        <Select value={sortColumn} onValueChange={(value) => handleSortColumnChange(value as SortColumn)}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Sort by" />
                          </SelectTrigger>
                          <SelectContent>
                            {sortColumnOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleToggleSortDirection}
                        >
                          {sortDirectionLabels[sortDirection]}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleFetchUniversities()}
                          disabled={isLoadingUniversities}
                        >
                          <RefreshCcw className={`h-4 w-4 ${isLoadingUniversities ? "animate-spin" : ""}`} />
                          <span className="sr-only">Refresh universities</span>
                        </Button>
                      </div>
                    </CardTitle>
                    <CardDescription>
                      Review, edit or remove universities available to players.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                      <span>
                        {hasUniversities
                          ? `Showing ${showingRangeStart.toLocaleString()}-${showingRangeEnd.toLocaleString()} of ${totalUniversities.toLocaleString()} universities`
                          : "No universities yet"}
                      </span>
                    </div>

                    {isLoadingUniversities ? (
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" /> Loading universities...
                      </div>
                    ) : universities.length === 0 ? (
                      <p className="text-muted-foreground">
                        No universities have been defined yet. Create one using the form above.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>City</TableHead>
                            <TableHead className="hidden sm:table-cell">Prestige</TableHead>
                            <TableHead className="hidden sm:table-cell">Quality</TableHead>
                            <TableHead className="hidden md:table-cell">Course Cost</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {universities.map((university) => (
                            <TableRow key={university.id}>
                              <TableCell className="font-medium">{university.name}</TableCell>
                              <TableCell>{university.city}</TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {typeof university.prestige === "number" ? university.prestige : "-"}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {typeof university.quality_of_learning === "number"
                                  ? university.quality_of_learning
                                  : "-"}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {typeof university.course_cost === "number"
                                  ? currencyFormatter.format(university.course_cost)
                                  : "-"}
                              </TableCell>
                              <TableCell className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleEditUniversity(university)}
                                  title="Edit university"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => handleDeleteUniversity(university.id, university.city ?? university.name ?? "this university")}
                                  disabled={deletingUniversityId === university.id}
                                  title="Delete university"
                                >
                                  {deletingUniversityId === university.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}

                    {hasUniversities ? (
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              href="#"
                              className={page === 1 ? "pointer-events-none opacity-50" : undefined}
                              onClick={(event) => {
                                event.preventDefault();
                                handlePageChange(page - 1);
                              }}
                            />
                          </PaginationItem>
                          <PaginationItem>
                            <span className="px-3 text-sm text-muted-foreground">
                              Page {page} of {totalPages}
                            </span>
                          </PaginationItem>
                          <PaginationItem>
                            <PaginationNext
                              href="#"
                              className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
                              onClick={(event) => {
                                event.preventDefault();
                                handlePageChange(page + 1);
                              }}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    ) : null}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="books" className="space-y-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl flex items-center justify-between">
                      {editingSkillBook ? "Update Skill Book" : "Create Skill Book"}
                      {editingSkillBook ? <Badge variant="secondary">Editing</Badge> : null}
                    </CardTitle>
                    <CardDescription>
                      {editingSkillBook
                        ? "Adjust the selected book's details or align it with a different skill unlock."
                        : "Add a new book that players can purchase to unlock skills."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...skillBookForm}>
                      <form
                        onSubmit={skillBookForm.handleSubmit(handleSubmitSkillBook)}
                        className="grid gap-6 md:grid-cols-2"
                      >
                        <FormField
                          control={skillBookForm.control}
                          name="skillSlug"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Skill</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value} disabled={skillOptions.length === 0}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a skill" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {skillOptions.length === 0 ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                      No skill definitions available. Load definitions to continue.
                                    </div>
                                  ) : (
                                    skillOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        <div className="flex flex-col">
                                          <span>{option.name}</span>
                                          {option.track || option.tier ? (
                                            <span className="text-xs text-muted-foreground">
                                              {[option.track, option.tier].filter(Boolean).join(" · ")}
                                            </span>
                                          ) : null}
                                        </div>
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Choose which skill unlocks when players purchase this book.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={skillBookForm.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Book Title</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter the display title" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={skillBookForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Optional blurb shown to players"
                                  rows={3}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={skillBookForm.control}
                          name="cost"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cost</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  step={50}
                                  value={Number.isFinite(field.value) ? field.value : ""}
                                  onChange={(event) => field.onChange(event.target.valueAsNumber)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={skillBookForm.control}
                          name="xpValue"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>XP Reward</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={Number.isFinite(field.value) ? field.value : ""}
                                  onChange={(event) => field.onChange(event.target.valueAsNumber)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={skillBookForm.control}
                          name="isActive"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2 flex flex-col gap-2">
                              <FormLabel>Status</FormLabel>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <FormDescription>Inactive books will be hidden from players.</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="md:col-span-2 flex items-center justify-end gap-2">
                          {editingSkillBook ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={resetSkillBookForm}
                              disabled={isSubmittingSkillBook}
                            >
                              Reset
                            </Button>
                          ) : null}
                          <Button type="submit" disabled={isSubmittingSkillBook}>
                            {isSubmittingSkillBook ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                              </>
                            ) : editingSkillBook ? (
                              "Update Skill Book"
                            ) : (
                              "Create Skill Book"
                            )}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-xl">
                      Skill Books
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleSeedSkillBooks()}
                          disabled={isSeedingBooks || isLoadingSkillBooks}
                        >
                          {isSeedingBooks ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          {isSeedingBooks ? "Syncing" : "Seed from skill tree"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleFetchSkillBooks()}
                          disabled={isLoadingSkillBooks}
                          title="Refresh skill books"
                        >
                          <RefreshCcw className={`h-4 w-4 ${isLoadingSkillBooks ? "animate-spin" : ""}`} />
                          <span className="sr-only">Refresh skill books</span>
                        </Button>
                      </div>
                    </CardTitle>
                    <CardDescription>Review which books are purchasable in the Education hub.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isLoadingSkillBooks ? (
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" /> Loading skill books...
                      </div>
                    ) : skillBooks.length === 0 ? (
                      <div className="flex flex-col gap-3 text-muted-foreground">
                        <p>No skill books are defined yet. Generate them from the skill tree to get started.</p>
                        <div>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void handleSeedSkillBooks()}
                            disabled={isSeedingBooks}
                          >
                            {isSeedingBooks ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isSeedingBooks ? "Syncing" : "Generate skill books"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Skill</TableHead>
                            <TableHead className="hidden lg:table-cell">Track</TableHead>
                            <TableHead>Cost</TableHead>
                            <TableHead>XP</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {skillBooks.map((book) => {
                            const metadata = getSkillMetadata(book.skill_slug);
                            return (
                              <TableRow key={book.id}>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{book.title}</span>
                                    <span className="text-xs text-muted-foreground">{metadata.name}</span>
                                    {metadata.tier ? (
                                      <Badge variant="outline" className="mt-1 w-max">
                                        {metadata.tier}
                                      </Badge>
                                    ) : null}
                                  </div>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  <span className="text-sm text-muted-foreground">
                                    {metadata.track ?? metadata.category ?? "-"}
                                  </span>
                                </TableCell>
                                <TableCell>{currencyFormatter.format(Number(book.cost ?? 0))}</TableCell>
                                <TableCell>{Number(book.xp_value ?? BOOK_XP_VALUE)}</TableCell>
                                <TableCell>
                                  <Badge variant={book.is_active ? "default" : "secondary"}>
                                    {book.is_active ? "Active" : "Hidden"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleEditSkillBook(book)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                    <span className="sr-only">Edit {book.title}</span>
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => handleDeleteSkillBook(book.id, book.title)}
                                    disabled={deletingBookId === book.id}
                                  >
                                    {deletingBookId === book.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                    <span className="sr-only">Delete {book.title}</span>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
}

