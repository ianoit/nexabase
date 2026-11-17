export const SAMPLE_ECOMMERCE_SQL = `
-- Nexabase Studio Sample E-Commerce Database
-- Designed with realistic relationships, primary keys, and foreign keys

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'folder'
);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(30),
  city VARCHAR(50),
  country VARCHAR(50) DEFAULT 'Indonesia',
  loyalty_points INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  sku VARCHAR(30) UNIQUE NOT NULL,
  title VARCHAR(150) NOT NULL,
  price REAL NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  rating REAL DEFAULT 4.5,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  order_number VARCHAR(30) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'Processing',
  total_amount REAL NOT NULL,
  payment_method VARCHAR(30) DEFAULT 'Credit Card',
  shipping_address TEXT,
  order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  subtotal REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
);

CREATE TABLE reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  title VARCHAR(100),
  comment TEXT,
  review_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
);

CREATE TABLE inventory_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  change_type VARCHAR(20) NOT NULL,
  quantity_change INTEGER NOT NULL,
  notes TEXT,
  logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
);

-- Seed Categories
INSERT INTO categories (id, name, slug, description, icon) VALUES
(1, 'Electronics', 'electronics', 'Gadgets, laptops, smartphones, and accessories', 'laptop'),
(2, 'Audio & Sound', 'audio-sound', 'Headphones, earbuds, speakers, and audio interfaces', 'headphones'),
(3, 'Office & Workstation', 'office-workstation', 'Ergonomic desks, chairs, monitors, and lighting', 'monitor'),
(4, 'Gaming & VR', 'gaming-vr', 'Gaming mice, mechanical keyboards, consoles, and headsets', 'gamepad');

-- Seed Customers
INSERT INTO customers (id, first_name, last_name, email, phone, city, country, loyalty_points, created_at) VALUES
(1, 'Arya', 'Pratama', 'arya.pratama@example.com', '+62 812-3456-7890', 'Jakarta', 'Indonesia', 450, '2026-01-10 10:20:00'),
(2, 'Sarah', 'Kusuma', 'sarah.k@example.com', '+62 813-8821-4432', 'Bandung', 'Indonesia', 120, '2026-02-15 14:35:00'),
(3, 'Budi', 'Santoso', 'budi.santoso@example.com', '+62 815-9901-2334', 'Surabaya', 'Indonesia', 890, '2026-01-22 09:12:00'),
(4, 'Devi', 'Anggraini', 'devi.a@example.com', '+62 818-4432-8871', 'Yogyakarta', 'Indonesia', 340, '2026-03-01 16:40:00'),
(5, 'Reza', 'Rahardian', 'reza.rahardian@example.com', '+62 821-6543-2109', 'Medan', 'Indonesia', 1500, '2026-02-05 11:25:00'),
(6, 'Linda', 'Wijaya', 'linda.wijaya@example.com', '+62 856-7789-0123', 'Semarang', 'Indonesia', 620, '2026-03-12 18:05:00'),
(7, 'Faisal', 'Basri', 'faisal.b@example.com', '+62 878-1122-3344', 'Denpasar', 'Indonesia', 210, '2026-03-19 13:50:00');

-- Seed Products
INSERT INTO products (id, category_id, sku, title, price, stock_quantity, rating, is_active, created_at) VALUES
(1, 1, 'ELC-MBP-16', 'MacBook Pro 16-inch M3 Max (36GB RAM / 1TB SSD)', 3899.00, 15, 4.9, 1, '2026-01-12 08:00:00'),
(2, 1, 'ELC-DELL-32', 'Dell UltraSharp 32 4K Thunderbolt Hub Monitor', 949.50, 24, 4.8, 1, '2026-01-15 09:30:00'),
(3, 2, 'AUD-SONY-XM5', 'Sony WH-1000XM5 Wireless Noise Canceling Headphones', 398.00, 42, 4.7, 1, '2026-01-20 10:15:00'),
(4, 2, 'AUD-AIRPOD-MAX', 'Apple AirPods Max Space Gray with Smart Case', 549.00, 18, 4.6, 1, '2026-01-25 11:45:00'),
(5, 3, 'OFC-HERMAN-AER', 'Herman Miller Aeron Ergonomic Office Chair', 1395.00, 12, 4.9, 1, '2026-02-01 12:00:00'),
(6, 3, 'OFC-DESK-STAND', 'Autonomous SmartDesk Pro Dual-Motor Standing Desk', 699.00, 30, 4.7, 1, '2026-02-04 14:20:00'),
(7, 4, 'GAM-KEY-KBD75', 'Keychron Q1 Pro Custom Mechanical Keyboard (Red Switch)', 199.00, 55, 4.8, 1, '2026-02-10 15:10:00'),
(8, 4, 'GAM-MOUSE-GPX', 'Logitech G Pro X Superlight 2 Wireless Gaming Mouse', 159.00, 60, 4.9, 1, '2026-02-14 16:30:00'),
(9, 4, 'GAM-VR-QUEST3', 'Meta Quest 3 512GB Breakthrough Mixed Reality Headset', 649.00, 20, 4.7, 1, '2026-02-18 17:00:00'),
(10, 1, 'ELC-IPHONE-16', 'iPhone 16 Pro Max 256GB Natural Titanium', 1199.00, 28, 4.8, 1, '2026-02-22 18:20:00');

-- Seed Orders
INSERT INTO orders (id, customer_id, order_number, status, total_amount, payment_method, shipping_address, order_date) VALUES
(1, 1, 'ORD-2026-001', 'Delivered', 4848.50, 'Bank Transfer', 'Jl. Sudirman No. 45, Jakarta Selatan', '2026-02-10 11:30:00'),
(2, 2, 'ORD-2026-002', 'Delivered', 398.00, 'Credit Card', 'Jl. Dago No. 120, Bandung', '2026-02-18 15:45:00'),
(3, 3, 'ORD-2026-003', 'Shipped', 1594.00, 'QRIS', 'Jl. Pemuda No. 18, Surabaya', '2026-03-02 09:15:00'),
(4, 5, 'ORD-2026-004', 'Delivered', 2094.00, 'Credit Card', 'Jl. Gajah Mada No. 88, Medan', '2026-03-08 14:10:00'),
(5, 4, 'ORD-2026-005', 'Processing', 199.00, 'E-Wallet', 'Jl. Malioboro No. 32, Yogyakarta', '2026-03-15 16:20:00'),
(6, 6, 'ORD-2026-006', 'Processing', 848.00, 'Bank Transfer', 'Jl. Pahlawan No. 7, Semarang', '2026-03-18 10:05:00'),
(7, 7, 'ORD-2026-007', 'Pending', 649.00, 'Credit Card', 'Jl. Sunset Road No. 99, Denpasar', '2026-03-20 17:35:00');

-- Seed Order Items
INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, subtotal) VALUES
(1, 1, 1, 1, 3899.00, 3899.00),
(2, 1, 2, 1, 949.50, 949.50),
(3, 2, 3, 1, 398.00, 398.00),
(4, 3, 5, 1, 1395.00, 1395.00),
(5, 3, 7, 1, 199.00, 199.00),
(6, 4, 5, 1, 1395.00, 1395.00),
(7, 4, 6, 1, 699.00, 699.00),
(8, 5, 7, 1, 199.00, 199.00),
(9, 6, 8, 1, 159.00, 159.00),
(10, 6, 6, 1, 699.00, 699.00),
(11, 7, 9, 1, 649.00, 649.00);

-- Seed Reviews
INSERT INTO reviews (id, product_id, customer_id, rating, title, comment, review_date) VALUES
(1, 1, 1, 5, 'Best workstation laptop!', 'Fast compiling, incredible battery life, and screen quality is unmatched.', '2026-02-15 12:00:00'),
(2, 3, 2, 5, 'Superior ANC for office', 'Noise canceling completely eliminates background coffee shop noise.', '2026-02-22 16:30:00'),
(3, 5, 3, 5, 'Life-changing ergonomic chair', 'My back pain is completely gone after switching to this chair.', '2026-03-05 10:00:00'),
(4, 7, 4, 4, 'Amazing thock sound', 'Gasket mount feels great, wireless bluetooth connects fast.', '2026-03-18 19:20:00');

-- Seed Inventory Logs
INSERT INTO inventory_logs (id, product_id, change_type, quantity_change, notes, logged_at) VALUES
(1, 1, 'Initial Stock', 20, 'Initial shipment arrival from official distributor', '2026-01-12 08:30:00'),
(2, 1, 'Sale', -1, 'Order ORD-2026-001 fulfilled', '2026-02-10 11:35:00'),
(3, 5, 'Initial Stock', 15, 'Warehouse restock batch #882', '2026-02-01 12:30:00'),
(4, 5, 'Sale', -2, 'Orders ORD-2026-003 and ORD-2026-004 fulfilled', '2026-03-02 09:20:00');
`;
