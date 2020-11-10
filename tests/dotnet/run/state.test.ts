import { merge, mergeStates } from "../../../src/commands/run/state";

test.only("merge", () => {
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
		groupingKeyAccessor: "name",
		identifierAccessor: "id",
		onIdentifierChanged: (a, b) => {
			identifierBefore = a;
			identifierAfter = b;
		}
	});

	expect(merged).toBe([
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