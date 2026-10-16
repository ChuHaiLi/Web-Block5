const express = require("express");
const router = express.Router();
const prisma = require("../prisma");

// 1. GET /dishes - Danh sách món ăn cho khách hàng (có tìm kiếm qua query `q`)
router.get("/", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const dishes = await prisma.dish.findMany({
      where: q
        ? {
            name: {
              contains: q,
              mode: "insensitive", // Tìm kiếm không phân biệt chữ hoa / thường
            },
          }
        : {},
      orderBy: { id: "asc" },
    });

    res.status(200).render("dishes/index", {
      title: "Thực Đơn Nhà Hàng",
      dishes,
      q,
    });
  } catch (error) {
    next(error);
  }
});

// 2. GET /dishes/:id - Chi tiết một món ăn (404 khi id sai hoặc không tồn tại)
router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    // Kiểm tra id có phải là số nguyên dương hợp lệ không
    if (isNaN(id) || !Number.isInteger(id) || id <= 0) {
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
        title: "404 - Món Ăn Không Tồn Tại",
        message: `Không tìm thấy món ăn với ID ${id} trong thực đơn.`,
      });
    }

    res.status(200).render("dishes/show", {
      title: `${dish.name} - Chi Tiết Món Ăn`,
      dish,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
