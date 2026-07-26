\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE base jsonb:=jsonb_build_object('attendance',jsonb_build_array(jsonb_build_object('day',1,'count',42)),
 'performances',jsonb_build_array(jsonb_build_object('id','a','score',80),jsonb_build_object('id','b','score',90)));
 digest text; finalised jsonb;
BEGIN
 digest:=public.festival_json_content_digest(base,ARRAY['contentDigest']);
 finalised:=base||jsonb_build_object('contentDigest',digest);
 IF public.festival_json_content_digest(finalised,ARRAY['contentDigest'])<>digest THEN RAISE EXCEPTION 'unmodified snapshot rejected'; END IF;
 IF public.festival_json_content_digest(finalised||'{"attendance":[{"day":1,"count":43}]}'::jsonb,ARRAY['contentDigest'])=digest THEN RAISE EXCEPTION 'attendance tamper missed'; END IF;
 IF public.festival_json_content_digest(finalised||'{"performances":[{"id":"a","score":81},{"id":"b","score":90}]}'::jsonb,ARRAY['contentDigest'])=digest THEN RAISE EXCEPTION 'performance tamper missed'; END IF;
 -- contentDigest is excluded from the content hash, while the runtime guard separately requires it to equal the stored digest.
 IF public.festival_json_content_digest(finalised||jsonb_build_object('contentDigest',repeat('0',64)),ARRAY['contentDigest'])<>digest THEN RAISE EXCEPTION 'contentDigest was not excluded'; END IF;
 IF public.festival_json_content_digest(base||jsonb_build_object('performances',jsonb_build_array(jsonb_build_object('id','b','score',90),jsonb_build_object('id','a','score',80))),ARRAY['contentDigest'])=digest THEN RAISE EXCEPTION 'ordered array reorder missed'; END IF;
 IF public.festival_json_content_digest((base::text)::jsonb,ARRAY['contentDigest'])<>digest THEN RAISE EXCEPTION 'jsonb reserialisation unstable'; END IF;
 -- Contract packages use the same one-way rule: the stored digest hashes the
 -- package without its embedded digest, and both representations must agree.
 digest:=public.festival_contract_package_digest(base);
 finalised:=base||jsonb_build_object('contentDigest',digest);
 IF public.festival_contract_package_digest(finalised)<>digest OR finalised->>'contentDigest'<>digest
 THEN RAISE EXCEPTION 'contract package digest semantics invalid'; END IF;
 IF public.festival_contract_package_digest(finalised||'{"attendance":43}'::jsonb)=digest
 THEN RAISE EXCEPTION 'contract package tamper missed'; END IF;
END $$;
ROLLBACK;
