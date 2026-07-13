# HubLayout

`HubLayout` is the shared shell for incremental section migrations. Keep routes static in the app route table; pass the section's existing links as typed `HubNavigationItem` objects so tabs, selected state and breadcrumbs come from one source.

```tsx
<HubLayout
  title="Character"
  description="Manage identity, progression, wellness and possessions."
  icon={Users}
  overviewPath="/character"
  navigation={characterHubNavigation}
  actions={[{ label: "Edit character", path: "/my-character" }]}
>
  <CharacterOverviewContent />
</HubLayout>
```
