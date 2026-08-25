const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

class PineIntegrity {

    constructor({
        strategyFile = "BullionAI.pine",
        hashFile = "data\bullionai-pine-integrity.json",
    } = {}) {

        this.projectRoot =
            process.cwd();

        this.strategyFile =
            path.resolve(
                this.projectRoot,
                strategyFile
            );

        this.hashFile =
            path.resolve(
                this.projectRoot,
                hashFile
            );
    }

    // =========================================================
    // READ STRATEGY
    // =========================================================

    readStrategy() {

        if (
            !fs.existsSync(
                this.strategyFile
            )
        ) {
            throw new Error(
                `Pine strategy not found: ${this.strategyFile}`
            );
        }

        return fs.readFileSync(
            this.strategyFile
        );
    }

    // =========================================================
    // CALCULATE SHA256
    // =========================================================

    calculateHash() {

        const content =
            this.readStrategy();

        return crypto
            .createHash("sha256")
            .update(content)
            .digest("hex");
    }

    // =========================================================
    // SAVE BASELINE
    // =========================================================

    createBaseline() {

        const hash =
            this.calculateHash();

        const directory =
            path.dirname(
                this.hashFile
            );

        if (
            !fs.existsSync(
                directory
            )
        ) {
            fs.mkdirSync(
                directory,
                {
                    recursive: true,
                }
            );
        }

        const baseline = {
            strategyFile:
                path.relative(
                    this.projectRoot,
                    this.strategyFile
                ),

            algorithm:
                "sha256",

            hash,

            createdAt:
                new Date().toISOString(),
        };

        fs.writeFileSync(
            this.hashFile,
            JSON.stringify(
                baseline,
                null,
                2
            ),
            "utf8"
        );

        return baseline;
    }

    // =========================================================
    // LOAD BASELINE
    // =========================================================

    loadBaseline() {

        if (
            !fs.existsSync(
                this.hashFile
            )
        ) {
            return null;
        }

        return JSON.parse(
            fs.readFileSync(
                this.hashFile,
                "utf8"
            )
        );
    }

    // =========================================================
    // VERIFY
    // =========================================================

    verify() {

        const baseline =
            this.loadBaseline();

        if (!baseline) {

            throw new Error(
                "Pine integrity baseline does not exist."
            );
        }

        const currentHash =
            this.calculateHash();

        const expectedHash =
            String(
                baseline.hash || ""
            ).trim();

        const matches =
            currentHash ===
            expectedHash;

        return {
            valid:
                matches,

            strategyFile:
                this.strategyFile,

            expectedHash,

            currentHash,

            algorithm:
                "sha256",
        };
    }

    // =========================================================
    // REQUIRE VALID
    // =========================================================

    requireValid() {

        const result =
            this.verify();

        if (!result.valid) {

            throw new Error(
                [
                    "PINE STRATEGY INTEGRITY FAILED.",
                    "",
                    `Strategy: ${result.strategyFile}`,
                    "",
                    `Expected SHA256: ${result.expectedHash}`,
                    `Current SHA256:  ${result.currentHash}`,
                    "",
                    "BullionAI.pine has changed.",
                    "Execution stopped.",
                ].join("\n")
            );
        }

        return result;
    }
}


module.exports = {
    PineIntegrity,
};