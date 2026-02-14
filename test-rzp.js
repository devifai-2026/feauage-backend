const Razorpay = require('razorpay');
const axios = require('axios');

const key_id = 'rzp_test_SG44kbdRqtUqN8';
const key_secret = 'YszgCu5szeYBnilryqE6mBGR';

const razorpay = new Razorpay({ key_id, key_secret });

async function test() {
  try {
    console.log('Testing Orders API...');
    const orders = await razorpay.orders.all({ count: 1 });
    console.log('Orders API Success:', orders.items.length > 0 ? 'Found orders' : 'No orders yet');

    console.log('\nTesting direct payment POST...');
    const auth = Buffer.from(`${key_id}:${key_secret}`).toString('base64');
    const response = await axios.post('https://api.razorpay.com/v1/payments', {
        amount: 1000,
        currency: 'INR',
        email: 'test@example.com',
        contact: '9999999999',
        method: 'card', 
        card: {
            number: '4111111111111111',
            expiry_month: '12',
            expiry_year: '30',
            cvv: '123',
            name: 'Test'
        }
    }, {
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
        }
    });
    console.log('Payment Success:', response.data);
  } catch (err) {
    console.log('Error Code:', err.response?.status);
    console.log('Error Data:', JSON.stringify(err.response?.data, null, 2));
  }
}

test();
