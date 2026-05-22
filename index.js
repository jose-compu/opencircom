"use strict";

const path = require("path");

const circuitsDir = path.join(__dirname, "circuits");

module.exports = {
    circuitsDir,
    circuits: {
        hashing: path.join(circuitsDir, "hashing"),
        merkle: path.join(circuitsDir, "merkle"),
        voting: path.join(circuitsDir, "voting"),
    },
};
