import { Message, MessageCommand } from './Message';
import { uint8ArrayFromBlob } from './utils';

type ClientOptions = {
  url: string;
};

type ClientEventContext = { topic?: string };
type ClientEventCallback = (context: ClientEventContext) => void;
type ClientEvents = 'open' | 'close' | 'suback' | 'unsuback';
type ClientPublishCallback = (message: Message) => void;

export class Client {
  socket: WebSocket;
  connected: boolean = false;

  constructor({ url }: ClientOptions) {
    this.socket = new WebSocket(url);
    this.socket.onopen = () => {
      this.connected = true;
      this.callbacks['open'].map(value => value({}));
    };
    this.socket.onclose = () => {
      this.connected = false;
      this.callbacks['close'].map(value => value({}));
    };
    this.socket.onmessage = this.onmessage.bind(this);
  }

  async onmessage(event: MessageEvent) {
    let buffer: ArrayBuffer;
    if ('arrayBuffer' in event.data) {
      buffer = await event.data.arrayBuffer();
    } else {
      buffer = await uint8ArrayFromBlob(event.data);
    }
    const dataArray = new Uint8Array(buffer);
    const message = Message.fromRaw(dataArray);
    if (message.topic && message.command === MessageCommand.PUBLISH) {
      const notify = this.topics.get(message.topic) || [];
      notify.forEach(callback => callback(message));
    } else if (message.topic && message.command === MessageCommand.INFORM) {
      const notify = this.topics.get(message.topic) || [];
      notify.forEach(callback => callback(message));
    } else if (message.topic && message.command === MessageCommand.SUBACK) {
      this.callbacks['suback'].map(value =>
        value({
          topic: message.topic,
        })
      );
    } else if (message.topic && message.command === MessageCommand.UNSUBACK) {
      this.callbacks['unsuback'].map(value =>
        value({
          topic: message.topic,
        })
      );
    }
  }

  callbacks: Record<ClientEvents, ClientEventCallback[]> = {
    open: [],
    close: [],
    suback: [],
    unsuback: [],
  };
  topics: Map<string, ClientPublishCallback[]> = new Map();

  on(event: ClientEvents, callback: ClientEventCallback) {
    return this.callbacks[event].push(callback);
  }

  removeListener(event: ClientEvents, callback: ClientEventCallback) {
    this.callbacks[event] = this.callbacks[event].filter(
      _callback => _callback !== callback
    );
  }

  async wait(
    event: ClientEvents,
    check: (context: ClientEventContext) => boolean = () => true
  ) {
    return new Promise(resolve => {
      const callback = (context: ClientEventContext) => {
        if (check(context)) {
          resolve();
          this.removeListener(event, callback);
        }
      };
      this.on(event, callback);
    });
  }

  async subscribe(topic: string, callback: ClientPublishCallback) {
    if (!this.topics.has(topic)) {
      this.topics.set(topic, [callback]);
    } else {
      this.topics.get(topic)!.push(callback);
    }
    this.publish(
      new Message({
        command: MessageCommand.SUBSCRIBE,
        topic: topic,
      })
    );
    await this.wait('suback', context => {
      return context.topic === topic;
    });
  }
  async unsubscribe(topic: string, callback: ClientPublishCallback) {
    if (this.topics.has(topic)) {
      const callbacks = this.topics.get(topic)!.filter(a => a !== callback);
      this.topics.set(topic, callbacks);
    }
    this.publish(
      new Message({
        command: MessageCommand.UNSUBSCRIBE,
        topic,
      })
    );
    await this.wait('unsuback', context => {
      return context.topic === topic;
    });
  }

  public publish(topic: string, payload: string | any): void;
  public publish(message: Message): void;
  publish(topicOrMessage: string | Message, payload?: string | any) {
    if (typeof topicOrMessage == 'string') {
      if (typeof payload !== 'string') {
        payload = JSON.stringify(payload);
      }
      const message = new Message({
        command: MessageCommand.PUBLISH,
        topic: topicOrMessage,
        payload: payload,
      });
      return this.publish(message);
    }
    this.socket.send(topicOrMessage.raw);
  }

  disconnect() {
    this.socket.close();
  }
}
