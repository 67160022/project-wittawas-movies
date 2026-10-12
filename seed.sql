USE movies_api;
 
INSERT INTO directors (name, nationality) VALUES
('Christopher Nolan', 'British-American'),
('Bong Joon-ho', 'South Korean'),
('Hayao Miyazaki', 'Japanese');
 
INSERT INTO movies (title, director_id, release_year, movie_code) VALUES
('Inception', 1, 2010, 'INCP2010'),
('The Dark Knight', 1, 2008, 'TDK2008'),
('Parasite', 2, 2019, 'PARA2019'),
('Spirited Away', 3, 2001, 'SPIR2001');
 
INSERT INTO reviews (movie_id, rating, comment) VALUES
(1, 5, 'พล็อตซับซ้อนแต่สนุกมาก ดูกี่รอบก็ยังคิดตาม'),
(1, 4, 'งานภาพและเพลงประกอบยอดเยี่ยม'),
(2, 5, 'ตัวร้ายที่ดีที่สุดในหนังซูเปอร์ฮีโร่'),
(3, 5, 'สมกับที่ได้ออสการ์ บทดีมาก'),
(4, 4, 'ภาพสวย จินตนาการล้ำ เหมาะกับทุกวัย');