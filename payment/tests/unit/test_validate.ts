import { handler, validatePaymentToken } from '../src/validate';
import { APIGatewayEvent, Context } from 'aws-lambda';
import AWSMock from 'aws-sdk-mock';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { v4 as uuidv4 } from 'uuid';

const ENVIRONMENT = 'test';
const API_URL = 'mock://API_URL';

beforeAll(() => {
  process.env.ENVIRONMENT = ENVIRONMENT;
  process.env.API_URL = API_URL;
});

describe('validate tests', () => {
  let paymentToken: string;
  let total: number;

  beforeEach(() => {
    paymentToken = uuidv4();
    total = 3000;
  });

  it('should validate payment token', async () => {
    const mock = new MockAdapter(axios);
    const url = `${API_URL}/check`;

    mock.onPost(url).reply(200, { ok: true });

    const ok = await validatePaymentToken(paymentToken, total);

    expect(mock.history.post.length).toBe(1);
    expect(mock.history.post[0].url).toBe(url);
    expect(ok).toBe(true);

    mock.restore();
  });

  it('should validate payment token with not ok result', async () => {
    const mock = new MockAdapter(axios);
    const url = `${API_URL}/check`;

    mock.onPost(url).reply(200, { ok: false });

    const ok = await validatePaymentToken(paymentToken, total);

    expect(mock.history.post.length).toBe(1);
    expect(mock.history.post[0].url).toBe(url);
    expect(ok).toBe(false);

    mock.restore();
  });

  it('should validate payment token with faulty result', async () => {
    const mock = new MockAdapter(axios);
    const url = `${API_URL}/check`;

    mock.onPost(url).reply(200, { message: 'Something went wrong' });

    const ok = await validatePaymentToken(paymentToken, total);

    expect(mock.history.post.length).toBe(1);
    expect(mock.history.post[0].url).toBe(url);
    expect(ok).toBe(false);

    mock.restore();
  });

  it('should handle event', async () => {
    const mockValidatePaymentToken = jest.fn().mockReturnValue(true);
    jest.mock('../src/validate', () => ({
      validatePaymentToken: mockValidatePaymentToken,
    }));

    const event: APIGatewayEvent = {
      httpMethod: 'POST',
      body: JSON.stringify({
        paymentToken: paymentToken,
        total: total,
      }),
      headers: {},
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      path: '',
      isBase64Encoded: false,
      resource: '',
      requestContext: {} as any,
    };

    const response = await handler(event, {} as Context);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.ok).toBe(true);
  });

  it('should handle event without IAM', async () => {
    const mockValidatePaymentToken = jest.fn();
    jest.mock('../src/validate', () => ({
      validatePaymentToken: mockValidatePaymentToken,
    }));

    const event: APIGatewayEvent = {
      httpMethod: 'POST',
      body: JSON.stringify({
        paymentToken: paymentToken,
        total: total,
      }),
      headers: {},
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      path: '',
      isBase64Encoded: false,
      resource: '',
      requestContext: {} as any,
    };

    const response = await handler(event, {} as Context);

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.message).toBeDefined();
  });

  it('should handle event with faulty body', async () => {
    const mockValidatePaymentToken = jest.fn();
    jest.mock('../src/validate', () => ({
      validatePaymentToken: mockValidatePaymentToken,
    }));

    const event: APIGatewayEvent = {
      httpMethod: 'POST',
      body: JSON.stringify({
        paymentToken: paymentToken,
        total: total,
      }) + '{',
      headers: {},
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      path: '',
      isBase64Encoded: false,
      resource: '',
      requestContext: {} as any,
    };

    const response = await handler(event, {} as Context);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toContain('JSON');
  });

  it('should handle event with missing payment token', async () => {
    const mockValidatePaymentToken = jest.fn();
    jest.mock('../src/validate', () => ({
      validatePaymentToken: mockValidatePaymentToken,
    }));

    const event: APIGatewayEvent = {
      httpMethod: 'POST',
      body: JSON.stringify({
        total: total,
      }),
      headers: {},
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      path: '',
      isBase64Encoded: false,
      resource: '',
      requestContext: {} as any,
    };

    const response = await handler(event, {} as Context);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toContain('paymentToken');
  });

  it('should handle event with missing total', async () => {
    const mockValidatePaymentToken = jest.fn();
    jest.mock('../src/validate', () => ({
      validatePaymentToken: mockValidatePaymentToken,
    }));

    const event: APIGatewayEvent = {
      httpMethod: 'POST',
      body: JSON.stringify({
        paymentToken: paymentToken,
      }),
      headers: {},
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      path: '',
      isBase64Encoded: false,
      resource: '',
      requestContext: {} as any,
    };

    const response = await handler(event, {} as Context);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toContain('total');
  });
});