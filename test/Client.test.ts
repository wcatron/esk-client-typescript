import { Client, Message, MessageCommand } from '../src';
import MockWebSocket from 'jest-websocket-mock';

const url = 'ws://localhost:8080/ws';

describe('Client', () => {
  let server: MockWebSocket;
  let client: Client;
  beforeAll(() => {
    server = new MockWebSocket(url);
    client = new Client({
      url,
    });
  });
  it('should be initialized', () => {
    expect(client.connected).toBe(false);
  });
  it('should call open callback', async () => {
    await server.connected;
    await expect(server).toReceiveMessage(Buffer.from([1, 2]));
  });
  it('should be connected', () => {
    expect(client.connected).toBe(true);
  });
  afterAll(() => {
    client.disconnect();
    MockWebSocket.clean();
  });
});

xdescribe('subscribe', () => {
  let server: MockWebSocket;
  let client: Client;
  beforeAll(async () => {
    server = new MockWebSocket(url);
    client = new Client({
      url,
    });
    //await client.wait('open');
    await server.connected;
  });
  it('should begin with no subscriptions', () => {
    expect(client.callbacks.open).toHaveLength(0);
  });
  let callback: (message: Message) => void;
  it('should send inform back to subscription', async done => {
    callback = (message: Message) => {
      expect(message.command).toBe(MessageCommand.INFORM);
      expect(JSON.parse(message.payload)).toEqual({
        test: 'value',
      });
      done();
    };
    client.subscribe(client.clientId + '/test', 0, callback).then(() => {
      client.publish(client.clientId + '/test', {
        test: 'value',
      });
    });
  });
  it('should unsubscribe', async () => {
    await client.unsubscribe(client.clientId + '/test', callback);
    expect(client.topics.get(client.clientId + '/test')).toHaveLength(0);
  });
  afterAll(() => {
    client.disconnect();
    MockWebSocket.clean();
  });
});
