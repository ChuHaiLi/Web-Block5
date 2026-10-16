const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("==> Bắt đầu nạp dữ liệu mẫu (Seed Database)...");

  // Xóa dữ liệu cũ theo thứ tự
  await prisma.dish.deleteMany({});
  await prisma.chef.deleteMany({});
  await prisma.ingredient.deleteMany({});

  // 1. Seed Món ăn (Dishes)
  const dishes = await prisma.dish.createMany({
    data: [
      {
        name: "Phở Bò Tái Nạm",
        description: "Bò tái mềm kết hợp nạm giòn thơm cùng nước dùng ninh xương 12 tiếng.",
        price: 55000,
        category: "Món Nước",
        available: true,
        imageUrl: "/assets/img/dishes/pho-bo.jpg",
      },
      {
        name: "Bún Chả Hà Nội",
        description: "Chả nướng than hoa thơm lừng ăn kèm bún tươi, chả viên và nước mắm chua ngọt.",
        price: 50000,
        category: "Món Khô",
        available: true,
        imageUrl: "/assets/img/dishes/bun-cha.jpg",
      },
      {
        name: "Cơm Tấm Sườn Bì Chả",
        description: "Sườn nướng mật ong đậm đà kết hợp bì thính, chả trứng hấp thơm ngậy.",
        price: 45000,
        category: "Món Cơm",
        available: true,
        imageUrl: "/assets/img/dishes/com-tam.jpg",
      },
      {
        name: "Gỏi Cuốn Tôm Thịt",
        description: "Tôm tươi hấp, thịt ba chỉ luộc, rau thơm cuộn bánh tráng chấm tương đậu phộng.",
        price: 35000,
        category: "Khai Vị",
        available: true,
        imageUrl: "/assets/img/dishes/goi-cuon.jpg",
      },
      {
        name: "Chè Hạt Sen Long Nhãn",
        description: "Vị ngọt thanh tao từ long nhãn Hưng Yên quyện cùng hạt sen bùi bùi giải nhiệt.",
        price: 30000,
        category: "Tráng Miệng",
        available: true,
        imageUrl: "/assets/img/dishes/che-hat-sen.jpg",
      },
      {
        name: "Lẩu Cua Đồng Hải Sản",
        description: "Riêu cua đồng tươi ngọt đậm vị đồng quê, ăn kèm hải sản tươi sống và rau muống.",
        price: 250000,
        category: "Món Lẩu",
        available: false,
        imageUrl: "/assets/img/dishes/lau-cua-dong.jpg",
      },
      {
        name: "Mì Quảng Tôm Thịt",
        description: "Món ăn đặc sản mang đậm phong vị ẩm thực miền Trung truyền thống.",
        price: 45000,
        category: "Món Nước",
        available: true,
        imageUrl: "/assets/img/dishes/mi-quang.jpg",
      },
    ],
  });

  // 2. Seed Đầu bếp (Chefs)
  const chefs = await prisma.chef.createMany({
    data: [
      {
        name: "Nguyễn Hải Đăng",
        specialty: "Bếp trưởng ẩm thực truyền thống Bắc Bộ, 15 năm kinh nghiệm",
      },
      {
        name: "Trần Thị Mai Lan",
        specialty: "Chuyên gia bánh ngọt và món tráng miệng cung đình",
      },
      {
        name: "Lê Hoàng Phúc",
        specialty: "Bếp phó phụ trách các món nướng than hoa và hải sản",
      },
    ],
  });

  // 3. Seed Nguyên liệu (Ingredients)
  const ingredients = await prisma.ingredient.createMany({
    data: [
      { name: "Bánh phở tươi", quantity: 25, unit: "kg" },
      { name: "Thịt thăn bò Úc", quantity: 15, unit: "kg" },
      { name: "Sườn heo non", quantity: 20, unit: "kg" },
      { name: "Gạo tấm thơm", quantity: 50, unit: "kg" },
      { name: "Tôm sú tươi", quantity: 12, unit: "kg" },
      { name: "Hạt sen Huế", quantity: 5000, unit: "gam" },
      { name: "Nước mắm cá cơm", quantity: 30, unit: "lít" },
      { name: "Rau quế và rau thơm các loại", quantity: 40, unit: "bó" },
    ],
  });

  console.log(`==> Seed thành công:`);
  console.log(`    - ${dishes.count} món ăn (Dishes)`);
  console.log(`    - ${chefs.count} đầu bếp (Chefs)`);
  console.log(`    - ${ingredients.count} nguyên liệu (Ingredients)`);
}

main()
  .catch((e) => {
    console.error("Lỗi khi seed dữ liệu:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
