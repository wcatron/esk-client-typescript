import { Message, MessageCommand } from './Message';
import { uint8ArrayFromBlob } from './utils';

type ClientOptions = {
  url: string;
  clientId?: string;
};

type ClientEventContext = { topic?: string };
type ClientEventCallback = (context: ClientEventContext) => void;
type ClientEvents = 'open' | 'close' | 'suback' | 'unsuback' | 'connack';
type ClientPublishCallback = (message: Message) => void;

export class Client {
  socket: WebSocket;
  connected: boolean = false;
  clientId?: string;
  reconnectInterval?: any;

  constructor({ url, clientId }: ClientOptions) {
    this.clientId = clientId;
    this.socket = this.connect(url)
  }

  private connect(url: string, shouldResubscribe: boolean = false) {
    const socket = new WebSocket(url);
    socket.onopen = () => {
      console.log('client:open');
      this.connected = true;
      const message = new Message({
        command: MessageCommand.CONNECT,
        clientId: this.clientId,
      });
      this.publish(message);
      this.wait('connack', () => {
        if (shouldResubscribe) {
          for (var topic of this.topics.keys()) {
            console.log('client:resubscribe:'+topic)
            this.subscribe(topic, this.cursors.get(topic) || 0)
          }
        }
        this.callbacks['open'].map(value => value({}));
        return true;
      });
    };

    socket.onclose = (event) => {
      console.log(`client:close:${event.code}`)
      this.connected = false;
      // If not a normal closer
      if (event.code !== 1000) {
        this.reconnectInterval = setTimeout(() => {
          console.log('client:close:Reconnecting in 5 seconds...');
          this.socket = this.connect(url, true)
        }, 5000)
      }
      this.callbacks['close'].map(value => value({}));
    };
    
    socket.onerror = (e) => {
      console.log('client:error:', e)
    }

    socket.onmessage = this.onmessage.bind(this);

    return socket;
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
    console.log('client:recieve:', message);
    if (message.topic && message.command === MessageCommand.PUBLISH) {
      const notify = this.topics.get(message.topic) || [];
      notify.forEach(callback => callback(message));
    } else if (message.topic && message.command === MessageCommand.INFORM) {
      const notify = this.topics.get(message.topic) || [];
      this.cursors.set(message.topic, (message.cursor || 0) + message.payload.length)
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
    } else if (message.command === MessageCommand.CONNACK) {
      console.log('client:connack:', message.clientId, ':', this.clientId);
      if (this.clientId && this.clientId !== message.clientId) {
        console.warn("Client ID assigned by server does not match the client's requested clientId.")
      }
      this.clientId = message.clientId;
      this.callbacks['connack'].map(value => value({}));
    }
  }

  callbacks: Record<ClientEvents, ClientEventCallback[]> = {
    open: [],
    close: [],
    suback: [],
    unsuback: [],
    connack: [],
  };
  topics: Map<string, ClientPublishCallback[]> = new Map();
  cursors: Map<string, number> = new Map();

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

  async subscribe(topic: string, cursor: number, callback?: ClientPublishCallback) {
    if (!this.topics.has(topic) && callback) {
      this.topics.set(topic, [callback]);
    } else if (callback) {
      this.topics.get(topic)!.push(callback);
    }
    this.cursors.set(topic, cursor)
    this.publish(
      new Message({
        command: MessageCommand.SUBSCRIBE,
        topic: topic,
        cursor
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
    console.log('client:publish:', topicOrMessage);
    this.socket.send(topicOrMessage.raw);
  }

  disconnect() {
    this.socket.close();
  }
}
