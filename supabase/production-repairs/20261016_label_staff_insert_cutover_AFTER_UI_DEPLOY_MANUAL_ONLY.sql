-- MANUAL ONLY. Apply AFTER LabelStaffTab on main has shipped to frontend.
-- RPC hire_label_staff_atomic already debits owning company and enforces
-- server-priced salary and skill. Do not run ahead of frontend deployment:
-- legacy label-management UI still performs direct label_staff INSERT.
REVOKE INSERT ON TABLE public.label_staff FROM PUBLIC, anon, authenticated;
