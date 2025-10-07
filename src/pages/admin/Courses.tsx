import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface Course {
  id: string;
  university_id: string;
  skill_slug: string;
  name: string;
  description: string | null;
  base_price: number;
  base_duration_days: number;
  required_skill_level: number;
  xp_per_day_min: number;
  xp_per_day_max: number;
  max_enrollments: number | null;
  is_active: boolean;
}

interface University {
  id: string;
  name: string;
}

interface SkillDefinition {
  id: string;
  slug: string;
  display_name: string;
}

export default function Courses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    university_id: "",
    skill_slug: "",
    name: "",
    description: "",
    base_price: 5000,
    base_duration_days: 4,
    required_skill_level: 0,
    xp_per_day_min: 1,
    xp_per_day_max: 3,
    max_enrollments: null as number | null,
    is_active: true,
  });

  const { data: courses, isLoading } = useQuery({
    queryKey: ["university_courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("university_courses")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Course[];
    },
  });

  const { data: universities } = useQuery({
    queryKey: ["universities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("universities")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as University[];
    },
  });

  const { data: skills } = useQuery({
    queryKey: ["skill_definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skill_definitions")
        .select("id, slug, display_name")
        .order("display_name");
      if (error) throw error;
      return data as SkillDefinition[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof formData) => {
      if (editingId) {
        const { error } = await supabase
          .from("university_courses")
          .update(values)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("university_courses").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["university_courses"] });
      toast({
        title: editingId ? "Course updated" : "Course created",
        description: "Changes saved successfully.",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("university_courses")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["university_courses"] });
      toast({
        title: "Course deleted",
        description: "Course removed successfully.",
      });
    },
  });

  const handleOpenDialog = (course?: Course) => {
    if (course) {
      setEditingId(course.id);
      setFormData({
        university_id: course.university_id,
        skill_slug: course.skill_slug,
        name: course.name,
        description: course.description || "",
        base_price: course.base_price,
        base_duration_days: course.base_duration_days,
        required_skill_level: course.required_skill_level,
        xp_per_day_min: course.xp_per_day_min,
        xp_per_day_max: course.xp_per_day_max,
        max_enrollments: course.max_enrollments,
        is_active: course.is_active,
      });
    } else {
      setEditingId(null);
      setFormData({
        university_id: "",
        skill_slug: "",
        name: "",
        description: "",
        base_price: 5000,
        base_duration_days: 4,
        required_skill_level: 0,
        xp_per_day_min: 1,
        xp_per_day_max: 3,
        max_enrollments: null,
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
  };

  const getUniversityName = (id: string) => {
    return universities?.find((u) => u.id === id)?.name || "Unknown";
  };

  const getSkillName = (slug: string) => {
    return skills?.find((s) => s.slug === slug)?.display_name || slug;
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">University Courses</h1>
          <p className="text-muted-foreground">Manage course offerings</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Course
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Course Name</TableHead>
            <TableHead>University</TableHead>
            <TableHead>Skill</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Req. Level</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {courses?.map((course) => (
            <TableRow key={course.id}>
              <TableCell className="font-medium">{course.name}</TableCell>
              <TableCell>{getUniversityName(course.university_id)}</TableCell>
              <TableCell>{getSkillName(course.skill_slug)}</TableCell>
              <TableCell>${course.base_price.toLocaleString()}</TableCell>
              <TableCell>{course.base_duration_days} days</TableCell>
              <TableCell>{course.required_skill_level}</TableCell>
              <TableCell>
                <Badge variant={course.is_active ? "default" : "secondary"}>
                  {course.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenDialog(course)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(course.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Course" : "Add Course"}</DialogTitle>
            <DialogDescription>
              Configure the course details below.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="university">University</Label>
                <Select
                  value={formData.university_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, university_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select university" />
                  </SelectTrigger>
                  <SelectContent>
                    {universities?.map((uni) => (
                      <SelectItem key={uni.id} value={uni.id}>
                        {uni.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="skill">Skill</Label>
                <Select
                  value={formData.skill_slug}
                  onValueChange={(value) =>
                    setFormData({ ...formData, skill_slug: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select skill" />
                  </SelectTrigger>
                  <SelectContent>
                    {skills?.map((skill) => (
                      <SelectItem key={skill.slug} value={skill.slug}>
                        {skill.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="name">Course Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="price">Base Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  value={formData.base_price}
                  onChange={(e) =>
                    setFormData({ ...formData, base_price: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="duration">Duration (days)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={formData.base_duration_days}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      base_duration_days: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="req_level">Required Skill Level</Label>
                <Input
                  id="req_level"
                  type="number"
                  min="0"
                  value={formData.required_skill_level}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      required_skill_level: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="max_enroll">Max Enrollments</Label>
                <Input
                  id="max_enroll"
                  type="number"
                  min="1"
                  value={formData.max_enrollments || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_enrollments: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Unlimited"
                />
              </div>
              <div>
                <Label htmlFor="xp_min">Min XP/Day</Label>
                <Input
                  id="xp_min"
                  type="number"
                  min="1"
                  max="3"
                  value={formData.xp_per_day_min}
                  onChange={(e) =>
                    setFormData({ ...formData, xp_per_day_min: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="xp_max">Max XP/Day</Label>
                <Input
                  id="xp_max"
                  type="number"
                  min="1"
                  max="3"
                  value={formData.xp_per_day_max}
                  onChange={(e) =>
                    setFormData({ ...formData, xp_per_day_max: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div className="col-span-2 flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label htmlFor="active">Course is Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
