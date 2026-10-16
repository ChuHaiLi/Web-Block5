const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("==> Bắt đầu nạp dữ liệu mẫu (Seed Database)...");

  // Xóa dữ liệu cũ theo thứ tự quan hệ
  await prisma.dish.deleteMany({});
  await prisma.chef.deleteMany({});
  await prisma.ingredient.deleteMany({});

  // 1. Seed Đầu bếp (Chefs)
  const chefDang = await prisma.chef.create({
    data: {
      name: "Nguyễn Hải Đăng",
      specialty: "Bếp trưởng ẩm thực truyền thống Bắc Bộ, 15 năm kinh nghiệm",
    },
  });

  const chefLan = await prisma.chef.create({
    data: {
      name: "Trần Thị Mai Lan",
      specialty: "Chuyên gia bánh ngọt và món tráng miệng cung đình",
    },
  });

  const chefPhuc = await prisma.chef.create({
    data: {
      name: "Lê Hoàng Phúc",
      specialty: "Bếp phó phụ trách các món nướng than hoa và hải sản",
    },
  });

  // 2. Seed Nguyên liệu (Ingredients)
  const ingPho = await prisma.ingredient.create({ data: { name: "Bánh phở tươi", quantity: 25, unit: "kg" } });
  const ingBo = await prisma.ingredient.create({ data: { name: "Thịt thăn bò Úc", quantity: 15, unit: "kg" } });
  const ingSuon = await prisma.ingredient.create({ data: { name: "Sườn heo non", quantity: 20, unit: "kg" } });
  const ingGao = await prisma.ingredient.create({ data: { name: "Gạo tấm thơm", quantity: 50, unit: "kg" } });
  const ingTom = await prisma.ingredient.create({ data: { name: "Tôm sú tươi", quantity: 12, unit: "kg" } });
  const ingSen = await prisma.ingredient.create({ data: { name: "Hạt sen Huế", quantity: 5000, unit: "gam" } });
  const ingMam = await prisma.ingredient.create({ data: { name: "Nước mắm cá cơm", quantity: 30, unit: "lít" } });
  const ingRau = await prisma.ingredient.create({ data: { name: "Rau quế và rau thơm các loại", quantity: 40, unit: "bó" } });

  // 3. Seed Món ăn kèm Đầu bếp và Nguyên liệu (Dishes with Chef & Ingredients)
  await prisma.dish.create({
    data: {
      name: "Phở Bò Tái Nạm",
      description: "Bò tái mềm kết hợp nạm giòn thơm cùng nước dùng ninh xương 12 tiếng.",
      price: 55000,
      category: "Món Nước",
      available: true,
      imageUrl: "/assets/img/dishes/pho-bo.jpg",
      chefId: chefDang.id,
      ingredients: { connect: [{ id: ingPho.id }, { id: ingBo.id }, { id: ingMam.id }, { id: ingRau.id }] },
    },
  });

  await prisma.dish.create({
    data: {
      name: "Bún Chả Hà Nội",
      description: "Chả nướng than hoa thơm lừng ăn kèm bún tươi, chả viên và nước mắm chua ngọt.",
      price: 50000,
      category: "Món Khô",
      available: true,
      imageUrl: "/assets/img/dishes/bun-cha.jpg",
      chefId: chefDang.id,
      ingredients: { connect: [{ id: ingSuon.id }, { id: ingMam.id }, { id: ingRau.id }] },
    },
  });

  await prisma.dish.create({
    data: {
      name: "Cơm Tấm Sườn Bì Chả",
      description: "Sườn nướng mật ong đậm đà kết hợp bì thính, chả trứng hấp thơm ngậy.",
      price: 45000,
      category: "Món Cơm",
      available: true,
      imageUrl: "/assets/img/dishes/com-tam.jpg",
      chefId: chefPhuc.id,
      ingredients: { connect: [{ id: ingGao.id }, { id: ingSuon.id }, { id: ingMam.id }] },
    },
  });

  await prisma.dish.create({
    data: {
      name: "Gỏi Cuốn Tôm Thịt",
      description: "Tôm tươi hấp, thịt ba chỉ luộc, rau thơm cuộn bánh tráng chấm tương đậu phộng.",
      price: 35000,
      category: "Khai Vị",
      available: true,
      imageUrl: "/assets/img/dishes/goi-cuon.jpg",
      chefId: chefPhuc.id,
      ingredients: { connect: [{ id: ingTom.id }, { id: ingRau.id }, { id: ingMam.id }] },
    },
  });

  await prisma.dish.create({
    data: {
      name: "Chè Hạt Sen Long Nhãn",
      description: "Vị ngọt thanh tao từ long nhãn Hưng Yên quyện cùng hạt sen bùi bùi giải nhiệt.",
      price: 30000,
      category: "Tráng Miệng",
      available: true,
      imageUrl: "/assets/img/dishes/che-hat-sen.jpg",
      chefId: chefLan.id,
      ingredients: { connect: [{ id: ingSen.id }] },
    },
  });

  await prisma.dish.create({
    data: {
      name: "Lẩu Cua Đồng Hải Sản",
      description: "Riêu cua đồng tươi ngọt đậm vị đồng quê, ăn kèm hải sản tươi sống và rau muống.",
      price: 250000,
      category: "Món Lẩu",
      available: false,
      imageUrl: "/assets/img/dishes/lau-cua-dong.jpg",
      chefId: chefPhuc.id,
      ingredients: { connect: [{ id: ingTom.id }, { id: ingRau.id }] },
    },
  });

  await prisma.dish.create({
    data: {
      name: "Mì Quảng Tôm Thịt",
      description: "Món ăn đặc sản mang đậm phong vị ẩm thực miền Trung truyền thống.",
      price: 45000,
      category: "Món Nước",
      available: true,
      imageUrl: "/assets/img/dishes/mi-quang.jpg",
      chefId: chefDang.id,
      ingredients: { connect: [{ id: ingTom.id }, { id: ingSuon.id }, { id: ingRau.id }] },
    },
  });

  console.log(`==> Seed thành công: Đầu bếp, Nguyên liệu và Món ăn đã được liên kết quan hệ chặt chẽ!`);
}

main()
  .catch((e) => {
    console.error("Lỗi khi seed dữ liệu:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
