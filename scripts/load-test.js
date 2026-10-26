import autocannon from 'autocannon';

async function runLoadTest() {

  const instance = autocannon({
    url: 'http://localhost:5000/api/check-ins', 
    connections: 10, 
    duration: 10,   
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      qrCodeHash: 'test_hash_sample',
      scannedBy: 1
    }),
  }, (err, result) => {
    if (err) {
      console.error(' Ошибка ', err);
    } else {
      console.log('тест успешно завершен!');
      console.log(`Результаты: обработано ${result.requests.total} запросов за ${result.duration} секунд.`);
    }
  });

  autocannon.track(instance);
}

runLoadTest();