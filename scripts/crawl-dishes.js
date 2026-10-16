require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DISH_IMAGES = [
  {
    keyword: 'Phở',
    filename: 'pho-bo.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/99/Ph%E1%BB%9F_b%C3%B2%2C_C%E1%BA%A7u_Gi%E1%BA%A5y%2C_H%C3%A0_N%E1%BB%99i.jpg',
  },
  {
    keyword: 'Bún Chả',
    filename: 'bun-cha.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/8b/B%C3%BAn_ch%E1%BA%A3_Th%E1%BB%A5y_Khu%C3%AA.jpg',
  },
  {
    keyword: 'Cơm Tấm',
    filename: 'com-tam.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Com-Tam-2008.jpg',
  },
  {
    keyword: 'Gỏi Cuốn',
    filename: 'goi-cuon.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Summer_roll.jpg',
  },
  {
    keyword: 'Chè',
    filename: 'che-hat-sen.jpg',
    url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&q=80',
  },
  {
    keyword: 'Lẩu',
    filename: 'lau-cua-dong.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Day177lilybday.JPG',
  },
  {
    keyword: 'Mì Quảng',
    filename: 'mi-quang.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/df/Mi_Quang_1A_Danang.jpg',
  },
];

async function runWithRetry(fn, maxRetries = 5, delayMs = 2000) {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      console.log(`[Attempt ${i}/${maxRetries}] Database retry... (${err.message.split('\n')[0]})`);
      if (i === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function crawlAndAssignImages() {
  console.log("==> Bắt đầu kiểm tra và đồng bộ hình ảnh cho các món ăn...");
  const outDir = path.join(__dirname, '../public/assets/img/dishes');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 1. Tải ảnh nếu file chưa có hoặc bị rỗng
  for (const item of DISH_IMAGES) {
    const dest = path.join(outDir, item.filename);
    if (!fs.existsSync(dest) || fs.statSync(dest).size < 5000) {
      console.log(`[CRAWL] Đang tải ảnh: ${item.filename}...`);
      try {
        const cmd = `curl.exe -s -A "Mozilla/5.0" -L "${item.url}" -o "${dest}"`;
        execSync(cmd, { stdio: 'inherit' });
        console.log(`  -> Đã lưu ${item.filename} (${fs.statSync(dest).size} bytes)`);
      } catch (err) {
        console.error(`  -> Lỗi tải ${item.filename}:`, err.message);
      }
    } else {
      console.log(`[OK] Đã có ảnh chất lượng cao: ${item.filename} (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
    }
  }

  // 2. Cập nhật đường dẫn imageUrl vào cơ sở dữ liệu Supabase
  const dishes = await runWithRetry(() => prisma.dish.findMany());
  console.log(`==> Tìm thấy ${dishes.length} món ăn trong cơ sở dữ liệu. Đang cập nhật...`);

  for (const dish of dishes) {
    const matched = DISH_IMAGES.find((item) =>
      dish.name.toLowerCase().includes(item.keyword.toLowerCase())
    );

    const imageUrl = matched
      ? `/assets/img/dishes/${matched.filename}`
      : `/assets/img/food-${((dish.id - 1) % 6) + 1}.svg`;

    await runWithRetry(() =>
      prisma.dish.update({
        where: { id: dish.id },
        data: { imageUrl },
      })
    );
    console.log(`  - #${dish.id} "${dish.name}" => ${imageUrl}`);
  }

  console.log("==> Hoàn tất crawl và đồng bộ hình ảnh vào database!");
}

crawlAndAssignImages()
  .catch((e) => {
    console.error("Lỗi:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
