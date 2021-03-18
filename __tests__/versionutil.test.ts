import each from 'jest-each';
import * as installer from '../src/installer';

describe('version tests', () => {
  each(['3.1.999', '3.1.101-preview.3']).test(
    "Exact version '%s' should be the same",
    vers => {
      let versInfo = new installer.DotNetVersionInfo(vers);

      expect(versInfo.isExactVersion()).toBe(true);
      expect(versInfo.version()).toBe(vers);
    }
  );

  each([
    ['3.x', '3.x'],
    ['3.*', '3.*'],
    ['3.1.x', '3.1'],
    ['1.1.*', '1.1'],
    ['2.0', '2.0']
  ]).test("Generic version '%s' should be '%s'", (vers, resVers) => {
    let versInfo = new installer.DotNetVersionInfo(vers);

    expect(versInfo.isExactVersion()).toBe(false);
    expect(versInfo.version()).toBe(resVers);
  });

  each([
    '',
    '.',
    '..',
    ' . ',
    '. ',
    ' .',
    ' . . ',
    ' .. ',
    ' .  ',
    '-1.-1',
    '-1',
    '-1.-1.-1',
    '..3',
    '1..3',
    '1..',
    '.2.3',
    '.2.x',
    '1',
    '*.*.1',
    '*.1',
    '*.',
    '1.2.',
    '1.2.-abc',
    'a.b',
    'a.b.c',
    'a.b.c-preview',
    ' 0 . 1 . 2 '
  ]).test("Malformed version '%s' should throw", vers => {
    expect(() => new installer.DotNetVersionInfo(vers)).toThrow();
  });

  each([
    ['3.1.x', '3.1.'],
    ['3.1.*', '3.1.'],
    ['3.1', '3.1.'],
    ['5.0.0-preview.6', '5.0.0-preview.6'],
    ['3.1.201', '3.1.201']
  ]).test(
    "Resolving version '%s' as '%s'",
    async (input, expectedVersion) => {
      const dotnetInstaller = new installer.DotnetCoreInstaller(input);
      let versInfo = await dotnetInstaller.resolveVersion(
        new installer.DotNetVersionInfo(input)
      );
      console.log(versInfo);

      expect(versInfo.startsWith(expectedVersion));
    },
    100000
  );

  it('Resolving a nonexistent generic version fails', async () => {
    const dotnetInstaller = new installer.DotnetCoreInstaller('999.1.x');
    try {
      await dotnetInstaller.resolveVersion(
        new installer.DotNetVersionInfo('999.1.x')
      );
      fail();
    } catch {
      expect(true);
    }
  }, 100000);
});
