export function httpCache({ maxAge = 60, swr = 0, scope = 'public' } = {}) {
  const directives = [scope, `max-age=${maxAge}`];
  if (swr > 0) directives.push(`stale-while-revalidate=${swr}`);
  const value = directives.join(', ');
  return (req, res, next) => {
    res.setHeader('Cache-Control', value);
    next();
  };
}
