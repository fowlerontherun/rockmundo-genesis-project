import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Plus, UserPlus, DollarSign, Star, Music } from "lucide-react";
import { useRecordingStudioStaff, useHireRecordingStudioStaff } from "@/hooks/useRecordingStudioBusiness";
import { STUDIO_STAFF_ROLES, GENRE_SPECIALTIES } from "@/types/recording-studio-business";

interface RecordingStudioStaffManagerProps {
  studioId: string;
}

export function RecordingStudioStaffManager({ studioId }: RecordingStudioStaffManagerProps) {
  const { data: staff, isLoading } = useRecordingStudioStaff(studioId);
  const hireStaff = useHireRecordingStudioStaff();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: '',
    role: 'assistant_engineer' as const,
    skill_level: 50,
    specialty: 'all_genres' as string | null,
    salary: 800,
  });

  const handleHire = async () => {
    await hireStaff.mutateAsync({
      studio_id: studioId,
      ...newStaff,
    });
    setIsDialogOpen(false);
    setNewStaff({ name: '', role: 'assistant_engineer', skill_level: 50, specialty: 'all_genres', salary: 800 });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'chief_engineer': return '🎛️';
      case 'assistant_engineer': return '🎚️';
      case 'producer': return '🎵';
      case 'studio_manager': return '📋';
      case 'maintenance_tech': return '🔧';
      case 'runner': return '🏃';
      default: return '👤';
    }
  };

  const totalSalary = staff?.reduce((sum, s) => sum + s.salary, 0) || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Studio Staff
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Hire Staff
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Hire Studio Staff</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={newStaff.name}
                    onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                    placeholder="Staff member name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={newStaff.role}
                    onValueChange={(v) => setNewStaff({ ...newStaff, role: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STUDIO_STAFF_ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          <div className="flex flex-col">
                            <span>{role.label}</span>
                            <span className="text-xs text-muted-foreground">{role.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Genre Specialty</Label>
                  <Select
                    value={newStaff.specialty || 'all_genres'}
                    onValueChange={(v) => setNewStaff({ ...newStaff, specialty: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRE_SPECIALTIES.map((genre) => (
                        <SelectItem key={genre.value} value={genre.value}>
                          {genre.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Skill Level: {newStaff.skill_level}%</Label>
                  <Slider
                    value={[newStaff.skill_level]}
                    onValueChange={([v]) => setNewStaff({ ...newStaff, skill_level: v })}
                    min={20}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Weekly Salary: ${newStaff.salary}</Label>
                  <Slider
                    value={[newStaff.salary]}
                    onValueChange={([v]) => setNewStaff({ ...newStaff, salary: v })}
                    min={300}
                    max={3000}
                    step={100}
                  />
                </div>

                <Button 
                  onClick={handleHire} 
                  className="w-full"
                  disabled={!newStaff.name || hireStaff.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Hire for ${newStaff.salary}/week
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Loading staff...</div>
        ) : staff && staff.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">Total Weekly Payroll</span>
              <span className="font-bold text-lg">${totalSalary.toLocaleString()}</span>
            </div>

            <div className="grid gap-3">
              {staff.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getRoleIcon(member.role)}</span>
                    <div>
                      <div className="font-medium">{member.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {STUDIO_STAFF_ROLES.find(r => r.value === member.role)?.label}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {member.specialty && (
                      <Badge variant="outline" className="capitalize">
                        <Music className="h-3 w-3 mr-1" />
                        {member.specialty.replace('_', ' ')}
                      </Badge>
                    )}
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">{member.skill_level}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-green-500" />
                      <span className="text-sm">${member.salary}/wk</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No staff hired yet</p>
            <p className="text-sm">Hire engineers and producers to run sessions</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
