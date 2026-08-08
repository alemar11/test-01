const { createHash } = require("node:crypto");

function representationEtag(representation) {
  const digest = createHash("sha256").update(representation).digest("hex");
  return `"sha256-${digest}"`;
}

function skipOptionalWhitespace(value, start) {
  let index = start;

  while (value[index] === " " || value[index] === "\t") {
    index += 1;
  }

  return index;
}

function ifNoneMatchMatches(value, currentEtag) {
  if (typeof value !== "string") {
    return false;
  }

  let index = skipOptionalWhitespace(value, 0);
  if (value[index] === "*") {
    return skipOptionalWhitespace(value, index + 1) === value.length;
  }

  let matches = false;

  while (index < value.length) {
    if (value.startsWith("W/", index)) {
      index += 2;
    }

    if (value[index] !== '"') {
      return false;
    }

    const tagStart = index;
    index += 1;

    while (index < value.length && value[index] !== '"') {
      const character = value.charCodeAt(index);
      if (character < 0x21 || character === 0x7f) {
        return false;
      }
      index += 1;
    }

    if (index >= value.length) {
      return false;
    }

    index += 1;
    matches ||= value.slice(tagStart, index) === currentEtag;
    index = skipOptionalWhitespace(value, index);

    if (index === value.length) {
      return matches;
    }

    if (value[index] !== ",") {
      return false;
    }

    index = skipOptionalWhitespace(value, index + 1);
  }

  return false;
}

function sendValidatedJson(request, response, body) {
  const representation = JSON.stringify(body);
  const etag = representationEtag(representation);

  response.set("ETag", etag);

  if (
    (request.method === "GET" || request.method === "HEAD") &&
    ifNoneMatchMatches(request.get("If-None-Match"), etag)
  ) {
    response.status(304).end();
    return;
  }

  response.json(body);
}

module.exports = { sendValidatedJson };
