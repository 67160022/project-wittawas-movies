-- ข้อมูลตัวอย่างเพิ่มเติม (รันซ้ำได้ — ข้ามรายการที่มีอยู่แล้ว)
USE movies_api;

INSERT INTO directors (name, nationality)
SELECT * FROM (
  SELECT 'Denis Villeneuve' AS name, 'Canadian' AS nationality UNION ALL
  SELECT 'Greta Gerwig', 'American' UNION ALL
  SELECT 'Quentin Tarantino', 'American' UNION ALL
  SELECT 'Makoto Shinkai', 'Japanese' UNION ALL
  SELECT 'Apichatpong Weerasethakul', 'Thai' UNION ALL
  SELECT 'Nattawut Poonpiriya', 'Thai'
) AS new_directors
WHERE NOT EXISTS (SELECT 1 FROM directors d WHERE d.name = new_directors.name);

-- movie_code = 4 ตัวอักษรแรกของชื่อ (ตัดช่องว่าง, ตัวพิมพ์ใหญ่) + ปี ตามกติกาเดียวกับ API
INSERT IGNORE INTO movies (title, director_id, release_year, movie_code)
SELECT m.title, d.director_id, m.release_year, m.movie_code
FROM (
  SELECT 'Interstellar' AS title, 'Christopher Nolan' AS director, 2014 AS release_year, 'INTE2014' AS movie_code UNION ALL
  SELECT 'Oppenheimer', 'Christopher Nolan', 2023, 'OPPE2023' UNION ALL
  SELECT 'Memories of Murder', 'Bong Joon-ho', 2003, 'MEMO2003' UNION ALL
  SELECT 'My Neighbor Totoro', 'Hayao Miyazaki', 1988, 'MYNE1988' UNION ALL
  SELECT 'Princess Mononoke', 'Hayao Miyazaki', 1997, 'PRIN1997' UNION ALL
  SELECT 'Dune', 'Denis Villeneuve', 2021, 'DUNE2021' UNION ALL
  SELECT 'Arrival', 'Denis Villeneuve', 2016, 'ARRI2016' UNION ALL
  SELECT 'Lady Bird', 'Greta Gerwig', 2017, 'LADY2017' UNION ALL
  SELECT 'Barbie', 'Greta Gerwig', 2023, 'BARB2023' UNION ALL
  SELECT 'Pulp Fiction', 'Quentin Tarantino', 1994, 'PULP1994' UNION ALL
  SELECT 'Your Name', 'Makoto Shinkai', 2016, 'YOUR2016' UNION ALL
  SELECT 'Uncle Boonmee Who Can Recall His Past Lives', 'Apichatpong Weerasethakul', 2010, 'UNCL2010' UNION ALL
  SELECT 'Bad Genius', 'Nattawut Poonpiriya', 2017, 'BADG2017'
) AS m
JOIN directors d ON d.name = m.director;

-- เพิ่มรีวิวเฉพาะหนังที่ยังไม่มีรีวิว
INSERT INTO reviews (movie_id, rating, comment)
SELECT mv.movie_id, r.rating, r.comment
FROM (
  SELECT 'Interstellar' AS title, 5 AS rating, 'ฉากหลุมดำสวยมาก ดูจบแล้วอยากโทรหาพ่อ' AS comment UNION ALL
  SELECT 'Interstellar', 4, 'วิทยาศาสตร์แน่น แต่บางช่วงยาวไปหน่อย' UNION ALL
  SELECT 'Oppenheimer', 5, 'สามชั่วโมงที่ไม่รู้สึกยาวเลย' UNION ALL
  SELECT 'Memories of Murder', 5, 'ตอนจบหลอนมาก' UNION ALL
  SELECT 'My Neighbor Totoro', 5, 'อบอุ่นหัวใจ ดูได้ทั้งครอบครัว' UNION ALL
  SELECT 'Princess Mononoke', 4, 'ประเด็นธรรมชาติกับมนุษย์ลึกซึ้งมาก' UNION ALL
  SELECT 'Dune', 4, 'ภาพและเสียงอลังการ ต้องดูในโรง' UNION ALL
  SELECT 'Dune', 3, 'สวยแต่จังหวะช้า' UNION ALL
  SELECT 'Arrival', 5, 'หนังเอเลี่ยนที่ทำให้ร้องไห้' UNION ALL
  SELECT 'Lady Bird', 4, 'ความสัมพันธ์แม่ลูกสมจริงมาก' UNION ALL
  SELECT 'Barbie', 4, 'สนุก สีสันจัดจ้าน แฝงประเด็นดี' UNION ALL
  SELECT 'Pulp Fiction', 5, 'บทพูดเท่ทุกฉาก' UNION ALL
  SELECT 'Your Name', 5, 'เพลงเพราะ ภาพสวย ซึ้งมาก' UNION ALL
  SELECT 'Bad Genius', 5, 'ลุ้นจนเหงื่อแตก หนังไทยที่ภูมิใจ' UNION ALL
  SELECT 'Bad Genius', 4, 'ฉากสอบที่ซิดนีย์ตื่นเต้นสุด ๆ'
) AS r
JOIN movies mv ON mv.title = r.title
WHERE NOT EXISTS (SELECT 1 FROM reviews x WHERE x.movie_id = mv.movie_id);
