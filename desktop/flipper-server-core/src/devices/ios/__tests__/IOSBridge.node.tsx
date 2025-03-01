/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import childProcess from 'child_process';
jest.mock('child_process');
jest.mock('promisify-child-process');

import {makeIOSBridge} from '../IOSBridge';
import * as promisifyChildProcess from 'promisify-child-process';
import {setFlipperServerConfig} from '../../../FlipperServerConfig';
// eslint-disable-next-line node/no-extraneous-import
import {getRenderHostInstance} from 'flipper-ui-core';

beforeEach(() => {
  setFlipperServerConfig(getRenderHostInstance().serverConfig);
});

afterEach(() => {
  setFlipperServerConfig(undefined);
});

test('uses xcrun with no idb when xcode is detected', async () => {
  const ib = await makeIOSBridge('', true);

  ib.startLogListener('deadbeef', 'emulator');

  expect(childProcess.spawn).toHaveBeenCalledWith(
    'xcrun',
    [
      'simctl',
      'spawn',
      'deadbeef',
      'log',
      'stream',
      '--style',
      'json',
      '--predicate',
      'senderImagePath contains "Containers"',
      '--debug',
      '--info',
    ],
    {},
  );
});

test('uses idb when present and xcode detected', async () => {
  const ib = await makeIOSBridge('/usr/local/bin/idb', true, async (_) => true);

  ib.startLogListener('deadbeef', 'emulator');

  expect(childProcess.spawn).toHaveBeenCalledWith(
    '/usr/local/bin/idb',
    [
      'log',
      '--udid',
      'deadbeef',
      '--',
      '--style',
      'json',
      '--predicate',
      'senderImagePath contains "Containers"',
      '--debug',
      '--info',
    ],
    {
      env: {
        PYTHONUNBUFFERED: '1',
      },
    },
  );
});

test('uses idb when present and xcode detected and physical device connected', async () => {
  const ib = await makeIOSBridge('/usr/local/bin/idb', true, async (_) => true);

  ib.startLogListener('deadbeef', 'physical');

  expect(childProcess.spawn).toHaveBeenCalledWith(
    '/usr/local/bin/idb',
    [
      'log',
      '--udid',
      'deadbeef',
      '--',
      // no further args; not supported by idb atm
    ],
    {
      env: {
        PYTHONUNBUFFERED: '1',
      },
    },
  );
});

test("without idb physical devices can't log", async () => {
  const ib = await makeIOSBridge('', true);
  expect(ib.startLogListener).toBeDefined(); // since we have xcode
});

test('throws if no iOS support', async () => {
  await expect(makeIOSBridge('', false)).rejects.toThrow(
    'Neither Xcode nor idb available. Cannot provide iOS device functionality.',
  );
});

test.unix(
  'uses xcrun to take screenshots with no idb when xcode is detected',
  async () => {
    const ib = await makeIOSBridge('', true);

    await expect(() => ib.screenshot('deadbeef')).rejects.toThrow();

    expect((promisifyChildProcess.exec as any).mock.calls[0][0]).toMatch(
      'xcrun simctl io deadbeef screenshot',
    );
  },
);

test.unix('uses idb to take screenshots when available', async () => {
  const ib = await makeIOSBridge('/usr/local/bin/idb', true, async (_) => true);

  await expect(() => ib.screenshot('deadbeef')).rejects.toThrow();

  expect((promisifyChildProcess.exec as any).mock.calls[0][0]).toMatch(
    'idb screenshot --udid deadbeef ',
  );
});

test('uses xcrun to navigate with no idb when xcode is detected', async () => {
  const ib = await makeIOSBridge('', true);

  await ib.navigate('deadbeef', 'fb://dummy');

  expect(promisifyChildProcess.exec).toHaveBeenCalledWith(
    'xcrun simctl io deadbeef launch url "fb://dummy"',
  );
});

test('uses idb to navigate when available', async () => {
  const ib = await makeIOSBridge('/usr/local/bin/idb', true, async (_) => true);

  await ib.navigate('deadbeef', 'fb://dummy');

  expect(promisifyChildProcess.exec).toHaveBeenCalledWith(
    'idb open --udid deadbeef "fb://dummy"',
  );
});

test('uses xcrun to record with no idb when xcode is detected', async () => {
  const ib = await makeIOSBridge('', true);

  ib.recordVideo('deadbeef', '/tmp/video.mp4');

  expect(promisifyChildProcess.exec).toHaveBeenCalledWith(
    'xcrun simctl io deadbeef recordVideo --codec=h264 --force /tmp/video.mp4',
  );
});

test('uses idb to record when available', async () => {
  const ib = await makeIOSBridge('/usr/local/bin/idb', true, async (_) => true);

  ib.recordVideo('deadbeef', '/tmo/video.mp4');

  expect(promisifyChildProcess.exec).toHaveBeenCalledWith(
    'idb record-video --udid deadbeef /tmo/video.mp4',
  );
});
