import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Building2, Disc, Shield, Factory, Building, Music, Plus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useCreateCompany } from "@/hooks/useCompanies";
import { useGameData } from "@/hooks/useGameData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CompanyType, Company } from "@/types/company";
import { COMPANY_TYPE_INFO } from "@/types/company";

const formSchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters").max(50, "Company name cannot exceed 50 characters"),
  company_type: z.enum(['holding', 'label', 'security', 'factory', 'venue', 'rehearsal']),
  description: z.string().max(500, "Description cannot exceed 500 characters").optional(),
  headquarters_city_id: z.string().optional(),
  parent_company_id: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CreateCompanyDialogProps {
  trigger?: React.ReactNode;
  parentCompanyId?: string;
  allowedTypes?: CompanyType[];
  holdingCompanies?: Company[];
}

const CompanyTypeIcon = ({ type }: { type: CompanyType }) => {
  const iconProps = { className: "h-5 w-5" };
  
  switch (type) {
    case 'holding':
      return <Building2 {...iconProps} />;
    case 'label':
      return <Disc {...iconProps} />;
    case 'security':
      return <Shield {...iconProps} />;
    case 'factory':
      return <Factory {...iconProps} />;
    case 'venue':
      return <Building {...iconProps} />;
    case 'rehearsal':
      return <Music {...iconProps} />;
    default:
      return <Building2 {...iconProps} />;
  }
};

export const CreateCompanyDialog = ({
  trigger,
  parentCompanyId,
  allowedTypes,
  holdingCompanies = [],
}: CreateCompanyDialogProps) => {
  const [open, setOpen] = useState(false);
  const { currentCity } = useGameData();
  const createCompany = useCreateCompany();

  // Fetch cities for headquarters selection
  const { data: cities } = useQuery({
    queryKey: ["cities-for-company"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, country")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      company_type: parentCompanyId ? "label" : "holding",
      description: "",
      headquarters_city_id: currentCity?.id || "",
      parent_company_id: parentCompanyId || "",
    },
  });

  const selectedType = form.watch("company_type");

  // Filter available types
  const availableTypes = allowedTypes || (
    parentCompanyId 
      ? (['label', 'security', 'factory', 'venue', 'rehearsal'] as CompanyType[])
      : (['holding'] as CompanyType[])
  );

  const onSubmit = async (data: FormData) => {
    await createCompany.mutateAsync({
      name: data.name,
      company_type: data.company_type,
      description: data.description,
      headquarters_city_id: data.headquarters_city_id || undefined,
      parent_company_id: data.parent_company_id || undefined,
    });
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Company
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {parentCompanyId ? "Create Subsidiary" : "Create Your Company"}
          </DialogTitle>
          <DialogDescription>
            {parentCompanyId 
              ? "Add a new subsidiary to your holding company"
              : "Start your business empire with a holding company"
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Company Type Selection */}
            <FormField
              control={form.control}
              name="company_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="grid grid-cols-2 gap-3"
                    >
                      {availableTypes.map((type) => {
                        const info = COMPANY_TYPE_INFO[type];
                        return (
                          <div key={type}>
                            <RadioGroupItem
                              value={type}
                              id={type}
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor={type}
                              className={`flex flex-col items-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-all ${info.color}`}
                            >
                              <CompanyTypeIcon type={type} />
                              <span className="text-sm font-medium text-foreground">{info.label}</span>
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  </FormControl>
                  {selectedType && (
                    <FormDescription>
                      {COMPANY_TYPE_INFO[selectedType].description}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Company Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter company name..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe your company..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Headquarters City */}
            <FormField
              control={form.control}
              name="headquarters_city_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Headquarters City</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a city..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[200px]">
                      {cities?.map((city) => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.name}, {city.country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Parent Company (only shown for subsidiaries without preset parent) */}
            {!parentCompanyId && holdingCompanies.length > 0 && selectedType !== 'holding' && (
              <FormField
                control={form.control}
                name="parent_company_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Holding Company</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select parent company..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {holdingCompanies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Optional: Link this company to a holding company
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={createCompany.isPending}
              >
                {createCompany.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Company
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
