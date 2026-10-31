/**
 * Mongoose plugin that converts _id -> id (string) and removes __v and hidden fields
 * recursively on both top-level documents and embedded subdocuments.
 */
function applyToJSON(schema, hiddenFields = []) {
  const transform = (doc, ret) => {
    if (ret._id !== undefined) {
      ret.id = String(ret._id);
      delete ret._id;
    }
    delete ret.__v;
    for (const field of hiddenFields) {
      delete ret[field];
    }
    return ret;
  };

  schema.set("toJSON", { virtuals: true, transform });
  schema.set("toObject", { virtuals: true, transform });
}

module.exports = { applyToJSON };
