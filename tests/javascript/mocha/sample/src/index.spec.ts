import { strictEqual } from "assert";
import index from "./";

it("hello world 1", () => {
	strictEqual(index("world"), 2);
});

it("hello darkness 1", () => {
	strictEqual(index("darkness"), 3);
});
