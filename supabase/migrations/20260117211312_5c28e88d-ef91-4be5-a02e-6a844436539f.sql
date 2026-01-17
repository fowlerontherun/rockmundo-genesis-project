-- Insert cron job configurations for company management functions
INSERT INTO cron_job_config (job_name, display_name, description, schedule, edge_function_name, is_active, allow_manual_trigger) VALUES
('process_company_payroll', 'Process Company Payroll', 'Daily payroll processing for all company employees', '30 0 * * *', 'process-company-payroll', true, true),
('process_company_operations', 'Process Company Operations', 'Daily operating costs deduction for all companies', '0 1 * * *', 'process-company-operations', true, true),
('process_venue_bookings', 'Process Venue Bookings', 'Credit company-owned venues for completed gigs and bookings', '0 */6 * * *', 'process-venue-bookings', true, true),
('process_studio_bookings', 'Process Studio Bookings', 'Credit company-owned studios for completed sessions', '0 */6 * * *', 'process-studio-bookings', true, true),
('process_logistics_contracts', 'Process Logistics Contracts', 'Complete logistics contracts and credit companies', '0 2 * * *', 'process-logistics-contracts', true, true),
('check_company_bankruptcy', 'Check Company Bankruptcy', 'Check for companies with sustained negative balance', '0 3 * * *', 'check-company-bankruptcy', true, true),
('generate_company_reports', 'Generate Company Reports', 'Weekly financial reports and KPI generation', '0 4 * * 0', 'generate-company-reports', true, true)
ON CONFLICT (job_name) DO NOTHING;