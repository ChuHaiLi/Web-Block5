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

    // Lấy danh sách món ăn kèm đầu bếp và nguyên liệu
    const [dishes, totalCount, allCategoriesRaw] = await Promise.all([
      prisma.dish.findMany({
        where,
        orderBy,
        include: { chef: true, ingredients: true },
      }),
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

// 2. GET /admin/dishes/new - Mở form thêm món mới (kèm danh sách đầu bếp & nguyên liệu)
router.get("/new", async (req, res, next) => {
  try {
    const [chefs, ingredients] = await Promise.all([
      prisma.chef.findMany({ orderBy: { name: "asc" } }),
      prisma.ingredient.findMany({ orderBy: { name: "asc" } }),
    ]);

    res.status(200).render("admin/dishes/new", {
      title: "Thêm Món Ăn Mới",
      dish: { ingredients: [] },
      chefs,
      ingredients,
      error: null,
    });
  } catch (error) {
    next(error);
  }
});

// 3. POST /admin/dishes - Thêm món ăn mới (bắt buộc chọn đầu bếp & nguyên liệu)
router.post("/", async (req, res, next) => {
  try {
    const { name, description, price, category, available, imageUrl, chefId, ingredientIds } = req.body;

    const [chefs, ingredients] = await Promise.all([
      prisma.chef.findMany({ orderBy: { name: "asc" } }),
      prisma.ingredient.findMany({ orderBy: { name: "asc" } }),
    ]);

    // Validation
    const errors = [];
    if (!name || name.trim().length === 0) {
      errors.push("Tên món ăn không được để trống.");
    }
    const numPrice = Number(price);
    if (price === undefined || price === "" || isNaN(numPrice) || numPrice < 0) {
      errors.push("Giá món ăn phải là một số nguyên không âm (>= 0).");
    }

    const numChefId = chefId ? Number(chefId) : null;
    if (!numChefId || isNaN(numChefId)) {
      errors.push("Vui lòng chọn đầu bếp phụ trách món ăn.");
    }

    const selectedIngIds = Array.isArray(ingredientIds)
      ? ingredientIds.map(Number).filter(n => !isNaN(n) && n > 0)
      : (ingredientIds && !isNaN(Number(ingredientIds)) ? [Number(ingredientIds)] : []);

    if (selectedIngIds.length === 0) {
      errors.push("Vui lòng chọn ít nhất một nguyên liệu cho món ăn.");
    }

    if (errors.length > 0) {
      return res.status(400).render("admin/dishes/new", {
        title: "Thêm Món Ăn Mới",
        dish: {
          ...req.body,
          ingredients: selectedIngIds.map(id => ({ id }))
        },
        chefs,
        ingredients,
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
        chefId: numChefId,
        ingredients: {
          connect: selectedIngIds.map((id) => ({ id })),
        },
      },
    });

    // Thao tác thành công redirect 303 sang chi tiết quản trị món ăn
    return res.redirect(303, `/admin/dishes/${newDish.id}`);
  } catch (error) {
    next(error);
  }
});

// 4. GET /admin/dishes/:id/edit - Mở form sửa món ăn
router.get("/:id/edit", async (req, res, next) => {
  try {
    const id = parseValidId(req.params.id);
    if (!id) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Món Ăn",
        message: `ID món ăn "${req.params.id}" không hợp lệ.`,
      });
    }

    const [dish, chefs, ingredients] = await Promise.all([
      prisma.dish.findUnique({
        where: { id },
        include: { chef: true, ingredients: true },
      }),
      prisma.chef.findMany({ orderBy: { name: "asc" } }),
      prisma.ingredient.findMany({ orderBy: { name: "asc" } }),
    ]);

    if (!dish) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Món Ăn",
        message: `Không tìm thấy món ăn với ID ${id} để chỉnh sửa.`,
      });
    }

    res.status(200).render("admin/dishes/edit", {
      title: `Chỉnh Sửa: ${dish.name}`,
      dish,
      chefs,
      ingredients,
      error: null,
    });
  } catch (error) {
    next(error);
  }
});

// 5. PATCH /admin/dishes/:id - Cập nhật món ăn
router.patch("/:id", async (req, res, next) => {
  try {
    const id = parseValidId(req.params.id);
    if (!id) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Món Ăn",
        message: `ID món ăn "${req.params.id}" không hợp lệ.`,
      });
    }

    const existingDish = await prisma.dish.findUnique({
      where: { id },
      include: { ingredients: true },
    });

    if (!existingDish) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Món Ăn",
        message: `Không tìm thấy món ăn với ID ${id} để cập nhật.`,
      });
    }

    const { name, description, price, category, available, imageUrl, chefId, ingredientIds } = req.body;

    const [chefs, ingredients] = await Promise.all([
      prisma.chef.findMany({ orderBy: { name: "asc" } }),
      prisma.ingredient.findMany({ orderBy: { name: "asc" } }),
    ]);

    // Validation
    const errors = [];
    if (!name || name.trim().length === 0) {
      errors.push("Tên món ăn không được để trống.");
    }
    const numPrice = Number(price);
    if (price === undefined || price === "" || isNaN(numPrice) || numPrice < 0) {
      errors.push("Giá món ăn phải là một số nguyên không âm (>= 0).");
    }

    const numChefId = chefId ? Number(chefId) : null;
    if (!numChefId || isNaN(numChefId)) {
      errors.push("Vui lòng chọn đầu bếp phụ trách món ăn.");
    }

    const selectedIngIds = Array.isArray(ingredientIds)
      ? ingredientIds.map(Number).filter(n => !isNaN(n) && n > 0)
      : (ingredientIds && !isNaN(Number(ingredientIds)) ? [Number(ingredientIds)] : []);

    if (selectedIngIds.length === 0) {
      errors.push("Vui lòng chọn ít nhất một nguyên liệu cho món ăn.");
    }

    if (errors.length > 0) {
      return res.status(400).render("admin/dishes/edit", {
        title: `Chỉnh Sửa: ${name || existingDish.name}`,
        dish: {
          ...req.body,
          id,
          ingredients: selectedIngIds.map(id => ({ id })),
        },
        chefs,
        ingredients,
        error: errors.join(" "),
      });
    }

    // Cập nhật món ăn và quan hệ
    await prisma.dish.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        price: Math.round(numPrice),
        category: category ? category.trim() : null,
        available: available === "on" || available === true || available === "true",
        imageUrl: imageUrl && imageUrl.trim() ? imageUrl.trim() : null,
        chefId: numChefId,
        ingredients: {
          set: selectedIngIds.map((id) => ({ id })),
        },
      },
    });

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

    const dish = await prisma.dish.findUnique({
      where: { id },
      include: { chef: true, ingredients: true },
    });

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

// 7. DELETE /admin/dishes/:id - Xóa món ăn
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

    return res.redirect(303, "/admin/dishes");
  } catch (error) {
    next(error);
  }
});

// 8. GET /admin/dishes/:id - Xem chi tiết món ăn trong khu vực Quản Trị
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
      include: { chef: true, ingredients: true },
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
