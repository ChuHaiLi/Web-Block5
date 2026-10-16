const express = require("express");
const router = express.Router();
const prisma = require("../prisma");

// Helper parse and validate ID
function parseValidId(idParam) {
  const id = Number(idParam);
  if (isNaN(id) || !Number.isInteger(id) || id <= 0) return null;
  return id;
}

// 1. GET /admin/dishes - Danh sách quản trị món ăn (có tìm kiếm, lọc phân loại & trạng thái)
router.get("/", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const sort = typeof req.query.sort === "string" ? req.query.sort.trim() : "";

    // Xây dựng điều kiện WHERE linh hoạt, an toàn (Prisma ORM chống SQL Injection)
    const where = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (status === "available") {
      where.available = true;
    } else if (status === "unavailable") {
      where.available = false;
    }

    // Xây dựng orderBy
    let orderBy = { id: "asc" };
    if (sort === "price_asc") {
      orderBy = { price: "asc" };
    } else if (sort === "price_desc") {
      orderBy = { price: "desc" };
    } else if (sort === "newest") {
      orderBy = { createdAt: "desc" };
    } else if (sort === "name") {
      orderBy = { name: "asc" };
    }

    // Lấy danh sách món ăn theo bộ lọc, tổng số lượng và danh mục hiện có
    const [dishes, totalCount, allCategoriesRaw] = await Promise.all([
      prisma.dish.findMany({ where, orderBy }),
      prisma.dish.count(),
      prisma.dish.findMany({
        select: { category: true },
        distinct: ["category"],
        where: { category: { not: null } },
      }),
    ]);

    const categories = allCategoriesRaw
      .map((c) => c.category)
      .filter(Boolean)
      .sort();

    res.status(200).render("admin/dishes/index", {
      title: "Quản Trị Món Ăn",
      dishes,
      totalCount,
      categories,
      filters: { q, category, status, sort },
    });
  } catch (error) {
    next(error);
  }
});

// 2. GET /admin/dishes/new - Mở form thêm món mới
router.get("/new", (req, res) => {
  res.status(200).render("admin/dishes/new", {
    title: "Thêm Món Ăn Mới",
    dish: {},
    error: null,
  });
});

// 3. POST /admin/dishes - Thêm món ăn mới (Validation, mã 400 giữ giá trị, mã 303 thành công)
router.post("/", async (req, res, next) => {
  try {
    const { name, description, price, category, available, imageUrl } = req.body;

    // Validation
    const errors = [];
    if (!name || name.trim().length === 0) {
      errors.push("Tên món ăn không được để trống.");
    }
    const numPrice = Number(price);
    if (price === undefined || price === "" || isNaN(numPrice) || numPrice < 0) {
      errors.push("Giá món ăn phải là một số nguyên không âm (>= 0).");
    }

    if (errors.length > 0) {
      // Input sai trả 400, giữ giá trị đã nhập
      return res.status(400).render("admin/dishes/new", {
        title: "Thêm Món Ăn Mới",
        dish: req.body,
        error: errors.join(" "),
      });
    }

    // Chống Mass Assignment: trích xuất tường minh từng trường
    const newDish = await prisma.dish.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        price: Math.round(numPrice),
        category: category ? category.trim() : null,
        available: available === "on" || available === true || available === "true",
        imageUrl: imageUrl && imageUrl.trim() ? imageUrl.trim() : null,
      },
    });

    // Thao tác thành công redirect 303 sang chi tiết quản trị món ăn theo đúng mô hình PRG
    return res.redirect(303, `/admin/dishes/${newDish.id}`);
  } catch (error) {
    next(error);
  }
});

// 4. GET /admin/dishes/:id/edit - Mở form sửa món ăn (404 khi id sai hoặc không có)
router.get("/:id/edit", async (req, res, next) => {
  try {
    const id = parseValidId(req.params.id);
    if (!id) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Món Ăn",
        message: `ID món ăn "${req.params.id}" không hợp lệ.`,
      });
    }

    const dish = await prisma.dish.findUnique({
      where: { id },
    });

    if (!dish) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Món Ăn",
        message: `Không tìm thấy món ăn với ID ${id} để chỉnh sửa.`,
      });
    }

    res.status(200).render("admin/dishes/edit", {
      title: `Chỉnh Sửa: ${dish.name}`,
      dish,
      error: null,
    });
  } catch (error) {
    next(error);
  }
});

// 5. PATCH /admin/dishes/:id - Cập nhật món ăn qua Method Override (400 khi lỗi, 303 thành công)
router.patch("/:id", async (req, res, next) => {
  try {
    const id = parseValidId(req.params.id);
    if (!id) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Món Ăn",
        message: `ID món ăn "${req.params.id}" không hợp lệ.`,
      });
    }

    const existingDish = await prisma.dish.findUnique({ where: { id } });
    if (!existingDish) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Món Ăn",
        message: `Không tìm thấy món ăn với ID ${id} để cập nhật.`,
      });
    }

    const { name, description, price, category, available, imageUrl } = req.body;

    // Validation
    const errors = [];
    if (!name || name.trim().length === 0) {
      errors.push("Tên món ăn không được để trống.");
    }
    const numPrice = Number(price);
    if (price === undefined || price === "" || isNaN(numPrice) || numPrice < 0) {
      errors.push("Giá món ăn phải là một số nguyên không âm (>= 0).");
    }

    if (errors.length > 0) {
      // Input sai trả 400, giữ giá trị đã nhập
      return res.status(400).render("admin/dishes/edit", {
        title: `Chỉnh Sửa: ${name || existingDish.name}`,
        dish: { ...req.body, id },
        error: errors.join(" "),
      });
    }

    // Whitelist update data
    await prisma.dish.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        price: Math.round(numPrice),
        category: category ? category.trim() : null,
        available: available === "on" || available === true || available === "true",
        imageUrl: imageUrl && imageUrl.trim() ? imageUrl.trim() : null,
      },
    });

    // Cập nhật thành công redirect 303 sang chi tiết quản trị
    return res.redirect(303, `/admin/dishes/${id}`);
  } catch (error) {
    next(error);
  }
});

// 6. GET /admin/dishes/:id/delete - Trang xác nhận xóa (200 hoặc 404)
router.get("/:id/delete", async (req, res, next) => {
  try {
    const id = parseValidId(req.params.id);
    if (!id) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Món Ăn",
        message: `ID món ăn "${req.params.id}" không hợp lệ.`,
      });
    }

    const dish = await prisma.dish.findUnique({ where: { id } });
    if (!dish) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Món Ăn",
        message: `Không tìm thấy món ăn với ID ${id} để xác nhận xóa.`,
      });
    }

    res.status(200).render("admin/dishes/delete", {
      title: `Xác Nhận Xóa: ${dish.name}`,
      dish,
    });
  } catch (error) {
    next(error);
  }
});

// 7. DELETE /admin/dishes/:id - Xóa món ăn qua Method Override (303 sang danh sách hoặc 404)
router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseValidId(req.params.id);
    if (!id) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Món Ăn",
        message: `ID món ăn "${req.params.id}" không hợp lệ.`,
      });
    }

    const dish = await prisma.dish.findUnique({ where: { id } });
    if (!dish) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Món Ăn",
        message: `Không tìm thấy món ăn với ID ${id} để xóa.`,
      });
    }

    await prisma.dish.delete({ where: { id } });

    // Xóa thành công redirect 303 về danh sách
    return res.redirect(303, "/admin/dishes");
  } catch (error) {
    next(error);
  }
});

// 8. GET /admin/dishes/:id - Xem chi tiết món ăn trong khu vực Quản Trị (có nút Sửa và Xóa)
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseValidId(req.params.id);
    if (!id) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Món Ăn",
        message: `ID món ăn "${req.params.id}" không hợp lệ.`,
      });
    }

    const dish = await prisma.dish.findUnique({
      where: { id },
    });

    if (!dish) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Món Ăn",
        message: `Không tìm thấy món ăn với ID ${id} trong hệ thống.`,
      });
    }

    res.status(200).render("admin/dishes/show", {
      title: `Quản Trị Chi Tiết: ${dish.name} - RESTORAN`,
      dish,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
