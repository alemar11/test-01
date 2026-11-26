function listNames(items) {
  return items.slice(0, -1).map((item) => item.name);
}

module.exports = { listNames };
