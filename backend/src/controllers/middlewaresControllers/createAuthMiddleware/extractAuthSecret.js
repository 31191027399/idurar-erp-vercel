const extractAuthSecret = (req) => {
  const authHeader = req.headers['authorization'];
  const xApiKeyHeader = req.headers['x-api-key'];

  const bearerToken =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

  const apiKeyHeader = typeof xApiKeyHeader === 'string' ? xApiKeyHeader.trim() : null;

  return {
    authHeader,
    bearerToken: bearerToken || null,
    apiKeyHeader: apiKeyHeader || null,
  };
};

module.exports = extractAuthSecret;
