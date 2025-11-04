import { z } from "zod";

export const courseSchema = z
  .object({
    university_id: z.string().min(1, "Select a university"),
    skill_slug: z.string().min(1, "Select a skill"),
    name: z
      .string()
      .min(3, "Course name must be at least 3 characters")
      .max(120, "Course name is too long"),
    description: z
      .string()
      .max(500, "Description should be under 500 characters")
      .optional()
      .or(z.literal("")),
    base_price: z
      .number({ invalid_type_error: "Enter a base price" })
      .min(0, "Price must be positive")
      .max(1_000_000, "Price is unusually high"),
    base_duration_days: z
      .number({ invalid_type_error: "Enter a duration" })
      .int("Duration must be whole days")
      .min(1, "At least one day")
      .max(180, "Duration cannot exceed 180 days"),
    required_skill_level: z
      .number({ invalid_type_error: "Enter required skill level" })
      .int("Skill level must be an integer")
      .min(0, "Skill level cannot be negative")
      .max(100, "Skill level must be 100 or lower"),
    xp_per_day_min: z
      .number({ invalid_type_error: "Enter minimum XP" })
      .int("XP must be whole numbers")
      .min(0, "XP cannot be negative")
      .max(1000, "XP per day seems too high"),
    xp_per_day_max: z
      .number({ invalid_type_error: "Enter maximum XP" })
      .int("XP must be whole numbers")
      .min(0, "XP cannot be negative")
      .max(1000, "XP per day seems too high"),
    max_enrollments: z
      .number()
      .int("Max enrollments must be a whole number")
      .min(1, "At least one seat")
      .max(500, "Seat count too high")
      .nullable()
      .optional(),
    is_active: z.boolean(),
    class_start_hour: z
      .number({ invalid_type_error: "Enter class start hour" })
      .int()
      .min(0, "Start hour must be between 0-23")
      .max(23, "Start hour must be between 0-23"),
    class_end_hour: z
      .number({ invalid_type_error: "Enter class end hour" })
      .int()
      .min(1, "End hour must be after start")
      .max(24, "End hour cannot exceed 24"),
  })
  .refine((data) => data.xp_per_day_max >= data.xp_per_day_min, {
    message: "Max XP must be greater than or equal to min XP",
    path: ["xp_per_day_max"],
  })
  .refine((data) => data.class_end_hour > data.class_start_hour, {
    message: "Class end hour must be after start hour",
    path: ["class_end_hour"],
  });

export type CourseFormValues = z.infer<typeof courseSchema>;
