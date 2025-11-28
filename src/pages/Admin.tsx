import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AdminRoute } from "@/components/AdminRoute";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, LayoutDashboard } from "lucide-react";
import { AdminNav, adminCategories } from "@/components/admin/AdminNav";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { NationalSelectionsRunner } from "@/components/admin/NationalSelectionsRunner";

const Admin = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const navigate = useNavigate();

  // Filter items based on search
  const filteredCategories = adminCategories.map(category => ({
    ...category,
    items: category.items.filter(item => 
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.items.length > 0);

  // Get category for active tab
  const activeCategory = activeTab === "all" ? null : adminCategories.find(c => c.id === activeTab);

  return (
    <AdminRoute>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Admin Control Panel</h1>
              <p className="text-muted-foreground text-sm">Manage all game systems and configuration</p>
            </div>
          </div>
          <Badge variant="outline" className="flex items-center gap-2 w-fit">
            <LayoutDashboard className="h-4 w-4" />
            {adminCategories.length} Categories • {adminCategories.reduce((sum, cat) => sum + cat.items.length, 0)} Tools
          </Badge>
        </div>

        {/* Quick Actions */}
        <NationalSelectionsRunner />

        {/* Search */}
        <div className="max-w-md">
          <Input
            type="search"
            placeholder="Search admin tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Tabs for categories */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent p-0">
            <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              All Tools
            </TabsTrigger>
            {adminCategories.map((category) => {
              const Icon = category.icon;
              return (
                <TabsTrigger 
                  key={category.id} 
                  value={category.id}
                  className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{category.title}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* All Tools Tab */}
          <TabsContent value="all" className="mt-6">
            {searchQuery ? (
              filteredCategories.length > 0 ? (
                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground">
                    Found {filteredCategories.reduce((sum, cat) => sum + cat.items.length, 0)} results
                  </p>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredCategories.map((category) => {
                      const Icon = category.icon;
                      return (
                        <Card key={category.id} className="hover:border-primary/50 transition-colors">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Icon className="h-5 w-5 text-primary" />
                              </div>
                              <CardTitle className="text-lg">{category.title}</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-1">
                            {category.items.map((item) => (
                              <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors group"
                              >
                                <span className="text-sm font-medium group-hover:text-primary transition-colors">
                                  {item.label}
                                </span>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                                )}
                              </button>
                            ))}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertDescription>No admin tools match your search.</AlertDescription>
                </Alert>
              )
            ) : (
              <AdminNav onNavigate={(path) => navigate(path)} />
            )}
          </TabsContent>

          {/* Individual Category Tabs */}
          {adminCategories.map((category) => {
            const Icon = category.icon;
            return (
              <TabsContent key={category.id} value={category.id} className="mt-6">
                <div className="space-y-6">
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-primary/10">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl">{category.title}</CardTitle>
                          <CardDescription className="mt-1">{category.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {category.items.map((item) => (
                      <Card 
                        key={item.path}
                        className="hover:border-primary hover:shadow-md transition-all cursor-pointer group"
                        onClick={() => navigate(item.path)}
                      >
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base group-hover:text-primary transition-colors">
                            {item.label}
                          </CardTitle>
                          {item.description && (
                            <CardDescription className="text-xs">{item.description}</CardDescription>
                          )}
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </AdminRoute>
  );
};

export default Admin;
