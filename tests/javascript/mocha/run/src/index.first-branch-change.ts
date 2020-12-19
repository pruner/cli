export default function (incomingText: string) {

	if (incomingText === "world") {
		console.log("hello 1");
		console.log("hello 2");
		console.log("hello 3");
		console.log("hello x");
		console.log("hello 5");
		console.log("hello 6");
		console.log("hello 7");
	} else {
		console.log("darkness 1");
		console.log("darkness 2");
		console.log("darkness 3");
		console.log("darkness 4");
		console.log("darkness 5");
		console.log("darkness 6");
		console.log("darkness 7");
	}

	return `${incomingText}-static`;
}
