import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Package } from "lucide-react";
import { useProductCatalog, useCreateProduct } from "@/hooks/useMerchFactory";
import { PRODUCT_TYPES } from "@/types/merch-factory";

interface ProductCatalogManagerProps {
  factoryId: string;
}

export function ProductCatalogManager({ factoryId }: ProductCatalogManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [productType, setProductType] = useState<string>("");
  const [baseCost, setBaseCost] = useState("");
  const [suggestedPrice, setSuggestedPrice] = useState("");
  
  const { data: products, isLoading } = useProductCatalog(factoryId);
  const createProduct = useCreateProduct();
  
  const handleProductTypeChange = (type: string) => {
    setProductType(type);
    const typeInfo = PRODUCT_TYPES.find(t => t.value === type);
    if (typeInfo) {
      setBaseCost(typeInfo.baseCost.toString());
      setSuggestedPrice(typeInfo.suggestedPrice.toString());
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createProduct.mutateAsync({
      factory_id: factoryId,
      product_name: productName,
      product_type: productType as typeof PRODUCT_TYPES[number]['value'],
      base_cost: parseFloat(baseCost),
      suggested_price: parseFloat(suggestedPrice),
      production_time_hours: 1,
      min_order_quantity: 10,
    });
    
    setDialogOpen(false);
    setProductName("");
    setProductType("");
    setBaseCost("");
    setSuggestedPrice("");
  };
  
  if (isLoading) {
    return <div className="text-center py-4">Loading catalog...</div>;
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Product Catalog
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Product to Catalog</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Product Type</Label>
                <Select value={productType} onValueChange={handleProductTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g., Classic Band Tee"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Base Cost ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={baseCost}
                    onChange={(e) => setBaseCost(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Suggested Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={suggestedPrice}
                    onChange={(e) => setSuggestedPrice(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={createProduct.isPending}>
                {createProduct.isPending ? "Adding..." : "Add Product"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {products?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No products in catalog yet</p>
            <p className="text-sm">Add products to start taking orders</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Base Cost</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Min Order</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products?.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.product_name}</TableCell>
                  <TableCell className="capitalize">{product.product_type}</TableCell>
                  <TableCell className="text-right">${product.base_cost}</TableCell>
                  <TableCell className="text-right">${product.suggested_price}</TableCell>
                  <TableCell className="text-right">{product.min_order_quantity}</TableCell>
                  <TableCell>
                    <Badge variant={product.is_active ? "default" : "secondary"}>
                      {product.is_active ? "Active" : "Inactive"}
                    </Badge>
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
