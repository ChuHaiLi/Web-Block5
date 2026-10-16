# Restaurant SSR

Node.js + Express + EJS, Prisma 5 và PostgreSQL (Supabase). CRUD dùng form HTML và redirect 303 theo PRG, không dùng fetch/AJAX.

## Chạy project

Yêu cầu Node.js 18+ và PostgreSQL/Supabase có thể kết nối từ máy chạy server.

```powershell
npm.cmd ci
Copy-Item .env.example .env # Chỉ khi chưa có .env; không ghi đè cấu hình nhóm
```

Điền `DATABASE_URL` và `PORT` trong `.env`. Với Supabase, dùng connection string phù hợp với mạng của máy (ví dụ Session Pooler port 5432); mã hóa các ký tự đặc biệt trong mật khẩu theo URL. Giữ `.env` ở máy cá nhân, không commit hoặc gửi vào chat. Chuỗi kết nối chỉ được server/Prisma sử dụng.

```powershell
npx.cmd prisma generate
npm.cmd start
# Hoặc: npm.cmd run dev
```

Các URL chính tại `http://localhost:3000`: `/dishes`, `/dishes?q=phở`, `/dishes/:id`, `/admin/dishes`, `/admin/chefs`, `/admin/ingredients`. Chi tiết quản trị món: `/admin/dishes/:id`.

## Setup database mới (khác với chạy server)

Chỉ khi database chưa có schema hoặc cần đồng bộ schema hiện tại:

```powershell
npm.cmd run db:push
```

Kiểm tra database đích trước khi đồng bộ và đọc cảnh báo Prisma. Không thêm `--accept-data-loss` hoặc chạy reset với dữ liệu cần giữ. Bản sửa này không thay đổi `prisma/schema.prisma`, nên database đã đúng schema không cần push hay migration mới. Nếu client cục bộ đã cũ, chạy lại `prisma generate`.

**Lệnh sau xóa dữ liệu cũ của cả ba bảng rồi nạp dữ liệu mẫu. Chỉ dùng database/schema dành cho dữ liệu có thể bỏ:**

```powershell
npm.cmd run seed
```

Seed tự load `.env`, tạo 3 đầu bếp, 8 nguyên liệu và 7 món ăn kèm quan hệ. Không cần seed lại để áp dụng các sửa lỗi route/validation/template.

## Kiểm tra

```powershell
npm.cmd test
npx.cmd prisma validate
```

`npm test` chạy validation và HTTP/HTML với Prisma thay thế để kiểm tra độc lập mạng, không xác minh dữ liệu PostgreSQL thật.

Kiểm thử tích hợp dùng account PostgreSQL được phép tạo/xóa schema. Đặt `TEST_DATABASE_URL` trong terminal cục bộ, rồi:

```powershell
npx.cmd prisma generate
npm.cmd run test:db
Remove-Item Env:TEST_DATABASE_URL
```

Không có `TEST_DATABASE_URL` thì test tích hợp được đánh dấu bỏ qua. Mỗi lần chạy tự tạo tên schema `audit_test_<random>`, thay tham số `schema` trong URL, push schema, chạy seed và test CRUD qua HTTP với Prisma thật, rồi drop đúng schema tạm trong `finally`. Không seed/reset schema ứng dụng. Nếu tiến trình bị tắt cưỡng bức, có thể cần dọn schema `audit_test_...` còn sót sau khi xác nhận đúng tên trong Supabase.

Nghiệm thu thủ công trên Supabase của nhóm: mở danh sách/tìm kiếm/chi tiết; tạo bản ghi thử cho ba khu vực, sửa, mở xác nhận rồi xóa; xem Network có POST → 303 → GET. Reload trang đích không ghi lại. Thử gửi form lỗi và kiểm tra nội dung/checkbox được giữ; thử ID `2147483648` phải 404. Tắt JavaScript trong browser và thử lại các form; không dùng seed/reset khi nghiệm thu trên dữ liệu cần giữ.
