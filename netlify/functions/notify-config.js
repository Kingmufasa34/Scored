// Netlify function: hands the date pages their notify settings at runtime, so
// the phone number and ntfy topic live in Netlify env vars, never in git.
//
// Set these in Netlify → Site configuration → Environment variables:
//   REPORTER_WHATSAPP   your number, any format (e.g. +44 7482 011076)
//   NTFY_TOPIC          a secret word to use as the ntfy push topic
exports.handler = async () => {
  const whatsapp = String(process.env.REPORTER_WHATSAPP || '').replace(/[^0-9]/g, '');
  const ntfy = String(process.env.NTFY_TOPIC || '');
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: `window.__NOTIFY=${JSON.stringify({ whatsapp, ntfy })};`,
  };
};
