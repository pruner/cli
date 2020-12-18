import { strictEqual } from "assert";
import index from "./";

describe("Typescript usage suite", () => {
	it("hello world", () => {
		strictEqual(index("world"), "world-static");
	});

	it("hello darkness", () => {
		strictEqual(index("darkness"), "darkness-static");
	});
});
