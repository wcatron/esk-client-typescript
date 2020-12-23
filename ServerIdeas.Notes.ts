import { projection } from './src/Projection'
import { handler } from './src/Handler'
import { Message } from './src/Message'

type NoteParams = {
  id: string;
};
type NoteTransaction = {
  type: 'cursor' | 'add' | 'edit' | 'remove' | 'leave';
  section: number;
  position: number;
  value: string;
  editedBy: string;

};
type NoteProjection = {
  sections: string[],
  locks: Record<string, [number, number]>
};

const parseMessage: (message: Message) => NoteTransaction = (message) => {
  // TODO: Proper schema validation
  const event = JSON.parse(message.payload)
  return event
}

const noteProjection = projection<
  NoteParams,
  NoteProjection
>(
  ['/notes/:id/transactions'],
  '/notes/:id/result',
  (message: Message, {}, state) => {
    const { type, value, position, section, editedBy } = parseMessage(message)
    if (section >= state.sections.length) {
      throw new Error('Section does not exist')
    }
    switch(type) {
      case "add":
        state.sections.splice(section, 0, "")
        state.locks[editedBy] = [section, 0]
        break;
      case "remove":
        state.sections.splice(section, 1)
        break;
      case "edit":
        state.sections[section] = value
        break;
      case "cursor":
        state.locks[editedBy] = [section, position]
        break;
      case "leave":
        delete state.locks[editedBy]
        break;
    }
    return state
  },
  {
    sections: [] as string[],
    locks: {}
  }
);

const requestEdit = handler<NoteParams>(
  ['/notes/:id/transactions/edit'],
  (message: Message, params, { get, publish }) => {
    const { type, section } = parseMessage(message)
    const { locks } = get(noteProjection)
    if (type === 'edit' || type === 'remove') {
      for (const user in locks) {
        if (locks[user][0] === section) {
          throw new Error('Section locked')
        }
      }
      publish('/notes/:id/transactions', message, {
        params
      })
    }
  }
);
