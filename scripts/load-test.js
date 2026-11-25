const autocannon = require('autocannon');

const url = process.env.LOAD_TEST_URL || 'http://localhost:5000/api/events';

const instance = autocannon(
  { url, method: 'GET', connections: 10, duration: 10 },
  (err, result) => {
    if (err) {
      console.error('Load test failed:', err);
      process.exit(1);
    }
    console.log(`\nGET ${url}`);
    console.log(`2xx responses: ${result['2xx']}, non-2xx: ${result.non2xx}, errors: ${result.errors}`);
    console.log(`Requests: ${result.requests.total} in ${result.duration}s, avg ${result.requests.average} req/s`);
    console.log(`Latency: avg ${result.latency.average} ms, p99 ${result.latency.p99} ms`);
  }
);

autocannon.track(instance, { renderProgressBar: false });
