const express = require("express");
const path = require("path");
const methodOverride = require("method-override");

const dishesRouter = require("./routes/dishes");
const adminDishesRouter = require("./routes/adminDishes");
const adminChefsRouter = require("./routes/adminChefs");
const adminIngredientsRouter = require("./routes/adminIngredients");

const app = express();

// 1. Cấu hình EJS View Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// 2. Middlewares cốt lõi
// Parse payload form-data (application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));

// Ghi đè HTTP method từ query string ?_method=PATCH|DELETE
app.use(methodOverride("_method", { methods: ["POST"] }));

// Phục vụ các file tĩnh (CSS, hình ảnh, favicon)
app.use(express.static(path.join(__dirname, "../public")));

// 3. Middleware nhận diện chế độ Khách hàng (User) hay Quản trị (Admin)
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.isAdmin = req.path.startsWith("/admin");
  next();
});

// 4. Đăng ký Routes
// Trang chủ tự động chuyển về /dishes
app.get("/", (req, res) => {
  res.redirect(303, "/dishes");
});

// Truy cập /admin tự động chuyển về /admin/dishes
app.get("/admin", (req, res) => {
  res.redirect(303, "/admin/dishes");
});

// Route người dùng
app.use("/dishes", dishesRouter);

// Route quản trị CRUD
app.use("/admin/dishes", adminDishesRouter);
app.use("/admin/chefs", adminChefsRouter);
app.use("/admin/ingredients", adminIngredientsRouter);

// 4. Middleware xử lý 404 khi truy cập route không tồn tại
app.use((req, res) => {
  res.status(404).render("404", {
    title: "404 - Không Tìm Thấy Trang",
    message: `Đường dẫn "${req.originalUrl}" không tồn tại trên máy chủ.`,
  });
});

// 5. Middleware xử lý lỗi tập trung 500
app.use((err, req, res, next) => {
  // Do not log Prisma messages, request bodies or connection strings.
  console.error("Lỗi Server:", {
    type: err && err.name,
    code: err && typeof err.code === "string" && /^P\d{4}$/.test(err.code) ? err.code : undefined,
    method: req.method,
    route: req.route ? req.route.path : "unknown",
  });
  if (res.headersSent) return next(err);
  res.status(500).render("404", {
    statusCode: 500,
    title: "500 - Lỗi Máy Chủ Nội Bộ",
    message: "Đã xảy ra sự cố trong quá trình xử lý yêu cầu. Vui lòng thử lại sau.",
  });
});

module.exports = app;
