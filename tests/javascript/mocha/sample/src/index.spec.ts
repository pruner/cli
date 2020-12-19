import { strictEqual } from "assert";
import index from "./";

it("hello world 1", () => {
	strictEqual(index("world"), "world-static");
});

it("hello darkness 1", () => {
	strictEqual(index("darkness"), "darkness-static");
});
