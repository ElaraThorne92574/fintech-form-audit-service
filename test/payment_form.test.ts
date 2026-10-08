import { strict as assert } from "node:assert";
import { decidePayment } from "../src/payment_form";

const accepted = decidePayment(0.2);
assert.equal(accepted.approved, true);
assert.equal(decidePayment(0.7).approved, false);
console.log("payment decision test passed");
