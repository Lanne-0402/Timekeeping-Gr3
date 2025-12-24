# Installation Guide — Timekeeping

Hướng dẫn cài đặt và chạy hệ thống Timekeeping (Frontend + Backend + Firebase Firestore).

---

## 1. Yêu cầu hệ thống

Trước khi cài đặt, cần chuẩn bị:

### ✔ Node.js (khuyến nghị v18+)
https://nodejs.org/

---

## 2. Clone dự án

```bash
git clone https://github.com/Lanne-0401/Timekeeping-Gr3.git
cd Timekeeping-Gr3
```
## 3. Cài đặt Backend
```bash
cd backend
npm install
```
## 4. Tạo file môi trường .env
backend/.env  


Thêm nội dung:

SERVICE_ACCOUNT_KEY_PATH=./config/serviceAccountKey.json  
PORT=5000  
JWT_SECRET=your_access_token_secret_here  
JWT_REFRESH_SECRET=your_refresh_token_secret_here  
JWT_EXPIRES=1h  
JWT_REFRESH_EXPIRES=7d  
FACE_THRESHOLD=0.38  
SENDER_EMAIL=timekeepinggr3@gmail.com

---

## 5. Cấu hình Firebase (serviceAccountKey)

bạn cần file:
```bash
backend/config/serviceAccountKey.json
```
inbox Bảo Diệp để lấy nhoa :>

## 6. Chạy backend
```bash
cd backend
npm start hoặc npm run dev hoặc nodemon server.js
```
Backend chạy tại: http://localhost:5000

## 7. Chạy Frontend
Dùng Live Server (VSCode):
- Click chuột phải vào: frontend/auth.html   → Open with Live Server

## 8. Tài khoản mặc định
Admin (có sẵn)
email: admin@timekeeping.com  
password: admin123

 

Nhân viên mẫu (đăng nhập bất cứ tài khoản nào đều được, pass chung:12345678)

a@example.com → 12345678  
b@example.com → 12345678  
...  
g@example.com → 12345678  
(theo bảng chữ cái từ a -> g)

## 9. Link Website Timekeeping 
[Timekeeping Project – Web App Quản Lý Chấm Công Nhân Viên](https://lanne-0402.github.io/Timekeeping-Gr3/)
