import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserPlus, UserMinus, Star, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { STAFF_ROLES } from "@/types/label-business";

interface LabelStaffTabProps {
  labelId: string;
  labelBalance: number;
}

const ROLE_COLORS: Record<string, string> = {
  a_and_r: "bg-purple-500/20 text-purple-500",
  marketing: "bg-blue-500/20 text-blue-500",
  promoter: "bg-emerald-500/20 text-emerald-500",
  accountant: "bg-amber-500/20 text-amber-500",
  legal: "bg-red-500/20 text-red-500",
  producer: "bg-pink-500/20 text-pink-500",
  manager: "bg-cyan-500/20 text-cyan-500",
};

const FIRST_NAMES = ["Alex", "Jordan", "Casey", "Morgan", "Riley", "Taylor", "Quinn", "Avery", "Reese", "Cameron", "Dakota", "Skyler", "Hayden", "Jamie", "Drew", "Blake", "Parker", "Spencer"];
const LAST_NAMES = ["Chen", "Williams", "Garcia", "Martinez", "Johnson", "Davis", "Rodriguez", "Miller", "Wilson", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Clark"];

function randomName() {
  return `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`;
}

export function LabelStaffTab({ labelId, labelBalance }: LabelStaffTabProps) {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<string>("");

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["label-staff", labelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("label_staff")
        .select("*")
        .eq("label_id", labelId)
        .order("role");

      if (error) throw error;
      return data || [];
    },
  });

  const hireMutation = useMutation({
    mutationFn: async (role: string) => {
      const roleInfo = STAFF_ROLES.find(r => r.value === role);
      if (!roleInfo) throw new Error("Invalid role");

      const skillLevel = 30 + Math.floor(Math.random() * 40); // 30-70
      const salary = Math.round(roleInfo.baseSalary * (0.8 + Math.random() * 0.4));

      const { error } = await supabase
        .from("label_staff")
        .insert({
          label_id: labelId,
          name: randomName(),
          role,
          skill_level: skillLevel,
          salary_monthly: salary,
          performance_rating: 50,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-staff", labelId] });
      toast.success("Staff member hired!");
      setSelectedRole("");
    },
    onError: (error: Error) => toast.error(`Failed to hire: ${error.message}`),
  });

  const fireMutation = useMutation({
    mutationFn: async (staffId: string) => {
      const { error } = await supabase
        .from("label_staff")
        .delete()
        .eq("id", staffId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-staff", labelId] });
      toast.success("Staff member released");
    },
    onError: () => toast.error("Failed to release staff"),
  });

  const totalMonthlySalary = staff.reduce((sum, s) => sum + (s.salary_monthly ?? 0), 0);

  if (isLoading) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">Loading staff...</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      {/* Hire New Staff */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Hire Staff
              </h3>
              <p className="text-sm text-muted-foreground">
                Monthly payroll: ${totalMonthlySalary.toLocaleString()}/mo
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Choose a role to hire..." />
              </SelectTrigger>
              <SelectContent>
                {STAFF_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    <div className="flex items-center justify-between gap-4">
                      <span>{role.label}</span>
                      <span className="text-xs text-muted-foreground">~${role.baseSalary}/mo</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => selectedRole && hireMutation.mutate(selectedRole)}
              disabled={!selectedRole || hireMutation.isPending}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Hire
            </Button>
          </div>
          {selectedRole && (
            <p className="text-xs text-muted-foreground mt-2">
              {STAFF_ROLES.find(r => r.value === selectedRole)?.description}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Staff List */}
      {staff.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No staff hired yet</p>
            <p className="text-sm">Hire staff to improve label operations</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {staff.map((member) => {
            const roleInfo = STAFF_ROLES.find(r => r.value === member.role);
            const roleColor = ROLE_COLORS[member.role] || "bg-muted text-muted-foreground";

            return (
              <Card key={member.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <div className="flex items-center gap-2">
                        <Badge className={`${roleColor} border-0 text-xs`}>
                          {roleInfo?.label || member.role}
                        </Badge>
                        {member.specialty_genre && (
                          <Badge variant="outline" className="text-xs">{member.specialty_genre}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-500" />
                        <span>Skill: {member.skill_level}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="h-3 w-3" />
                        <span>${member.salary_monthly}/mo</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => fireMutation.mutate(member.id)}
                      disabled={fireMutation.isPending}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
