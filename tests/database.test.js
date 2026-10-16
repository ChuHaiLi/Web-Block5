// Opt-in integration tests. Every run pushes/seeds ONLY a random isolated schema.
// TEST_DATABASE_URL must be a PostgreSQL account allowed to create/drop schemas.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { once } = require("node:events");
const path = require("node:path");

test("PostgreSQL integration in an isolated temporary schema", {
  skip: !process.env.TEST_DATABASE_URL && "Set TEST_DATABASE_URL to opt in; never runs on the configured application schema.",
}, async t => {
  const schema = "audit_test_" + randomBytes(12).toString("hex");
  assert.match(schema, /^audit_test_[a-f0-9]{24}$/);
  const url = new URL(process.env.TEST_DATABASE_URL);
  url.searchParams.set("schema", schema);
  process.env.DATABASE_URL = url.toString();
  const cwd = path.resolve(__dirname, "..");
  function run(args) {
    const result = spawnSync(process.execPath, args, { cwd, env: process.env, encoding: "utf8", timeout: 90000 });
    // CLI output can contain connection details, so never echo it.
    const codes = [...new Set(((result.stderr || "") + (result.stdout || "")).match(/\bP\d{4}\b/g) || [])];
    assert.equal(result.status, 0, `Setup command failed (${args[0]}), exit=${result.status}, codes=${codes.join(",")}; output withheld to protect connection details.`);
  }
  const db = require("../src/prisma");
  let server;
  try {
    run(["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"]);
    run(["prisma/seed.js"]);
    const seedCounts = async () => Promise.all([db.dish.count(), db.chef.count(), db.ingredient.count()]);
    await t.test("setup and repeated seed populate all three tables", async () => {
      assert.deepEqual(await seedCounts(), [7, 3, 8]);
      run(["prisma/seed.js"]);
      assert.deepEqual(await seedCounts(), [7, 3, 8]);
    });

    const app = require("../src/app");
    const { PrismaClient } = require("@prisma/client");
    let hook;
    db.$use(async (params, next) => {
      if (hook && hook.model === params.model && hook.action === params.action) {
        const current = hook;
        hook = null;
        await current.work();
      }
      return next(params);
    });
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    function encode(values) {
      const form = new URLSearchParams();
      for (const [key, value] of Object.entries(values)) {
        if (value === undefined) continue;
        for (const item of Array.isArray(value) ? value : [value]) form.append(key, item);
      }
      return form;
    }
    async function request(route, values) {
      const response = await fetch(base + route, {
        method: values === undefined ? "GET" : "POST", redirect: "manual",
        ...(values === undefined ? {} : { body: typeof values === "string" ? new URLSearchParams(values) : encode(values) }),
      });
      return { status: response.status, location: response.headers.get("location"), html: await response.text() };
    }
    const snapshot = async () => JSON.stringify(await Promise.all([
      db.dish.findMany({ orderBy: { id: "asc" }, include: { ingredients: { orderBy: { id: "asc" } } } }),
      db.chef.findMany({ orderBy: { id: "asc" } }), db.ingredient.findMany({ orderBy: { id: "asc" } }),
    ]));
    const seededDish = await db.dish.findFirst({ include: { chef: true, ingredients: true } });
    const seededIngredient = seededDish.ingredients[0];
    let chef, ingredient, extraIngredient, dish;
    const payload = () => ({ name: 'Món <script>alert("x")</script>', description: '<b>Mô tả</b>\nDòng hai', price: "0", category: "Món thử", imageUrl: "/assets/img/food-1.svg", chefId: String(chef.id), ingredientIds: [String(ingredient.id), String(extraIngredient.id)] });

    await t.test("SSR lists, name search, repeated query, empty result and fresh details", async () => {
      for (const route of ["/dishes", "/admin/dishes", "/admin/chefs", "/admin/ingredients", "/dishes?q=A&q=B", "/dishes?q[x]=A"]) {
        assert.equal((await request(route)).status, 200, route);
      }
      const found = await request('/dishes?q=' + encodeURIComponent(seededDish.name));
      assert.match(found.html, new RegExp(`/dishes/${seededDish.id}`));
      assert.match((await request('/dishes?q=zzzz-no-such-dish')).html, /Không tìm thấy món ăn nào/);
      const detail = await request('/dishes/' + seededDish.id);
      for (const value of [seededDish.name, seededDish.description, seededDish.category, seededDish.chef.name]) assert.ok(detail.html.includes(value));
      assert.match(detail.html, /Ngày Tạo/);
      assert.equal((await request('/admin/dishes/' + seededDish.id)).status, 200);
    });

    await t.test("all new/edit/delete pages render native SSR forms; confirmation and GET override do not write", async () => {
      const before = await snapshot();
      for (const [area, id] of [["dishes", seededDish.id], ["chefs", seededDish.chefId], ["ingredients", seededIngredient.id]]) {
        for (const suffix of ["new", `${id}/edit`, `${id}/delete`]) {
          const page = await request(`/admin/${area}/${suffix}`);
          assert.equal(page.status, 200);
          if (suffix !== `${id}/delete` || area !== "ingredients") assert.match(page.html, /method="POST"/);
          if (suffix.endsWith('/edit')) assert.match(page.html, /\?_method=PATCH/);
        }
        await request(`/admin/${area}/${id}?_method=DELETE`);
        await request(`/admin/${area}/${id}/delete?_method=DELETE`);
      }
      assert.equal(await snapshot(), before);
      const fresh = await request('/admin/dishes/new');
      assert.match(fresh.html.match(/<input\s[^>]*name="available"[^>]*>/)[0], /checked/);
    });

    await t.test("create each model, verify 303/Location and real persisted data, reload is safe", async () => {
      let res = await request('/admin/chefs', { name: "  Test Chef  ", specialty: "Bếp thử", id: "123", createdAt: "bad" });
      assert.equal(res.status, 303); assert.equal(res.location, '/admin/chefs');
      chef = await db.chef.findFirst({ where: { name: "Test Chef" } });
      assert.ok(chef); assert.notEqual(chef.id, 123);
      res = await request('/admin/ingredients', { name: "Test Ingredient", quantity: "0", unit: "kg" });
      assert.equal(res.status, 303); assert.equal(res.location, '/admin/ingredients');
      ingredient = await db.ingredient.findFirst({ where: { name: "Test Ingredient" } });
      assert.equal(ingredient.quantity, 0);
      await request('/admin/ingredients', { name: "Extra Ingredient", quantity: "2147483647", unit: "gam" });
      extraIngredient = await db.ingredient.findFirst({ where: { name: "Extra Ingredient" } });
      assert.equal(extraIngredient.quantity, 2147483647);
      res = await request('/admin/dishes', { ...payload(), ingredientIds: [...payload().ingredientIds, String(ingredient.id)] });
      assert.equal(res.status, 303);
      dish = await db.dish.findFirst({ where: { name: payload().name }, include: { ingredients: true } });
      assert.equal(res.location, '/admin/dishes/' + dish.id);
      assert.equal(dish.available, false); assert.equal(dish.price, 0); assert.equal(dish.chefId, chef.id);
      assert.equal(dish.ingredients.length, 2);
      const before = await snapshot();
      for (let i = 0; i < 2; i++) assert.equal((await request(res.location)).status, 200);
      assert.equal(await snapshot(), before);
      const html = (await request('/dishes/' + dish.id)).html;
      assert.match(html, /&lt;script&gt;/); assert.match(html, /&lt;b&gt;Mô tả&lt;\/b&gt;/);
      assert.doesNotMatch(html, /<script>alert|<b>Mô tả<\/b>/);
    });

    await t.test("POST and PATCH reject all invalid prices, quantities, scalar types and relations without writes", async () => {
      const before = await snapshot();
      const invalidNumbers = [undefined, "", "   ", "-1", "abc", "1.5", "Infinity", "NaN", "2147483648", "1e2", "0x10", ["1", "2"]];
      let count = 0;
      for (const edit of [false, true]) {
        const dishRoute = edit ? `/admin/dishes/${dish.id}?_method=PATCH` : '/admin/dishes';
        const ingredientRoute = edit ? `/admin/ingredients/${ingredient.id}?_method=PATCH` : '/admin/ingredients';
        const chefRoute = edit ? `/admin/chefs/${chef.id}?_method=PATCH` : '/admin/chefs';
        for (const value of invalidNumbers) {
          assert.equal((await request(dishRoute, { ...payload(), price: value })).status, 400, `price=${value}`); count++;
          assert.equal((await request(ingredientRoute, { name: "Test Ingredient", quantity: value, unit: "kg" })).status, 400, `quantity=${value}`); count++;
        }
        for (const field of ["name", "description", "category", "imageUrl", "chefId", "available"]) {
          assert.equal((await request(dishRoute, { ...payload(), [field]: ["A", "B"] })).status, 400, field); count++;
          const body = encode(payload()); body.delete(field); body.set(`${field}[x]`, 'A');
          assert.equal((await request(dishRoute, body.toString())).status, 400, `${field} object`); count++;
        }
        for (const value of [undefined, "", "0", "-1", "1.5", "1abc", "2147483648", "2147483647"]) {
          for (const field of ["chefId", "ingredientIds"]) {
            assert.equal((await request(dishRoute, { ...payload(), [field]: value })).status, 400, field); count++;
          }
        }
        for (const value of [[String(ingredient.id), "-1"], [String(ingredient.id), "2147483647"]]) {
          assert.equal((await request(dishRoute, { ...payload(), ingredientIds: value })).status, 400); count++;
        }
        for (const field of ["name", "specialty"]) for (const value of [undefined, "", "   ", ["A", "B"]]) {
          assert.equal((await request(chefRoute, { name: "Chef", specialty: "Bếp", [field]: value })).status, 400); count++;
        }
        for (const field of ["name", "unit"]) for (const value of [undefined, "", "   ", ["A", "B"]]) {
          assert.equal((await request(ingredientRoute, { name: "Gạo", unit: "kg", quantity: "1", [field]: value })).status, 400); count++;
        }
        for (const value of [undefined, "", "   "]) {
          assert.equal((await request(dishRoute, { ...payload(), name: value })).status, 400); count++;
        }
      }
      assert.equal(await snapshot(), before);
      t.diagnostic(`${count} invalid form submissions rejected with HTTP 400; full database snapshot unchanged.`);
    });

    await t.test("error forms preserve text, textarea, price, dropdown, ingredients and both checkbox states", async () => {
      for (const edit of [false, true]) for (const checked of [false, true]) {
        const route = edit ? `/admin/dishes/${dish.id}?_method=PATCH` : '/admin/dishes';
        const res = await request(route, { ...payload(), name: "   ", available: checked ? "on" : undefined });
        assert.equal(res.status, 400);
        const checkbox = res.html.match(/<input\s[^>]*name="available"[^>]*>/)[0];
        assert.equal(/checked/.test(checkbox), checked);
        assert.match(res.html, /value="   "/);
        assert.match(res.html, /&lt;b&gt;Mô tả&lt;\/b&gt;\nDòng hai/);
        assert.match(res.html, /value="0"/);
        assert.match(res.html, /value="Món thử"/);
        assert.ok(new RegExp(`<option value="${chef.id}" selected`).test(res.html));
        for (const id of [ingredient.id, extraIngredient.id]) assert.ok(new RegExp(`name="ingredientIds"\\s+value="${id}"\\s+checked`).test(res.html));
      }
    });

    await t.test("PATCH persists integers and relations, fresh GET sees changes; delete restrictions and SetNull remain", async () => {
      let res = await request(`/admin/dishes/${dish.id}?_method=PATCH`, { ...payload(), name: "Updated Dish", price: "2147483647", available: "on", ingredientIds: String(ingredient.id) });
      assert.equal(res.status, 303); assert.equal(res.location, `/admin/dishes/${dish.id}`);
      const updated = await db.dish.findUnique({ where: { id: dish.id }, include: { ingredients: true } });
      assert.equal(updated.price, 2147483647); assert.equal(updated.available, true); assert.equal(updated.ingredients.length, 1);
      assert.match((await request(`/dishes/${dish.id}`)).html, /Updated Dish/);
      res = await request(`/admin/chefs/${chef.id}?_method=PATCH`, { name: "Updated Chef", specialty: "Món Việt" });
      assert.equal(res.status, 303); assert.equal(res.location, '/admin/chefs');
      assert.equal((await db.chef.findUnique({ where: { id: chef.id } })).name, "Updated Chef");
      res = await request(`/admin/ingredients/${ingredient.id}?_method=PATCH`, { name: "Updated Ingredient", quantity: "42", unit: "g" });
      assert.equal(res.status, 303); assert.equal(res.location, '/admin/ingredients');
      assert.equal((await db.ingredient.findUnique({ where: { id: ingredient.id } })).quantity, 42);
      assert.equal((await request(`/admin/ingredients/${ingredient.id}?_method=DELETE`, {})).status, 400);
      assert.ok(await db.ingredient.findUnique({ where: { id: ingredient.id } }));
      assert.equal((await request(`/admin/chefs/${chef.id}?_method=DELETE`, {})).status, 303);
      assert.equal(await db.chef.findUnique({ where: { id: chef.id } }), null);
      assert.equal((await db.dish.findUnique({ where: { id: dish.id } })).chefId, null);
    });

    await t.test("malformed, out-of-range and nonexistent IDs return 404 across detail/edit/delete/PATCH/DELETE", async () => {
      for (const id of ["abc", "0", "-1", "1.5", "2147483648", "1abc", "2147483647"]) {
        assert.equal((await request(`/dishes/${id}`)).status, 404);
        assert.equal((await request(`/admin/dishes/${id}`)).status, 404);
        for (const area of ["dishes", "chefs", "ingredients"]) {
          for (const suffix of ["edit", "delete"]) assert.equal((await request(`/admin/${area}/${id}/${suffix}`)).status, 404);
          for (const method of ["PATCH", "DELETE"]) assert.equal((await request(`/admin/${area}/${id}?_method=${method}`, {})).status, 404);
        }
      }
    });

    await t.test("concurrent relation deletion returns 400 and rolls back the entire POST/PATCH", async () => {
      const other = new PrismaClient();
      try {
        for (const edit of [false, true]) for (const removed of ["chef", "ingredient"]) {
          const selectedChef = await db.chef.create({ data: { name: "Race Chef", specialty: "Test" } });
          const selectedIngredient = await db.ingredient.create({ data: { name: "Race Ingredient", unit: "kg", quantity: 1 } });
          const target = edit ? await db.dish.create({ data: {
            name: "Original", price: 100, chefId: seededDish.chefId,
            ingredients: { connect: [{ id: seededIngredient.id }] },
          } }) : null;
          const original = target && await db.dish.findUnique({ where: { id: target.id }, include: { ingredients: true } });
          const beforeCount = await db.dish.count();
          hook = { model: "Dish", action: edit ? "update" : "create", work: () => other[removed].delete({ where: { id: removed === "chef" ? selectedChef.id : selectedIngredient.id } }) };
          const res = await request(edit ? `/admin/dishes/${target.id}?_method=PATCH` : '/admin/dishes', {
            ...payload(), name: "Must Not Persist", chefId: String(selectedChef.id), ingredientIds: String(selectedIngredient.id),
          });
          assert.equal(res.status, 400, `${removed} deleted during ${edit ? 'PATCH' : 'POST'}`);
          assert.equal(await db.dish.count(), beforeCount);
          if (target) assert.deepEqual(await db.dish.findUnique({ where: { id: target.id }, include: { ingredients: true } }), original);
        }
      } finally { hook = null; await other.$disconnect(); }
    });

    await t.test("concurrent target deletion returns 404 during PATCH/DELETE for all models", async () => {
      const other = new PrismaClient();
      try {
        for (const [model, modelName, area, data] of [
          ["dish", "Dish", "dishes", { name: "Race target", price: 1 }],
          ["chef", "Chef", "chefs", { name: "Race target", specialty: "Test" }],
          ["ingredient", "Ingredient", "ingredients", { name: "Race target", quantity: 1, unit: "kg" }],
        ]) for (const action of ["update", "delete"]) {
          const target = await db[model].create({ data });
          const replacementChef = await db.chef.findFirst();
          const replacementIngredient = await db.ingredient.findFirst();
          hook = { model: modelName, action, work: () => other[model].delete({ where: { id: target.id } }) };
          const values = action === 'delete' ? {} : model === 'dish'
            ? { ...payload(), chefId: String(replacementChef.id), ingredientIds: String(replacementIngredient.id) }
            : model === 'chef' ? { name: "Changed", specialty: "Test" } : { name: "Changed", quantity: "1", unit: "kg" };
          const res = await request(`/admin/${area}/${target.id}?_method=${action === 'delete' ? 'DELETE' : 'PATCH'}`, values);
          assert.equal(res.status, 404, `${model} ${action}`);
          assert.equal(await db[model].findUnique({ where: { id: target.id } }), null);
        }
      } finally { hook = null; await other.$disconnect(); }
    });

    await t.test("concurrent dish connection keeps the ingredient deletion restriction", async () => {
      const other = new PrismaClient();
      const selected = await db.ingredient.create({ data: { name: "Concurrent ingredient", unit: "kg", quantity: 1 } });
      try {
        hook = { model: "Ingredient", action: "delete", work: () => other.$transaction(async tx => {
          await tx.dish.create({ data: { name: "Concurrent usage", price: 1, ingredients: { connect: [{ id: selected.id }] } } });
        }, { isolationLevel: "Serializable" }) };
        const res = await request(`/admin/ingredients/${selected.id}?_method=DELETE`, {});
        assert.equal(res.status, 400);
        assert.ok(await db.ingredient.findUnique({ where: { id: selected.id } }));
      } finally { hook = null; await other.$disconnect(); }
    });

    await t.test("real unreachable PostgreSQL returns generic 500 without leaking error/credentials", async () => {
      const unavailable = new PrismaClient({ datasourceUrl: "postgresql://test:TEST_SECRET@127.0.0.1:1/test?connect_timeout=1" });
      const originalLog = console.error;
      const logs = [];
      console.error = (...args) => logs.push(JSON.stringify(args));
      try {
        hook = { model: "Dish", action: "findMany", work: () => unavailable.dish.findMany() };
        const res = await request('/dishes');
        assert.equal(res.status, 500);
        assert.match(res.html, /error-badge">500</);
        assert.match(res.html, /500 - Lỗi Máy Chủ/);
        assert.doesNotMatch(res.html, /TEST_SECRET|127\.0\.0\.1:1|PrismaClient|P1001|Can't reach/);
        assert.doesNotMatch(logs.join('\n'), /TEST_SECRET|127\.0\.0\.1:1|Can't reach/);
      } finally { console.error = originalLog; hook = null; await unavailable.$disconnect(); }
    });

    await t.test("DELETE persists removal and destination reload never repeats a write", async () => {
      for (const [area, model, id] of [["dishes", "dish", dish.id], ["ingredients", "ingredient", ingredient.id], ["ingredients", "ingredient", extraIngredient.id]]) {
        const before = await snapshot();
        assert.equal((await request(`/admin/${area}/${id}/delete`)).status, 200);
        assert.equal(await snapshot(), before);
        const res = await request(`/admin/${area}/${id}?_method=DELETE`, {});
        assert.equal(res.status, 303); assert.equal(res.location, `/admin/${area}`);
        assert.equal(await db[model].findUnique({ where: { id } }), null);
        const after = await snapshot();
        for (let i = 0; i < 2; i++) assert.equal((await request(res.location)).status, 200);
        assert.equal(await snapshot(), after);
        assert.equal((await request(`/admin/${area}/${id}?_method=DELETE`, {})).status, 404);
      }
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    // Identifier is generated above, never supplied by a user or request.
    // Strict whitelist protects the sole raw DDL statement used for test cleanup.
    assert.match(schema, /^audit_test_[a-f0-9]{24}$/);
    try { await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); }
    finally { await db.$disconnect(); }
  }
});
