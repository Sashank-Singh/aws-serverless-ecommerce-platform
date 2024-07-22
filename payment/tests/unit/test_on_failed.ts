import { handler, getPaymentToken, deletePaymentToken, cancelPayment } from '../src/on_failed';
import AWSMock from 'aws-sdk-mock';
import { Context } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

const mockContext = {} as Context;
const ENVIRONMENT = 'test';
const TABLE_NAME = 'TABLE_NAME';
const API_URL = 'mock://API_URL';

beforeAll(() => {
  process.env.ENVIRONMENT = ENVIRONMENT;
  process.env.TABLE_NAME = TABLE_NAME;
  process.env.API_URL = API_URL;
  AWSMock.setSDKInstance(require('aws-sdk'));
});

afterAll(() => {
  AWSMock.restore();
});

describe('on_failed tests', () => {
  let orderId: string;
  let paymentToken: string;

  beforeEach(() => {
    orderId = uuidv4();
    paymentToken = uuidv4();
  });

  it('should get payment token', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(null, { Item: { orderId: params.Key.orderId, paymentToken } });
    });

    const response = await getPaymentToken(orderId);
    expect(response).toEqual(paymentToken);

    AWSMock.restore('DynamoDB.DocumentClient');
  });

  it('should get payment token without an item', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(null, {});
    });

    await expect(getPaymentToken(orderId)).rejects.toThrow();

    AWSMock.restore('DynamoDB.DocumentClient');
  });

  it('should delete payment token', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'delete', (params, callback) => {
      callback(null, {});
    });

    await deletePaymentToken(orderId);

    AWSMock.restore('DynamoDB.DocumentClient');
  });

  it('should cancel payment', async () => {
    const mock = new MockAdapter(axios);
    const url = `${API_URL}/cancelPayment`;

    mock.onPost(url).reply(200, { ok: true });

    await cancelPayment(paymentToken);

    expect(mock.history.post.length).toBe(1);
    expect(mock.history.post[0].url).toBe(url);

    mock.restore();
  });

  it('should handle event', async () => {
    const event = {
      source: 'ecommerce.delivery',
      'detail-type': 'DeliveryFailed',
      resources: [orderId],
      detail: {
        orderId: orderId,
        total: 1234
      }
    };

    const getPaymentTokenMock = jest.fn().mockResolvedValue(paymentToken);
    const deletePaymentTokenMock = jest.fn();
    const cancelPaymentMock = jest.fn();

    jest.mock('../src/on_failed', () => ({
      getPaymentToken: getPaymentTokenMock,
      deletePaymentToken: deletePaymentTokenMock,
      cancelPayment: cancelPaymentMock,
    }));

    await handler(event, mockContext);

    expect(getPaymentTokenMock).toHaveBeenCalledWith(orderId);
    expect(cancelPaymentMock).toHaveBeenCalledWith(paymentToken);
    expect(deletePaymentTokenMock).toHaveBeenCalledWith(orderId);

    jest.restoreAllMocks();
  });
});