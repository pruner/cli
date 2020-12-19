import { strictEqual } from "assert";
import index from "./";

describe("Typescript usage suite", () => {
	it("hello world 1", () => {
		strictEqual(index("world"), "world-static");
	});

	it("hello darkness 1", () => {
		strictEqual(index("darkness"), "darkness-static");
	});
});
