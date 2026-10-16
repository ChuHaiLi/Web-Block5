const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseValidId, parseInteger, validateDish, validateChef, validateIngredient } = require("../src/validation");

const chefs = [{ id: 1 }];
const ingredients = [{ id: 1 }, { id: 2 }];
const dish = { name: "Phở", price: "0", chefId: "1", ingredientIds: ["1", "2"] };

test("INT4 decimal validation rejects coercion, fractions, overflow and invalid IDs", () => {
  for (const value of [undefined, null, [], ["1"], {}, 1, "", " ", "-1", "1.5", "Infinity", "NaN", "1e2", "0x10", "2147483648", "1abc"]) {
    assert.equal(parseInteger(value), null);
    assert.equal(parseValidId(value), null);
  }
  assert.equal(parseInteger("0"), 0);
  assert.equal(parseInteger(" 42 "), 42);
  assert.equal(parseInteger("2147483647"), 2147483647);
  assert.equal(parseValidId("0"), null);
  assert.equal(parseValidId(" 1 "), null);
  assert.equal(parseValidId("1\n"), null);
  assert.equal(parseValidId("1\r"), null);
  assert.equal(parseValidId("2147483647"), 2147483647);
});

test("all scalar fields reject arrays/objects without losing other valid inputs", () => {
  for (const [validate, valid, fields] of [
    [body => validateDish(body, chefs, ingredients), dish, ["name", "description", "price", "category", "imageUrl", "chefId", "available"]],
    [validateChef, { name: "An", specialty: "Bếp Việt" }, ["name", "specialty"]],
    [validateIngredient, { name: "Gạo", quantity: "1", unit: "kg" }, ["name", "quantity", "unit"]],
  ]) {
    for (const field of fields) for (const value of [["A", "B"], { x: "A" }, null, 1, true]) {
      const result = validate({ ...valid, [field]: value });
      assert.ok(result.errors.length, field);
      assert.equal(typeof result.form[field], field === "available" ? "boolean" : "string");
      if (field !== "name") assert.equal(result.form.name, valid.name);
    }
  }
});

test("required text and quantity are checked on server", () => {
  for (const value of [undefined, "", "   "]) {
    assert.ok(validateChef({ name: value, specialty: "Bếp" }).errors.length);
    assert.ok(validateChef({ name: "An", specialty: value }).errors.length);
    assert.ok(validateIngredient({ name: "Gạo", quantity: value, unit: "kg" }).errors.length);
    assert.ok(validateIngredient({ name: value, quantity: "0", unit: "kg" }).errors.length);
    assert.ok(validateIngredient({ name: "Gạo", quantity: "0", unit: value }).errors.length);
    assert.ok(validateDish({ ...dish, name: value }, chefs, ingredients).errors.length);
  }
});

test("every relation must be valid; duplicates and single ingredient are accepted", () => {
  for (const value of [undefined, "", "0", "-1", "1.5", "2147483648", "9", ["1", "-1"], ["1", "9"], [["1"]], { id: "1" }]) {
    assert.ok(validateDish({ ...dish, ingredientIds: value }, chefs, ingredients).errors.length);
    assert.ok(validateDish({ ...dish, chefId: value }, chefs, ingredients).errors.length);
  }
  assert.deepEqual(validateDish({ ...dish, ingredientIds: ["1", "1"] }, chefs, ingredients).ingredientIds, [1]);
  assert.equal(validateDish({ ...dish, ingredientIds: "1" }, chefs, ingredients).errors.length, 0);
});

test("checkbox is a boolean and form preserves raw valid scalar text", () => {
  for (const [available, expected] of [[undefined, false], ["on", true], ["true", true], ["false", false]]) {
    const result = validateDish({ ...dish, available, description: "  <b>Phở</b>  " }, chefs, ingredients);
    assert.equal(result.form.available, expected);
    assert.equal(result.data.available, expected);
    assert.equal(result.form.description, "  <b>Phở</b>  ");
    assert.equal(result.data.description, "<b>Phở</b>");
  }
});
