/**
 * Parses standard pagination and sorting query params (Page 3):
 * page (from 1), limit (default 20, max 100), sort (e.g. "-createdAt")
 */
function parsePagination(query, defaultSort = "-createdAt") {
  const page = Math.max(1, parseInt(query.page || "1", 10) || 1);
  const rawLimit = parseInt(query.limit || "20", 10) || 20;
  const limit = Math.min(100, Math.max(1, rawLimit));
  const skip = (page - 1) * limit;

  const sortStr = query.sort || defaultSort;
  const sort = {};
  if (sortStr.startsWith("-")) {
    sort[sortStr.slice(1)] = -1;
  } else {
    sort[sortStr] = 1;
  }

  return { page, limit, skip, sort };
}

function buildMeta(page, limit, total, extra = {}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    ...extra,
  };
}

module.exports = { parsePagination, buildMeta };
