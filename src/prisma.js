const { PrismaClient } = require("@prisma/client");

// Khởi tạo instance PrismaClient singleton
const prisma = new PrismaClient();

module.exports = prisma;
