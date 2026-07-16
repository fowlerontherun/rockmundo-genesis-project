# Festival route test matrix

| Route | Assertion |
|---|---|
| `/festivals` | Festival browser heading, no blank page. |
| `/festivals/:festivalId` | Detail heading or explicit unavailable state. |
| `/festivals/:festivalId/manage` | Redirects to authorised edition or shows selector empty state. |
| Owner Stages | Create canonical stage heading and no endless loader. |
| Owner Staff | Staffing readiness heading and empty/error state. |
| Owner Permits | Permits heading and owner controls. |
| Owner Insurance | Insurance quotes/policies headings. |
| Owner Finance | Finance summary and ledger table/empty state. |
| Owner Outcomes | Edition outcomes heading. |
| Owner Settlement | Settlement readiness and report panels. |
| `/admin/festivals` | Festivals Administration heading and real tab panels. |
| Admin Data Health | Festival data health heading. |
| Admin Legacy Records | Legacy records heading. |
| Admin Audit | Festival audit log filters. |
