const { Prisma } = require("@prisma/client");

function notFound(res) {
  return res.status(404).render("404", {
    title: "404 - Không Tìm Thấy",
    message: "ID không hợp lệ hoặc bản ghi không còn tồn tại.",
  });
}

function isPrismaError(error, codes) {
  return error instanceof Prisma.PrismaClientKnownRequestError && codes.includes(error.code);
}

// PostgreSQL can abort a serializable transaction when a concurrent write wins.
async function serializable(prisma, work) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt >= 2 || !isPrismaError(error, ["P2034"])) throw error;
    }
  }
}

module.exports = { notFound, isPrismaError, serializable };
