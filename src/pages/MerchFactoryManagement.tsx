import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Factory, Package, ClipboardList, Users, FileText } from "lucide-react";
import { useMerchFactory } from "@/hooks/useMerchFactory";
import { ProductCatalogManager } from "@/components/merch-factory/ProductCatalogManager";
import { ProductionQueue } from "@/components/merch-factory/ProductionQueue";
import { FactoryWorkerRoster } from "@/components/merch-factory/FactoryWorkerRoster";
import { FactoryCard } from "@/components/merch-factory/FactoryCard";
import { VipGate } from "@/components/company/VipGate";

export default function MerchFactoryManagement() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  
  const { data: factory, isLoading } = useMerchFactory(companyId);
  
  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }
  
  if (!factory) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <Factory className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Factory Not Found</h2>
          <p className="text-muted-foreground mb-4">The factory you're looking for doesn't exist.</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }
  
  return (
    <VipGate feature="Merchandise Factory" description="Manage your merch factory, create products, and fulfill orders for bands and labels.">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Factory className="h-6 w-6" />
              {factory.name}
            </h1>
            <p className="text-muted-foreground">
              {factory.city?.name}, {factory.city?.country}
            </p>
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-1">
            <FactoryCard factory={factory} onManage={() => {}} />
          </div>
          
          <div className="md:col-span-2">
            <Tabs defaultValue="catalog" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="catalog" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">Catalog</span>
                </TabsTrigger>
                <TabsTrigger value="production" className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  <span className="hidden sm:inline">Production</span>
                </TabsTrigger>
                <TabsTrigger value="workers" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Workers</span>
                </TabsTrigger>
                <TabsTrigger value="contracts" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Contracts</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="catalog">
                <ProductCatalogManager factoryId={factory.id} />
              </TabsContent>
              
              <TabsContent value="production">
                <ProductionQueue factoryId={factory.id} />
              </TabsContent>
              
              <TabsContent value="workers">
                <FactoryWorkerRoster factoryId={factory.id} />
              </TabsContent>
              
              <TabsContent value="contracts">
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Factory contracts coming soon</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </VipGate>
  );
}
