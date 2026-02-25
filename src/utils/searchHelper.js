/**
 * Applies regex-based search to a Mongoose query object.
 * 
 * @param {Object} query - The existing query object.
 * @param {string} search - The search term.
 * @param {Array<string>} fields - The fields to search in.
 * @returns {Object} The updated query object.
 */
const applySearch = (query, search, fields) => {
    if (search && fields && fields.length > 0) {
        const searchRegex = { $regex: search, $options: 'i' };

        if (fields.length === 1) {
            query[fields[0]] = searchRegex;
        } else {
            query.$or = fields.map(field => ({ [field]: searchRegex }));
        }
    }
    return query;
};

module.exports = { applySearch };
