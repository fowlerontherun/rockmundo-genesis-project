// This is a marker file - the designer tab should replace lines 1170-1291 in Merchandise.tsx with:

        <TabsContent value="designer" className="space-y-6">
          {bandId ? (
            <>
              <TShirtDesigner
                bandId={bandId}
                onSave={(designId) => {
                  toast({
                    title: "Design saved!",
                    description: "You can now use this design for merchandise.",
                  });
                }}
              />
              <SavedDesigns
                bandId={bandId}
                onUseDesign={(designId, designName) => {
                  createMerchWithDesign(designId, designName);
                }}
              />
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Please select a band first</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
