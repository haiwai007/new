import { test } from "node:test";
import assert from "node:assert/strict";
import { identifyModel } from "./model-match.mjs";
const names = [
  "iPhone 17",
  "iPhone 13",
  "Google Pixel 9 Pro",
  "Samsung Galaxy S25",
  "Honor Magic6",
  "Oppo Find X8",
  "OnePlus 13",
  "Vivo X200",
  "Vivo X90",
];
const models = names.map((name, id) => ({ name, id }));
test("unlisted sibling variants never become base-model evidence", () => {
  for (const name of [
    "iPhone 17e",
    "iPhone 13 mini",
    "Google Pixel 9 Pro Fold",
    "Samsung Galaxy S25 FE",
    "Honor Magic6 RSR",
    "Oppo Find X8 Ultra",
    "OnePlus 13R",
    "Vivo X200 FE",
    "Vivo X90 Pro",
    "Vivo X90 Pro+",
  ])
    assert.equal(
      identifyModel(name + " smartphone review", models),
      undefined,
      name,
    );
});
test("exact review names and hyphenated URLs resolve without stripping model boundaries", () => {
  for (const model of models) {
    assert.equal(identifyModel(model.name + " review", models), model.id);
    assert.equal(
      identifyModel(
        "https://www.example.com/" +
          model.name.replaceAll(" ", "-") +
          "-review.123.0.html",
        models,
      ),
      model.id,
    );
  }
});
