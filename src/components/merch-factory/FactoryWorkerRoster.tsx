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
import { Users, UserPlus } from "lucide-react";
import { useFactoryWorkers, useHireWorker } from "@/hooks/useMerchFactory";
import { WORKER_ROLES } from "@/types/merch-factory";

interface FactoryWorkerRosterProps {
  factoryId: string;
}

export function FactoryWorkerRoster({ factoryId }: FactoryWorkerRosterProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [workerName, setWorkerName] = useState("");
  const [workerRole, setWorkerRole] = useState<string>("production");
  
  const { data: workers, isLoading } = useFactoryWorkers(factoryId);
  const hireWorker = useHireWorker();
  
  const selectedRole = WORKER_ROLES.find(r => r.value === workerRole);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await hireWorker.mutateAsync({
      factory_id: factoryId,
      name: workerName,
      role: workerRole as 'production' | 'quality_control' | 'supervisor' | 'maintenance',
      skill_level: 1 + Math.random() * 0.5,
      salary_weekly: selectedRole?.baseSalary || 400,
    });
    
    setDialogOpen(false);
    setWorkerName("");
    setWorkerRole("production");
  };
  
  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'supervisor': return 'default';
      case 'quality_control': return 'secondary';
      case 'maintenance': return 'outline';
      default: return 'secondary';
    }
  };
  
  if (isLoading) {
    return <div className="text-center py-4">Loading workers...</div>;
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Factory Workers ({workers?.length || 0})
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Hire Worker
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Hire New Worker</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Worker Name</Label>
                <Input
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  placeholder="Enter worker name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={workerRole} onValueChange={setWorkerRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKER_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label} (${role.baseSalary}/week)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <p className="font-medium">Weekly Salary: ${selectedRole?.baseSalary || 400}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Workers start at skill level 1.0-1.5 and improve with experience
                </p>
              </div>
              
              <Button type="submit" className="w-full" disabled={hireWorker.isPending}>
                {hireWorker.isPending ? "Hiring..." : "Hire Worker"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {workers?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No workers hired yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Skill</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Morale</TableHead>
                <TableHead className="text-right">Salary/Week</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers?.map((worker) => (
                <TableRow key={worker.id}>
                  <TableCell className="font-medium">{worker.name}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(worker.role)} className="capitalize">
                      {worker.role.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{worker.skill_level.toFixed(1)}</span>
                      <Progress value={(worker.skill_level / 5) * 100} className="w-16 h-2" />
                    </div>
                  </TableCell>
                  <TableCell>{worker.experience_months} months</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={worker.morale} 
                        className={`w-16 h-2 ${worker.morale < 30 ? '[&>div]:bg-destructive' : worker.morale < 60 ? '[&>div]:bg-warning' : ''}`}
                      />
                      <span className="text-xs text-muted-foreground">{worker.morale}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">${worker.salary_weekly}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
