-- 初期エリアと登録駅（施設データではない）。エリア追加はここに行を足すだけでよい。
-- 座標は概略値。公開前に国土地理院等の公的資料で確認すること。
insert into public.areas (id, name, prefecture, lat, lng) values
  ('shinagawa', '品川区', '東京都', 35.6092, 139.7302),
  ('minato', '港区', '東京都', 35.6581, 139.7516),
  ('shibuya', '渋谷区', '東京都', 35.6640, 139.6982)
on conflict (id) do update set name = excluded.name, lat = excluded.lat, lng = excluded.lng;

insert into public.stations (id, name, area_id, lat, lng) values
  ('st-shinagawa', '品川駅', 'minato', 35.6285, 139.7387),
  ('st-gotanda', '五反田駅', 'shinagawa', 35.6262, 139.7236),
  ('st-osaki', '大崎駅', 'shinagawa', 35.6197, 139.7286),
  ('st-oimachi', '大井町駅', 'shinagawa', 35.6064, 139.7346),
  ('st-musashikoyama', '武蔵小山駅', 'shinagawa', 35.6205, 139.7042),
  ('st-tamachi', '田町駅', 'minato', 35.6457, 139.7476),
  ('st-hamamatsucho', '浜松町駅', 'minato', 35.6555, 139.7570),
  ('st-roppongi', '六本木駅', 'minato', 35.6628, 139.7314),
  ('st-azabujuban', '麻布十番駅', 'minato', 35.6564, 139.7368),
  ('st-hiroo', '広尾駅', 'shibuya', 35.6518, 139.7222),
  ('st-shibuya', '渋谷駅', 'shibuya', 35.6580, 139.7016),
  ('st-ebisu', '恵比寿駅', 'shibuya', 35.6467, 139.7101),
  ('st-omotesando', '表参道駅', 'minato', 35.6652, 139.7123),
  ('st-yoyogiuehara', '代々木上原駅', 'shibuya', 35.6690, 139.6797)
on conflict (id) do update set name = excluded.name, area_id = excluded.area_id, lat = excluded.lat, lng = excluded.lng;
