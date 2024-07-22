import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { v4 as uuidv4 } from 'uuid';

jest.mock('../src/helpers', () => ({
  getParameter: (param: string) => `mock://${param}`,
}));

import { getParameter } from '../src/helpers';

const iamAuth = jest.fn().mockReturnValue({});

const payment3pApiUrl = getParameter("/ecommerce/{Environment}/payment-3p/api/url");
const paymentApiUrl = getParameter("/ecommerce/{Environment}/payment/api/url");

describe('validate tests', () => {
  let paymentToken: string;
  let total: number;
  let mock: MockAdapter;

  beforeAll(() => {
    paymentToken = uuidv4();
    total = 3000;
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.reset();
  });

  it('should validate payment token', async () => {
    const cardNumber = "1234567890123456";

    // Create a payment token
    mock.onPost(`${payment3pApiUrl}/preauth`).reply(200, {
      paymentToken: paymentToken
    });

    const res3p = await axios.post(`${payment3pApiUrl}/preauth`, {
      cardNumber: cardNumber,
      amount: total
    });

    expect(res3p.status).toBe(200);
    expect(res3p.data.paymentToken).toBe(paymentToken);

    // Validate the token
    mock.onPost(`${paymentApiUrl}/backend/validate`).reply(200, { ok: true });

    const res = await axios.post(`${paymentApiUrl}/backend/validate`, {
      paymentToken: paymentToken,
      total: total
    }, {
      auth: iamAuth(paymentApiUrl)
    });

    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);

    // Cleanup
    mock.onPost(`${payment3pApiUrl}/cancelPayment`).reply(200, {});

    const cleanupRes = await axios.post(`${payment3pApiUrl}/cancelPayment`, {
      paymentToken: paymentToken
    });

    expect(cleanupRes.status).toBe(200);
  });

  it('should validate non-existent payment token', async () => {
    const nonExistentPaymentToken = uuidv4();

    mock.onPost(`${paymentApiUrl}/backend/validate`).reply(200, { ok: false });

    const res = await axios.post(`${paymentApiUrl}/backend/validate`, {
      paymentToken: nonExistentPaymentToken,
      total: total
    }, {
      auth: iamAuth(paymentApiUrl)
    });

    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(false);
  });

  it('should validate payment token with smaller total', async () => {
    const cardNumber = "1234567890123456";

    // Create a payment token
    mock.onPost(`${payment3pApiUrl}/preauth`).reply(200, {
      paymentToken: paymentToken
    });

    const res3p = await axios.post(`${payment3pApiUrl}/preauth`, {
      cardNumber: cardNumber,
      amount: total
    });

    expect(res3p.status).toBe(200);
    expect(res3p.data.paymentToken).toBe(paymentToken);

    // Validate the token
    mock.onPost(`${paymentApiUrl}/backend/validate`).reply(200, { ok: true });

    const res = await axios.post(`${paymentApiUrl}/backend/validate`, {
      paymentToken: paymentToken,
      total: total - 1000
    }, {
      auth: iamAuth(paymentApiUrl)
    });

    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);

    // Cleanup
    mock.onPost(`${payment3pApiUrl}/cancelPayment`).reply(200, {});

    const cleanupRes = await axios.post(`${payment3pApiUrl}/cancelPayment`, {
      paymentToken: paymentToken
    });

    expect(cleanupRes.status).toBe(200);
  });

  it('should validate payment token with higher total', async () => {
    const cardNumber = "1234567890123456";

    // Create a payment token
    mock.onPost(`${payment3pApiUrl}/preauth`).reply(200, {
      paymentToken: paymentToken
    });

    const res3p = await axios.post(`${payment3pApiUrl}/preauth`, {
      cardNumber: cardNumber,
      amount: total
    });

    expect(res3p.status).toBe(200);
    expect(res3p.data.paymentToken).toBe(paymentToken);

    // Validate the token
    mock.onPost(`${paymentApiUrl}/backend/validate`).reply(200, { ok: false });

    const res = await axios.post(`${paymentApiUrl}/backend/validate`, {
      paymentToken: paymentToken,
      total: total + 2000
    }, {
      auth: iamAuth(paymentApiUrl)
    });

    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(false);

    // Cleanup
    mock.onPost(`${payment3pApiUrl}/cancelPayment`).reply(200, {});

    const cleanupRes = await axios.post(`${payment3pApiUrl}/cancelPayment`, {
      paymentToken: paymentToken
    });

    expect(cleanupRes.status).toBe(200);
  });

  it('should not validate payment token without IAM authorization', async () => {
    const cardNumber = "1234567890123456";

    // Create a payment token
    mock.onPost(`${payment3pApiUrl}/preauth`).reply(200, {
      paymentToken: paymentToken
    });

    const res3p = await axios.post(`${payment3pApiUrl}/preauth`, {
      cardNumber: cardNumber,
      amount: total
    });

    expect(res3p.status).toBe(200);
    expect(res3p.data.paymentToken).toBe(paymentToken);

    // Validate the token
    mock.onPost(`${paymentApiUrl}/backend/validate`).reply(403, {
      message: 'Forbidden'
    });

    try {
      await axios.post(`${paymentApiUrl}/backend/validate`, {
        paymentToken: paymentToken,
        total: total
      });
    } catch (error) {
      expect(error.response.status).toBe(403);
      expect(error.response.data.message).toBe('Forbidden');
    }

    // Cleanup
    mock.onPost(`${payment3pApiUrl}/cancelPayment`).reply(200, {});

    const cleanupRes = await axios.post(`${payment3pApiUrl}/cancelPayment`, {
      paymentToken: paymentToken
    });

    expect(cleanupRes.status).toBe(200);
  });

  it('should not validate payment token without total', async () => {
    const cardNumber = "1234567890123456";

    // Create a payment token
    mock.onPost(`${payment3pApiUrl}/preauth`).reply(200, {
      paymentToken: paymentToken
    });

    const res3p = await axios.post(`${payment3pApiUrl}/preauth`, {
      cardNumber: cardNumber,
      amount: total
    });

    expect(res3p.status).toBe(200);
    expect(res3p.data.paymentToken).toBe(paymentToken);

    // Validate the token
    mock.onPost(`${paymentApiUrl}/backend/validate`).reply(400, {
      message: 'Missing total'
    });

    try {
      await axios.post(`${paymentApiUrl}/backend/validate`, {
        paymentToken: paymentToken
      }, {
        auth: iamAuth(paymentApiUrl)
      });
    } catch (error) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.message).toContain('total');
    }

    // Cleanup
    mock.onPost(`${payment3pApiUrl}/cancelPayment`).reply(200, {});

    const cleanupRes = await axios.post(`${payment3pApiUrl}/cancelPayment`, {
      paymentToken: paymentToken
    });

    expect(cleanupRes.status).toBe(200);
  });

  it('should not validate payment token without payment token', async () => {
    const cardNumber = "1234567890123456";

    // Create a payment token
    mock.onPost(`${payment3pApiUrl}/preauth`).reply(200, {
      paymentToken: paymentToken
    });

    const res3p = await axios.post(`${payment3pApiUrl}/preauth`, {
      cardNumber: cardNumber,
      amount: total
    });

    expect(res3p.status).toBe(200);
    expect(res3p.data.paymentToken).toBe(paymentToken);
    // Validate the token
mock.onPost(`${paymentApiUrl}/backend/validate`).reply(400, {
    message: 'Missing paymentToken'
  });
  
  try {
    await axios.post(`${paymentApiUrl}/backend/validate`, {
      total: total
    }, {
      auth: iamAuth(paymentApiUrl)
    });
  } catch (error) {
    expect(error.response.status).toBe(400);
    expect(error.response.data.message).toContain('paymentToken');
  }
  
  // Cleanup
  mock.onPost(`${payment3pApiUrl}/cancelPayment`).reply(200, {});
  
  const cleanupRes = await axios.post(`${payment3pApiUrl}/cancelPayment`, {
    paymentToken: paymentToken
  });
  
  expect(cleanupRes.status).toBe(200);