#!/usr/bin/env node

const { items } = require("../src/data");
const { createFixtureQualityReport } = require("../src/fixture-quality");

function runFixtureQualityReport(fixtures = items, output = process.stdout) {
  const report = createFixtureQualityReport(fixtures);
  output.write(`${JSON.stringify(report)}\n`);
  return report.violations.length === 0 ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = runFixtureQualityReport();
}

module.exports = { runFixtureQualityReport };
