import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

interface Gateway {
  server: unknown;
  handleJoinRoom(client: unknown, data: { roomCode: string; nickname: string; appearance?: unknown }): Promise<void>;
  handlePlayerMove(client: unknown, data: { position: [number, number, number]; rotation: number; animation: string }): void;
}

// Actual gateway source, with framework-only fakes: no Nest/DB installation required.
function loadModule(path: string): Record<string, unknown> {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
  } }).outputText;
  runInNewContext(code, { exports, console, require: (id: string) => {
    if (id === '@nestjs/websockets') {
      const decorator = () => () => {};
      return { WebSocketGateway: decorator, WebSocketServer: decorator, SubscribeMessage: decorator,
        ConnectedSocket: decorator, MessageBody: decorator };
    }
    if (id === './avatar-appearance') return loadModule('server/src/rooms/avatar-appearance.ts');
    throw Error(`Unexpected gateway runtime import: ${id}`);
  } });
  return exports;
}
const RoomsGateway = loadModule('server/src/rooms/rooms.gateway.ts').RoomsGateway as new (service: unknown) => Gateway;

const appearance = {
  body: 'female', hairId: 'bob', topId: 'blouse', accessoryId: null,
  hairColor: '#6c4d48', clothingColor: '#75b7da', nickname: 'Draft name',
};
function fixture() {
  const service = { getOrCreateRoom: vi.fn(), getMessages: vi.fn().mockResolvedValue([]) };
  const gateway = new RoomsGateway(service);
  const broadcast = vi.fn();
  gateway.server = { to: vi.fn(() => ({ emit: broadcast })) } as unknown as Gateway['server'];
  const client = (id: string) => {
    const emit = vi.fn(); const peerEmit = vi.fn(); const join = vi.fn();
    return { id, emit, join, to: vi.fn(() => ({ emit: peerEmit })), peerEmit };
  };
  return { service, gateway, client };
}
const socket = (value: ReturnType<ReturnType<typeof fixture>['client']>) => value as unknown as Parameters<Gateway['handleJoinRoom']>[0];

describe('optional join appearance public events', () => {
  it('preserves legacy join, snapshot and movement without adding appearance to movement', async () => {
    const { gateway, service, client } = fixture(); const old = client('old');
    await gateway.handleJoinRoom(socket(old), { roomCode: ' room ', nickname: ' Old ' });
    const legacy = { id: 'old', roomCode: 'room', nickname: 'Old', position: [0, 0, 2], rotation: 0, animation: 'idle' };
    expect(old.emit).toHaveBeenCalledWith('room-joined', { self: legacy, players: [], messages: [] });
    const next = client('next');
    await gateway.handleJoinRoom(socket(next), { roomCode: 'room', nickname: 'Next' });
    expect(next.emit.mock.calls[0][1].players).toEqual([legacy]);
    const move = { position: [1, 0, 2] as [number, number, number], rotation: 1, animation: 'walk' };
    gateway.handlePlayerMove(socket(old), move);
    expect(old.peerEmit).toHaveBeenLastCalledWith('player-moved', { id: 'old', ...move });
    expect(service.getOrCreateRoom).toHaveBeenCalledTimes(2);
  });

  it('projects accepted appearance into self, peer join and subsequent room snapshots', async () => {
    const { gateway, client } = fixture(); const first = client('first');
    await gateway.handleJoinRoom(socket(first), { roomCode: 'room', nickname: 'Canonical', appearance: { ...appearance, path: 'untrusted.glb' } } as Parameters<Gateway['handleJoinRoom']>[1]);
    const expected = { ...appearance };
    expect(first.emit.mock.calls[0][1].self).toMatchObject({ nickname: 'Canonical', appearance: expected });
    expect(first.emit.mock.calls[0][1].self.appearance).toEqual(expected);
    expect(first.peerEmit).toHaveBeenCalledWith('player-joined', expect.objectContaining({ appearance: expected }));
    const second = client('second');
    await gateway.handleJoinRoom(socket(second), { roomCode: 'room', nickname: 'Second' });
    expect(second.emit.mock.calls[0][1].players[0].appearance).toEqual(expected);
  });

  it.each([
    null, {}, { ...appearance, body: 'robot' }, { ...appearance, hairId: 'fade' },
    { ...appearance, topId: 'shirt' }, { ...appearance, accessoryId: 'backpack' },
    { ...appearance, accessoryId: '' }, { ...appearance, accessoryId: undefined },
    { ...appearance, hairColor: 'red' }, { ...appearance, clothingColor: '#ffffff' },
    { ...appearance, nickname: 42 },
  ])('rejects invalid optional appearance without service, join or presence mutation: %j', async invalid => {
    const { gateway, service, client } = fixture(); const first = client('first');
    await gateway.handleJoinRoom(socket(first), { roomCode: 'room', nickname: 'Old' });
    service.getOrCreateRoom.mockClear(); service.getMessages.mockClear(); first.join.mockClear(); first.emit.mockClear(); first.peerEmit.mockClear();
    await gateway.handleJoinRoom(socket(first), { roomCode: 'other', nickname: 'Changed', appearance: invalid } as Parameters<Gateway['handleJoinRoom']>[1]);
    expect(first.emit).toHaveBeenCalledWith('join-error', { message: 'Invalid avatar appearance' });
    expect(first.join).not.toHaveBeenCalled(); expect(first.peerEmit).not.toHaveBeenCalled();
    expect(service.getOrCreateRoom).not.toHaveBeenCalled(); expect(service.getMessages).not.toHaveBeenCalled();
    gateway.handlePlayerMove(socket(first), { position: [1, 0, 2], rotation: 0, animation: 'idle' });
    expect(first.to).toHaveBeenLastCalledWith('room');
  });

  it('does not create presence for a rejected first join', async () => {
    const { gateway, service, client } = fixture(); const rejected = client('rejected');
    await gateway.handleJoinRoom(socket(rejected), { roomCode: 'room', nickname: 'Rejected', appearance: {} });
    gateway.handlePlayerMove(socket(rejected), { position: [1, 0, 2], rotation: 0, animation: 'walk' });
    expect(rejected.join).not.toHaveBeenCalled(); expect(rejected.peerEmit).not.toHaveBeenCalled();
    expect(service.getOrCreateRoom).not.toHaveBeenCalled();
    const accepted = client('accepted');
    await gateway.handleJoinRoom(socket(accepted), { roomCode: 'room', nickname: 'Accepted' });
    expect(accepted.emit.mock.calls[0][1].players).toEqual([]);
  });

  it('accepts every approved body-specific selection and offered palette', async () => {
    const { gateway, client } = fixture();
    const bodies = [
      { body: 'male', hair: ['classic-short', 'fade', 'afro', 'dreads', 'long-tied'], tops: ['tshirt', 'hoodie', 'shirt', 'tank', 'jacket'], accessories: ['round-glasses', 'square-glasses', 'cap', 'headphones', 'backpack'] },
      { body: 'female', hair: ['original', 'bob', 'high-ponytail', 'bun', 'afro'], tops: ['tshirt', 'hoodie', 'blouse', 'tank', 'jacket'], accessories: ['glasses', 'cap', 'headphones', 'earrings', 'handbag'] },
    ];
    const hairColors = ['#6c4d48', '#af6d63', '#e5ad58', '#353849', '#c77daa'];
    const clothingColors = ['#5b4f96', '#75b7da', '#f2c85c', '#efa5ae', '#7eba8b', '#f4e6d2'];
    for (const body of bodies) for (let i = 0; i < 6; i++) {
      const peer = client(`${body.body}-${i}`);
      const value = { ...appearance, body: body.body, hairId: body.hair[i % 5], topId: body.tops[i % 5], accessoryId: i === 5 ? null : body.accessories[i], hairColor: hairColors[i % 5], clothingColor: clothingColors[i] };
      await gateway.handleJoinRoom(socket(peer), { roomCode: 'room', nickname: 'Peer', appearance: value } as Parameters<Gateway['handleJoinRoom']>[1]);
      expect(peer.emit.mock.calls[0][1].self.appearance).toEqual(value);
    }
  });
});
