const express = require("express");
const router = express.Router();
const prisma = require("../prisma");

function parseValidId(idParam) {
  const id = Number(idParam);
  if (isNaN(id) || !Number.isInteger(id) || id <= 0) return null;
  return id;
}

// 1. GET /admin/ingredients - Danh sách quản trị nguyên liệu
// 1. GET /admin/ingredients - Danh sách quản trị nguyên liệu (có tìm kiếm q)
router.get("/", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { unit: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};

    const [ingredients, totalCount] = await Promise.all([
      prisma.ingredient.findMany({ where, orderBy: { id: "asc" } }),
      prisma.ingredient.count(),
    ]);

    res.status(200).render("admin/ingredients/index", {
      title: "Quản Trị Nguyên Liệu",
      ingredients,
      totalCount,
      q,
    });
  } catch (error) {
    next(error);
  }
});

// 2. GET /admin/ingredients/new - Mở form thêm nguyên liệu mới
router.get("/new", (req, res) => {
  res.status(200).render("admin/ingredients/new", {
    title: "Thêm Nguyên Liệu Mới",
    ingredient: {},
    error: null,
  });
});

// 3. POST /admin/ingredients - Thêm nguyên liệu mới
router.post("/", async (req, res, next) => {
  try {
    const { name, quantity, unit } = req.body;

    const errors = [];
    if (!name || name.trim().length === 0) {
      errors.push("Tên nguyên liệu không được để trống.");
    }
    const numQty = quantity !== undefined && quantity !== "" ? Number(quantity) : 0;
    if (isNaN(numQty) || numQty < 0) {
      errors.push("Số lượng nguyên liệu phải là một số không âm (>= 0).");
    }
    if (!unit || unit.trim().length === 0) {
      errors.push("Đơn vị tính không được để trống.");
    }

    if (errors.length > 0) {
      return res.status(400).render("admin/ingredients/new", {
        title: "Thêm Nguyên Liệu Mới",
        ingredient: req.body,
        error: errors.join(" "),
      });
    }

    await prisma.ingredient.create({
      data: {
        name: name.trim(),
        quantity: Math.round(numQty),
        unit: unit.trim(),
      },
    });

    return res.redirect(303, "/admin/ingredients");
  } catch (error) {
    next(error);
  }
});

// 4. GET /admin/ingredients/:id/edit - Mở form sửa nguyên liệu
router.get("/:id/edit", async (req, res, next) => {
  try {
    const id = parseValidId(req.params.id);
    if (!id) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Nguyên Liệu",
        message: `ID nguyên liệu "${req.params.id}" không hợp lệ.`,
      });
    }

    const ingredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Nguyên Liệu",
        message: `Không tìm thấy nguyên liệu với ID ${id}.`,
      });
    }

    res.status(200).render("admin/ingredients/edit", {
      title: `Chỉnh Sửa: ${ingredient.name}`,
      ingredient,
      error: null,
    });
  } catch (error) {
    next(error);
  }
});

// 5. PATCH /admin/ingredients/:id - Cập nhật nguyên liệu qua Method Override
router.patch("/:id", async (req, res, next) => {
  try {
    const id = parseValidId(req.params.id);
    if (!id) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Nguyên Liệu",
        message: `ID nguyên liệu "${req.params.id}" không hợp lệ.`,
      });
    }

    const existingIngredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!existingIngredient) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Nguyên Liệu",
        message: `Không tìm thấy nguyên liệu với ID ${id}.`,
      });
    }

    const { name, quantity, unit } = req.body;
    const errors = [];
    if (!name || name.trim().length === 0) {
      errors.push("Tên nguyên liệu không được để trống.");
    }
    const numQty = quantity !== undefined && quantity !== "" ? Number(quantity) : (existingIngredient.quantity || 0);
    if (isNaN(numQty) || numQty < 0) {
      errors.push("Số lượng nguyên liệu phải là một số không âm (>= 0).");
    }
    if (!unit || unit.trim().length === 0) {
      errors.push("Đơn vị tính không được để trống.");
    }

    if (errors.length > 0) {
      return res.status(400).render("admin/ingredients/edit", {
        title: `Chỉnh Sửa: ${name || existingIngredient.name}`,
        ingredient: { ...req.body, id },
        error: errors.join(" "),
      });
    }

    await prisma.ingredient.update({
      where: { id },
      data: {
        name: name.trim(),
        quantity: Math.round(numQty),
        unit: unit.trim(),
      },
    });

    return res.redirect(303, "/admin/ingredients");
  } catch (error) {
    next(error);
  }
});

// 6. GET /admin/ingredients/:id/delete - Trang xác nhận xóa nguyên liệu
router.get("/:id/delete", async (req, res, next) => {
  try {
    const id = parseValidId(req.params.id);
    if (!id) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Nguyên Liệu",
        message: `ID nguyên liệu "${req.params.id}" không hợp lệ.`,
      });
    }

    const ingredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Nguyên Liệu",
        message: `Không tìm thấy nguyên liệu với ID ${id} để xác nhận xóa.`,
      });
    }

    res.status(200).render("admin/ingredients/delete", {
      title: `Xác Nhận Xóa: ${ingredient.name}`,
      ingredient,
    });
  } catch (error) {
    next(error);
  }
});

// 7. DELETE /admin/ingredients/:id - Xóa nguyên liệu qua Method Override
router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseValidId(req.params.id);
    if (!id) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Nguyên Liệu",
        message: `ID nguyên liệu "${req.params.id}" không hợp lệ.`,
      });
    }

    const ingredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Nguyên Liệu",
        message: `Không tìm thấy nguyên liệu với ID ${id} để xóa.`,
      });
    }

    await prisma.ingredient.delete({ where: { id } });

    return res.redirect(303, "/admin/ingredients");
  } catch (error) {
    next(error);
  }
});

module.exports = router;
