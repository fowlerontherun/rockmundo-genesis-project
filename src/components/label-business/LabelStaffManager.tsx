import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, UserPlus, UserMinus } from "lucide-react";
import { useLabelStaff, useHireLabelStaff, useFireLabelStaff } from "@/hooks/useLabelBusiness";
import { STAFF_ROLES } from "@/types/label-business";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface LabelStaffManagerProps {
  labelId: string;
}

export function LabelStaffManager({ labelId }: LabelStaffManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState<string>("a_and_r");
  const [specialtyGenre, setSpecialtyGenre] = useState("");
  
  const { data: staff, isLoading } = useLabelStaff(labelId);
  const hireStaff = useHireLabelStaff();
  const fireStaff = useFireLabelStaff();
  
  const selectedRole = STAFF_ROLES.find(r => r.value === staffRole);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await hireStaff.mutateAsync({
      label_id: labelId,
      name: staffName,
      role: staffRole,
      skill_level: 1 + Math.random() * 1.5,
      specialty_genre: specialtyGenre || undefined,
      salary_monthly: selectedRole?.baseSalary || 3000,
    });
    
    setDialogOpen(false);
    setStaffName("");
    setStaffRole("a_and_r");
    setSpecialtyGenre("");
  };
  
  const handleFire = async (staffId: string) => {
    await fireStaff.mutateAsync({ staffId, labelId });
  };
  
  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'a_and_r': return 'default';
      case 'legal': return 'destructive';
      case 'producer': return 'secondary';
      default: return 'outline';
    }
  };
  
  const totalMonthlySalaries = staff?.reduce((sum, s) => sum + s.salary_monthly, 0) || 0;
  
  if (isLoading) {
    return <div className="text-center py-4">Loading staff...</div>;
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Label Staff ({staff?.length || 0})
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Monthly payroll: ${totalMonthlySalaries.toLocaleString()}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Hire Staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Hire New Staff Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="Enter staff name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={staffRole} onValueChange={setStaffRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div>
                          <span>{role.label}</span>
                          <span className="text-muted-foreground ml-2">(${role.baseSalary}/mo)</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedRole && (
                  <p className="text-xs text-muted-foreground">{selectedRole.description}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Specialty Genre (Optional)</Label>
                <Input
                  value={specialtyGenre}
                  onChange={(e) => setSpecialtyGenre(e.target.value)}
                  placeholder="e.g., Rock, Hip-Hop, Electronic"
                />
              </div>
              
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <p className="font-medium">Monthly Salary: ${selectedRole?.baseSalary || 3000}</p>
              </div>
              
              <Button type="submit" className="w-full" disabled={hireStaff.isPending}>
                {hireStaff.isPending ? "Hiring..." : "Hire Staff Member"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {staff?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No staff hired yet</p>
            <p className="text-sm">Hire A&R scouts, marketers, and more</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Skill</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="text-right">Salary/Mo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff?.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(member.role)}>
                      {STAFF_ROLES.find(r => r.value === member.role)?.label || member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={(member.skill_level / 5) * 100} className="w-16 h-2" />
                      <span className="text-xs">{member.skill_level.toFixed(1)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.specialty_genre || '-'}
                  </TableCell>
                  <TableCell>
                    {"⭐".repeat(Math.round(member.performance_rating))}
                  </TableCell>
                  <TableCell className="text-right">${member.salary_monthly.toLocaleString()}</TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Release {member.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will terminate their employment with the label. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleFire(member.id)}>
                            Release
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
