import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useCreateMerchFactory } from "@/hooks/useMerchFactory";
import { FACTORY_TYPES } from "@/types/merch-factory";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CreateFactoryDialogProps {
  companyId: string;
}

export function CreateFactoryDialog({ companyId }: CreateFactoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [factoryType, setFactoryType] = useState<string>("apparel");
  const [cityId, setCityId] = useState<string>("");
  
  const createFactory = useCreateMerchFactory();
  
  const { data: cities } = useQuery({
    queryKey: ['cities-for-factory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('id, name, country')
        .order('name')
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createFactory.mutateAsync({
      company_id: companyId,
      name,
      factory_type: factoryType as 'apparel' | 'accessories' | 'vinyl' | 'cd' | 'posters' | 'mixed',
      city_id: cityId || null,
      quality_level: 1,
      production_capacity: 100,
      worker_count: 5,
      operating_costs_daily: 500,
    });
    
    setOpen(false);
    setName("");
    setFactoryType("apparel");
    setCityId("");
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Build Factory
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Build New Factory</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Factory Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter factory name"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="type">Factory Type</Label>
            <Select value={factoryType} onValueChange={setFactoryType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {FACTORY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <span className="flex items-center gap-2">
                      <span>{type.icon}</span>
                      <span>{type.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="city">Location</Label>
            <Select value={cityId} onValueChange={setCityId}>
              <SelectTrigger>
                <SelectValue placeholder="Select city" />
              </SelectTrigger>
              <SelectContent>
                {cities?.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}, {city.country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
            <p className="font-medium">Initial Setup:</p>
            <p className="text-muted-foreground">• 5 Workers included</p>
            <p className="text-muted-foreground">• 100 units/day capacity</p>
            <p className="text-muted-foreground">• $500/day operating costs</p>
            <p className="text-muted-foreground">• 1-Star quality rating</p>
          </div>
          
          <Button type="submit" className="w-full" disabled={createFactory.isPending}>
            {createFactory.isPending ? "Building..." : "Build Factory ($50,000)"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
