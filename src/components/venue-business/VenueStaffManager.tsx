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
import { useVenueStaff, useHireVenueStaff, useFireVenueStaff } from "@/hooks/useVenueBusiness";
import { VENUE_STAFF_ROLES } from "@/types/venue-business";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface VenueStaffManagerProps {
  venueId: string;
}

export function VenueStaffManager({ venueId }: VenueStaffManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState<string>("bartender");
  
  const { data: staff, isLoading } = useVenueStaff(venueId);
  const hireStaff = useHireVenueStaff();
  const fireStaff = useFireVenueStaff();
  
  const selectedRole = VENUE_STAFF_ROLES.find(r => r.value === staffRole);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await hireStaff.mutateAsync({
      venue_id: venueId,
      name: staffName,
      role: staffRole,
      skill_level: 1 + Math.random() * 1.5,
      salary_weekly: selectedRole?.baseSalary || 400,
    });
    
    setDialogOpen(false);
    setStaffName("");
    setStaffRole("bartender");
  };
  
  const handleFire = async (staffId: string) => {
    await fireStaff.mutateAsync({ staffId, venueId });
  };
  
  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'manager': return 'default';
      case 'sound_engineer': return 'secondary';
      case 'security': return 'destructive';
      default: return 'outline';
    }
  };
  
  const totalWeeklySalaries = staff?.reduce((sum, s) => sum + s.salary_weekly, 0) || 0;
  
  if (isLoading) {
    return <div className="text-center py-4">Loading staff...</div>;
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Venue Staff ({staff?.length || 0})
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Weekly payroll: ${totalWeeklySalaries.toLocaleString()}
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
              <DialogTitle>Hire Venue Staff</DialogTitle>
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
                    {VENUE_STAFF_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div>
                          <span>{role.label}</span>
                          <span className="text-muted-foreground ml-2">(${role.baseSalary}/wk)</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedRole && (
                  <p className="text-xs text-muted-foreground">{selectedRole.description}</p>
                )}
              </div>
              
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <p className="font-medium">Weekly Salary: ${selectedRole?.baseSalary || 400}</p>
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
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Skill</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="text-right">Salary/Wk</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff?.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(member.role)}>
                      {VENUE_STAFF_ROLES.find(r => r.value === member.role)?.label || member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={(member.skill_level / 5) * 100} className="w-16 h-2" />
                      <span className="text-xs">{member.skill_level.toFixed(1)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {"⭐".repeat(Math.round(member.performance_rating))}
                  </TableCell>
                  <TableCell className="text-right">${member.salary_weekly.toLocaleString()}</TableCell>
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
                            This will terminate their employment. This action cannot be undone.
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
