function runtimeInfo() {
  return Object.freeze({ node: process.version });
}

module.exports = { runtimeInfo };
