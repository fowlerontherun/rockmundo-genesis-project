import { useState } from "react";
import { motion } from "framer-motion";
import { Package, Zap, BookOpen, Sparkles, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnderworldStore, type UnderworldProduct } from "@/hooks/useUnderworldStore";
import { ProductCard } from "./ProductCard";
import { PurchaseDialog } from "./PurchaseDialog";
import { ActiveBoostsIndicator } from "./ActiveBoostsIndicator";

const categories = [
  { id: "all", label: "All Items", icon: Package },
  { id: "consumable", label: "Consumables", icon: Zap },
  { id: "booster", label: "Boosters", icon: Sparkles },
  { id: "skill_book", label: "Skill Books", icon: BookOpen },
];

export const UnderworldStoreTab = () => {
  const { products, productsLoading, userBalance, activeBoosts } = useUnderworldStore();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<UnderworldProduct | null>(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);

  const filteredProducts =
    selectedCategory === "all"
      ? products
      : products.filter((p) => p.category === selectedCategory);

  const handlePurchase = (product: UnderworldProduct) => {
    setSelectedProduct(product);
    setPurchaseDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Active Boosts */}
      {activeBoosts.length > 0 && <ActiveBoostsIndicator boosts={activeBoosts} />}

      {/* Balance & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-2">
            <span className="text-sm text-muted-foreground">Balance:</span>
            <span className="ml-2 text-lg font-bold text-primary">
              ${userBalance.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const count =
              cat.id === "all"
                ? products.length
                : products.filter((p) => p.category === cat.id).length;

            return (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
                className="gap-2"
              >
                <Icon className="h-4 w-4" />
                {cat.label}
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                  {count}
                </Badge>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Product Grid */}
      {productsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Filter className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No products available</h3>
          <p className="text-muted-foreground">Check back later for new items.</p>
        </div>
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {filteredProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <ProductCard
                product={product}
                onPurchase={handlePurchase}
                userBalance={userBalance}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Purchase Dialog */}
      <PurchaseDialog
        product={selectedProduct}
        open={purchaseDialogOpen}
        onOpenChange={setPurchaseDialogOpen}
        userBalance={userBalance}
      />
    </div>
  );
};
