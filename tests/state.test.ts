import { merge } from "../src/commands/run/state";

test("merge identical identifiers", () => {
	const oldObject = {
		id: 1,
		name: "foo"
	};

	const newObject = {
		id: 1,
		name: "blah"
	};

	let identifierBefore = 0;
	let identifierAfter = 0;

	const merged = merge({
		a: [oldObject],
		b: [newObject],
		groupingKeyProperty: "name",
		identifierProperty: "id",
		onIdentifierChanged: (a, b) => {
			identifierBefore = a;
			identifierAfter = b;
		}
	});

	expect(merged).toStrictEqual([
		{
			id: 1,
			name: "foo"
		},
		{
			id: 2,
			name: "blah"
		}
	]);

	expect(identifierBefore).toBe(1);
	expect(identifierAfter).toBe(2);
});

test("merge identical grouping keys", () => {
	const oldObject = {
		id: 2,
		name: "foo"
	};

	const newObject = {
		id: 1,
		name: "foo"
	};

	let identifierBefore = 0;
	let identifierAfter = 0;

	const merged = merge({
		a: [oldObject],
		b: [newObject],
		groupingKeyProperty: "name",
		identifierProperty: "id",
		onIdentifierChanged: (a, b) => {
			identifierBefore = a;
			identifierAfter = b;
		}
	});

	expect(merged).toStrictEqual([
		{
			id: 1,
			name: "foo"
		}
	]);

	expect(identifierBefore).toBe(0);
	expect(identifierAfter).toBe(0);
});

test("merge identical grouping keys", () => {
	const oldObject = {
		id: 1,
		name: "foo"
	};

	const newObject = {
		id: 2,
		name: "foo"
	};

	let identifierBefore = 0;
	let identifierAfter = 0;

	const merged = merge({
		a: [oldObject],
		b: [newObject],
		groupingKeyProperty: "name",
		identifierProperty: "id",
		onIdentifierChanged: (a, b) => {
			identifierBefore = a;
			identifierAfter = b;
		}
	});

	expect(merged).toStrictEqual([
		{
			id: 2,
			name: "foo"
		}
	]);

	expect(identifierBefore).toBe(0);
	expect(identifierAfter).toBe(0);
});