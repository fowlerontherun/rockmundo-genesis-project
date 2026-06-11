import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Factory, Package, ClipboardList, Users, FileText } from "lucide-react";
import { useMerchFactory } from "@/hooks/useMerchFactory";
import { ProductCatalogManager } from "@/components/merch-factory/ProductCatalogManager";
import { ProductionQueue } from "@/components/merch-factory/ProductionQueue";
import { FactoryWorkerRoster } from "@/components/merch-factory/FactoryWorkerRoster";
import { FactoryContractsManager } from "@/components/merch-factory/FactoryContractsManager";
import { FactoryCard } from "@/components/merch-factory/FactoryCard";
import { VipGate } from "@/components/company/VipGate";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

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
    <VipGate feature="Merchandise Factory" description="Produce merch and fulfill orders.">
      <FMPageScaffold
        title={factory.name}
        subtitle={`${factory.city?.name}, ${factory.city?.country}`}
        icon={Factory}
        backTo="/my-companies"
        backLabel="Back to Companies"
      >
        
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-1">
            <FactoryCard factory={factory} />
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
                <FactoryContractsManager factoryId={factory.id} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </VipGate>
  );
}
