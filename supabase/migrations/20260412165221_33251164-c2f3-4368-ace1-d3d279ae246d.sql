
-- Delete duplicate Souldrip bands (keep 476a7872 which has 1 member)
DELETE FROM bands WHERE name = 'Souldrip' AND id != '476a7872-9ba1-4b64-812f-599a94dc1e94';

-- Delete duplicate Dakine bands (keep the oldest f1a9d83b)
DELETE FROM bands WHERE name = 'Dakine' AND id != 'f1a9d83b-7e3d-4946-a047-d8d32ffb971a';

-- Delete duplicate Shade bands (keep the oldest 253d65ff)
DELETE FROM bands WHERE name = 'Shade' AND id != '253d65ff-28e8-4aef-94bf-19d9496e56bb';
