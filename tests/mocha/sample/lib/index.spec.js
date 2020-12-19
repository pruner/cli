"use strict";
exports.__esModule = true;
var assert_1 = require("assert");
var _1 = require("./");
describe("Typescript usage suite", function () {
    it("should be able to execute a test", function () {
        assert_1.equal(true, true);
    });
    it("should return expected string", function () {
        assert_1.equal(_1["default"]("incoming"), "incoming-static");
    });
});
