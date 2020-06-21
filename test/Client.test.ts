import { Client, Message, MessageCommand } from '../src';

describe('Client', () => {
  let client: Client;
  beforeAll(() => {
    client = new Client({
      url: 'ws://localhost:8080/ws',
    });
  });
  it('should be initialized', () => {
    expect(client.connected).toBe(false);
  });
  it('should call open callback', done => {
    client.on('open', () => {
      expect(client.connected).toBe(true);
      done();
    });
  });
  afterAll(() => {
    client.disconnect();
  });
});

describe('subscribe', () => {
  let client: Client;
  beforeAll(async () => {
    client = new Client({
      url: 'ws://localhost:8080/ws',
    });
    await client.wait('open')
  });
  it('should begin with no subscriptions', () => {
    expect(client.callbacks.open).toHaveLength(0)
  })
  let callback: (message: Message) => void
  it('should send publish back to subscription', async (done) => {
    callback = (message: Message) => {
      expect(message.command).toBe(MessageCommand.PUBLISH)
      expect(JSON.parse(message.payload)).toEqual({
        test: 'value'
      })
      done()
    }
    client.subscribe('/topic', callback).then(() => {
      client.publish('/topic', {
        test: 'value'
      })
    });
  });
  it('should unsubscribe', async () => {
    await client.unsubscribe('/topic', callback)
    expect(client.topics.get('/topic')).toHaveLength(0)
  })
});
