const express = require("express");
const router = express.Router();
const prisma = require("../prisma");

function parseValidId(idParam) {
  const id = Number(idParam);
  if (isNaN(id) || !Number.isInteger(id) || id <= 0) return null;
  return id;
}

// 1. GET /admin/chefs - Danh sách quản trị đầu bếp
// 1. GET /admin/chefs - Danh sách quản trị đầu bếp (có tìm kiếm q)
router.get("/", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { specialty: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};

    const [chefs, totalCount] = await Promise.all([
      prisma.chef.findMany({ where, orderBy: { id: "asc" } }),
      prisma.chef.count(),
    ]);

    res.status(200).render("admin/chefs/index", {
      title: "Quản Trị Đầu Bếp",
      chefs,
      totalCount,
      q,
    });
  } catch (error) {
    next(error);
  }
});

// 2. GET /admin/chefs/new - Mở form thêm đầu bếp mới
router.get("/new", (req, res) => {
  res.status(200).render("admin/chefs/new", {
    title: "Thêm Đầu Bếp Mới",
    chef: {},
    error: null,
  });
});

// 3. POST /admin/chefs - Thêm đầu bếp mới
router.post("/", async (req, res, next) => {
  try {
    const { name, specialty } = req.body;

    const errors = [];
    if (!name || name.trim().length === 0) {
      errors.push("Tên đầu bếp không được để trống.");
    }
    if (!specialty || specialty.trim().length === 0) {
      errors.push("Sở trường / chuyên môn không được để trống.");
    }

    if (errors.length > 0) {
      return res.status(400).render("admin/chefs/new", {
        title: "Thêm Đầu Bếp Mới",
        chef: req.body,
        error: errors.join(" "),
      });
    }

    await prisma.chef.create({
      data: {
        name: name.trim(),
        specialty: specialty.trim(),
      },
    });

    return res.redirect(303, "/admin/chefs");
  } catch (error) {
    next(error);
  }
});

// 4. GET /admin/chefs/:id/edit - Mở form sửa đầu bếp
router.get("/:id/edit", async (req, res, next) => {
  try {
    const id = parseValidId(req.params.id);
    if (!id) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Đầu Bếp",
        message: `ID đầu bếp "${req.params.id}" không hợp lệ.`,
      });
    }

    const chef = await prisma.chef.findUnique({ where: { id } });
    if (!chef) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Đầu Bếp",
        message: `Không tìm thấy đầu bếp với ID ${id}.`,
      });
    }

    res.status(200).render("admin/chefs/edit", {
      title: `Chỉnh Sửa: ${chef.name}`,
      chef,
      error: null,
    });
  } catch (error) {
    next(error);
  }
});

// 5. PATCH /admin/chefs/:id - Cập nhật đầu bếp qua Method Override
router.patch("/:id", async (req, res, next) => {
  try {
    const id = parseValidId(req.params.id);
    if (!id) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Đầu Bếp",
        message: `ID đầu bếp "${req.params.id}" không hợp lệ.`,
      });
    }

    const existingChef = await prisma.chef.findUnique({ where: { id } });
    if (!existingChef) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Đầu Bếp",
        message: `Không tìm thấy đầu bếp với ID ${id}.`,
      });
    }

    const { name, specialty } = req.body;
    const errors = [];
    if (!name || name.trim().length === 0) {
      errors.push("Tên đầu bếp không được để trống.");
    }
    if (!specialty || specialty.trim().length === 0) {
      errors.push("Sở trường / chuyên môn không được để trống.");
    }

    if (errors.length > 0) {
      return res.status(400).render("admin/chefs/edit", {
        title: `Chỉnh Sửa: ${name || existingChef.name}`,
        chef: { ...req.body, id },
        error: errors.join(" "),
      });
    }

    await prisma.chef.update({
      where: { id },
      data: {
        name: name.trim(),
        specialty: specialty.trim(),
      },
    });

    return res.redirect(303, "/admin/chefs");
  } catch (error) {
    next(error);
  }
});

// 6. GET /admin/chefs/:id/delete - Trang xác nhận xóa đầu bếp
router.get("/:id/delete", async (req, res, next) => {
  try {
    const id = parseValidId(req.params.id);
    if (!id) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Đầu Bếp",
        message: `ID đầu bếp "${req.params.id}" không hợp lệ.`,
      });
    }

    const chef = await prisma.chef.findUnique({ where: { id } });
    if (!chef) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Đầu Bếp",
        message: `Không tìm thấy đầu bếp với ID ${id} để xác nhận xóa.`,
      });
    }

    res.status(200).render("admin/chefs/delete", {
      title: `Xác Nhận Xóa: ${chef.name}`,
      chef,
    });
  } catch (error) {
    next(error);
  }
});

// 7. DELETE /admin/chefs/:id - Xóa đầu bếp qua Method Override
router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseValidId(req.params.id);
    if (!id) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Đầu Bếp",
        message: `ID đầu bếp "${req.params.id}" không hợp lệ.`,
      });
    }

    const chef = await prisma.chef.findUnique({ where: { id } });
    if (!chef) {
      return res.status(404).render("404", {
        title: "404 - Không Tìm Thấy Đầu Bếp",
        message: `Không tìm thấy đầu bếp với ID ${id} để xóa.`,
      });
    }

    await prisma.chef.delete({ where: { id } });

    return res.redirect(303, "/admin/chefs");
  } catch (error) {
    next(error);
  }
});

module.exports = router;
