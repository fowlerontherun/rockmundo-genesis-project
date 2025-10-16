import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { Tables } from "@/lib/supabase-types";
import { useMergedSkillDefinitions } from "@/utils/skillDefinitions";

type SkillBook = Tables<"skill_books">;

const SkillBooks = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<SkillBook | null>(null);
  const [filter, setFilter] = useState({ category: "all", skill: "all" });

  const [formData, setFormData] = useState({
    skill_slug: "",
    title: "",
    author: "",
    description: "",
    price: 500,
    base_reading_days: 3,
    skill_percentage_gain: 5.0,
    required_skill_level: 0,
    category: "",
    is_active: true,
  });

  const { data: books, isLoading } = useQuery({
    queryKey: ["admin_skill_books"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skill_books")
        .select(`
          *,
          skill_definitions (slug, display_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: skills } = useQuery({
    queryKey: ["skill_definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skill_definitions")
        .select("slug, display_name")
        .order("display_name");

      if (error) throw error;
      return data;
    },
  });

  const { list: skillOptions, map: skillOptionMap } = useMergedSkillDefinitions(skills ?? []);

  const getSkillDisplayName = useCallback(
    (slug: string) =>
      skillOptionMap.get(slug)?.displayName ||
      skills?.find((skill) => skill.slug === slug)?.display_name ||
      slug,
    [skillOptionMap, skills],
  );

  const createOrUpdateBook = useMutation({
    mutationFn: async (book: typeof formData & { id?: string }) => {
      if (book.id) {
        const { error } = await supabase
          .from("skill_books")
          .update(book)
          .eq("id", book.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("skill_books").insert(book);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_skill_books"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: editingBook ? "Book Updated" : "Book Created",
        description: `The book has been ${editingBook ? "updated" : "created"} successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteBook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("skill_books").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_skill_books"] });
      toast({
        title: "Book Deleted",
        description: "The book has been removed.",
      });
    },
  });

  const resetForm = () => {
    setEditingBook(null);
    setFormData({
      skill_slug: "",
      title: "",
      author: "",
      description: "",
      price: 500,
      base_reading_days: 3,
      skill_percentage_gain: 5.0,
      required_skill_level: 0,
      category: "",
      is_active: true,
    });
  };

  const handleEdit = (book: SkillBook) => {
    setEditingBook(book);
    setFormData({
      skill_slug: book.skill_slug,
      title: book.title,
      author: book.author || "",
      description: book.description || "",
      price: book.price,
      base_reading_days: book.base_reading_days,
      skill_percentage_gain: Number(book.skill_percentage_gain),
      required_skill_level: book.required_skill_level,
      category: book.category || "",
      is_active: book.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createOrUpdateBook.mutate(
      editingBook ? { ...formData, id: editingBook.id } : formData
    );
  };

  const categories = Array.from(new Set(books?.map((b) => b.category).filter(Boolean)));
  const filteredBooks = books?.filter((book) => {
    if (filter.category !== "all" && book.category !== filter.category) return false;
    if (filter.skill !== "all" && book.skill_slug !== filter.skill) return false;
    return true;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Skill Books</h1>
          <p className="text-muted-foreground">Manage learning books for players</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add Book
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingBook ? "Edit Book" : "Add New Book"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="author">Author</Label>
                  <Input
                    id="author"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="skill">Skill *</Label>
                  <Select
                    value={formData.skill_slug}
                    onValueChange={(value) => setFormData({ ...formData, skill_slug: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select skill" />
                    </SelectTrigger>
                    <SelectContent>
                      {skillOptions.map((skill) => (
                        <SelectItem key={skill.slug} value={skill.slug}>
                          {skill.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Foundational Musicianship"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) })}
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="days">Reading Days (2-4)</Label>
                  <Input
                    id="days"
                    type="number"
                    value={formData.base_reading_days}
                    onChange={(e) => setFormData({ ...formData, base_reading_days: parseInt(e.target.value) })}
                    min="2"
                    max="4"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gain">Skill Gain % (levels)</Label>
                  <Input
                    id="gain"
                    type="number"
                    step="0.5"
                    value={formData.skill_percentage_gain}
                    onChange={(e) => setFormData({ ...formData, skill_percentage_gain: parseFloat(e.target.value) })}
                    min="0"
                    max="100"
                  />
                  <p className="text-xs text-muted-foreground">
                    How many skill levels to gain (e.g., 5 = gain 5 levels, 0.5 = half a level)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="required">Required Level</Label>
                  <Input
                    id="required"
                    type="number"
                    value={formData.required_skill_level}
                    onChange={(e) => setFormData({ ...formData, required_skill_level: parseInt(e.target.value) })}
                    min="0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingBook ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4">
        <div className="flex gap-4 mb-4">
          <Select value={filter.category} onValueChange={(value) => setFilter({ ...filter, category: value })}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat!}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filter.skill} onValueChange={(value) => setFilter({ ...filter, skill: value })}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by skill" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Skills</SelectItem>
              {skillOptions.map((skill) => (
                <SelectItem key={skill.slug} value={skill.slug}>
                  {skill.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Skill</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Skill Gain</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredBooks?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  No books found
                </TableCell>
              </TableRow>
            ) : (
              filteredBooks?.map((book) => (
                <TableRow key={book.id}>
                  <TableCell className="font-medium">{book.title}</TableCell>
                  <TableCell>{book.author}</TableCell>
                  <TableCell>{getSkillDisplayName(book.skill_slug)}</TableCell>
                  <TableCell>{book.category}</TableCell>
                  <TableCell>${book.price}</TableCell>
                  <TableCell>{book.base_reading_days}d</TableCell>
                  <TableCell>+{book.skill_percentage_gain} lvls</TableCell>
                  <TableCell>
                    <span className={book.is_active ? "text-green-600" : "text-red-600"}>
                      {book.is_active ? "Yes" : "No"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(book)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteBook.mutate(book.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default SkillBooks;