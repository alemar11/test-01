function uptimeSeconds() {
  return Math.floor(process.uptime());
}

module.exports = { uptimeSeconds };
