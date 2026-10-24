DO $$
DECLARE j record; newcmd text;
BEGIN
  FOR j IN SELECT jobid, jobname, command FROM cron.job
           WHERE command ILIKE '%Bearer eyJ%' AND command NOT ILIKE '%x-cron-secret%' LOOP
    newcmd := regexp_replace(j.command,
      '(headers\s*:=\s*)(''[^'']*Bearer[^'']*''::jsonb)',
      '\1(\2 || jsonb_build_object(''x-cron-secret'',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name=''internal_cron_secret'' LIMIT 1)))');
    IF newcmd = j.command THEN
      newcmd := regexp_replace(j.command,
        '(headers\s*:=\s*jsonb_build_object\()',
        '\1''x-cron-secret'',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name=''internal_cron_secret'' LIMIT 1),');
    END IF;
    IF newcmd <> j.command THEN
      PERFORM cron.alter_job(j.jobid, command := newcmd);
    END IF;
  END LOOP;
END $$;