# Festival management permissions

This matrix documents the least-privilege contract for the owner operations dashboard. The complete commercial summary is limited to the festival owner, delegated managers, operations managers, finance managers, administrators, and service-role workflows.

| Capability | Owner/Admin | Delegated manager | Operations manager | Stage manager | Talent booker | Finance manager | Safety officer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Overview | Full | Full | Full | Limited | Limited | Full | Limited |
| Schedule | Full | Full | Full | Full | View slots | View | Safety view |
| Lineup | Full | Full | Full | View | Full | View costs | Safety view |
| Contracts | Full | Full | Full | Status only | Booking status | Financial terms | Safety status only |
| Staff identities | Full | Full | Full | Stage staff only | No | Full | Safety staff only |
| Staff wages | Full | Full | Full | No | No | Full | No |
| Finance | Full | Full | Full | No | No | Full | No |
| Tickets | Full | Full | Full | Capacity/status | Sales status only | Full | Capacity/status |
| Permits | Full | Full | Full | Stage-related | Event status | Cost view | Full safety view |
| Insurance | Full | Full | Full | Status only | Status only | Full commercial details | Status and dates only |
| Data health | Full | Full | Full | No | No | Full | No |
| Settlement | Full | Full | Full | No | No | Full | No |

Sensitive database rows must be projected into explicit JSON objects. The operations RPC must not expose whole staff, finance, insurance, contract, or data-health rows to limited roles. Ticket sales remain unavailable for real festivals until a canonical sales ledger exists; current audience generation tables are simulation inputs, not commercial sales authority.
