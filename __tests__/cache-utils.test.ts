import {jest} from '@jest/globals';

jest.unstable_mockModule('@actions/cache', () => ({
  isFeatureAvailable: jest.fn()
}));
jest.unstable_mockModule('@actions/core', () => ({
  warning: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));
jest.unstable_mockModule('@actions/exec', () => ({
  getExecOutput: jest.fn()
}));

const cache = await import('@actions/cache');
const exec = await import('@actions/exec');
const {getNuGetFolderPath, isCacheFeatureAvailable} =
  await import('../src/cache-utils.js');

describe('cache-utils tests', () => {
  describe('getNuGetFolderPath()', () => {
    it.each([
      [
        `
http-cache: /home/codespace/.local/share/NuGet/v3-cache
global-packages: /var/nuget
temp: /tmp/NuGetScratch
plugins-cache: /home/codespace/.local/share/NuGet/plugins-cache
`,
        {
          'http-cache': '/home/codespace/.local/share/NuGet/v3-cache',
          'global-packages': '/var/nuget',
          temp: '/tmp/NuGetScratch',
          'plugins-cache': '/home/codespace/.local/share/NuGet/plugins-cache'
        }
      ],
      [
        `
  http-cache: /home/codespace/.local/share/NuGet/v3-cache
  global-packages: /var/nuget
  temp: /tmp/NuGetScratch
  plugins-cache: /home/codespace/.local/share/NuGet/plugins-cache
`,
        {
          'http-cache': '/home/codespace/.local/share/NuGet/v3-cache',
          'global-packages': '/var/nuget',
          temp: '/tmp/NuGetScratch',
          'plugins-cache': '/home/codespace/.local/share/NuGet/plugins-cache'
        }
      ],
      [
        `
http-cache: C:\\Users\\user\\AppData\\Local\\NuGet\\v3-cache
global-packages: C:\\Users\\user\\.nuget\\packages\\
temp: C:\\Users\\user\\AppData\\Local\\Temp\\NuGetScratch
plugins-cache: C:\\Users\\user\\AppData\\Local\\NuGet\\plugins-cache
        `,
        {
          'http-cache': 'C:\\Users\\user\\AppData\\Local\\NuGet\\v3-cache',
          'global-packages': 'C:\\Users\\user\\.nuget\\packages\\',
          temp: 'C:\\Users\\user\\AppData\\Local\\Temp\\NuGetScratch',
          'plugins-cache':
            'C:\\Users\\user\\AppData\\Local\\NuGet\\plugins-cache'
        }
      ],
      [
        `
  http-cache: C:\\Users\\user\\AppData\\Local\\NuGet\\v3-cache
  global-packages: C:\\Users\\user\\.nuget\\packages\\
  temp: C:\\Users\\user\\AppData\\Local\\Temp\\NuGetScratch
  plugins-cache: C:\\Users\\user\\AppData\\Local\\NuGet\\plugins-cache
        `,
        {
          'http-cache': 'C:\\Users\\user\\AppData\\Local\\NuGet\\v3-cache',
          'global-packages': 'C:\\Users\\user\\.nuget\\packages\\',
          temp: 'C:\\Users\\user\\AppData\\Local\\Temp\\NuGetScratch',
          'plugins-cache':
            'C:\\Users\\user\\AppData\\Local\\NuGet\\plugins-cache'
        }
      ]
    ])('(stdout: "%s") returns %p', async (stdout, expected) => {
      jest
        .mocked(exec.getExecOutput)
        .mockResolvedValue({stdout, stderr: '', exitCode: 0});
      const pathes = await getNuGetFolderPath();
      expect(pathes).toStrictEqual(expected);
    });

    it.each([
      `
error: An invalid local resource name was provided. Provide one of the following values: http-cache, temp, global-packages, all.
Usage: dotnet nuget locals [arguments] [options]
Arguments:
  Cache Location(s)  Specifies the cache location(s) to list or clear.
<all | http-cache | global-packages | temp>
Options:
  -h|--help               Show help information
  --force-english-output  Forces the application to run using an invariant, English-based culture.
  -c|--clear              Clear the selected local resources or cache location(s).
  -l|--list               List the selected local resources or cache location(s).
      `,
      'bash: dotnet: command not found',
      ''
    ])('(stderr: "%s", exitCode: 1) throws Error', async stderr => {
      jest
        .mocked(exec.getExecOutput)
        .mockResolvedValue({stdout: '', stderr, exitCode: 1});
      await expect(getNuGetFolderPath()).rejects.toThrow();
    });
  });

  describe.each(['', 'https://github.com/', 'https://example.com/'])(
    'isCacheFeatureAvailable()',
    url => {
      // Save & Restore env
      let serverUrlEnv: string | undefined;
      beforeAll(() => (serverUrlEnv = process.env['GITHUB_SERVER_URL']));
      beforeEach(() => (process.env['GITHUB_SERVER_URL'] = url));
      afterEach(() => (process.env['GITHUB_SERVER_URL'] = serverUrlEnv));

      it('returns true when cache.isFeatureAvailable() === true', () => {
        jest.mocked(cache.isFeatureAvailable).mockReturnValue(true);
        expect(isCacheFeatureAvailable()).toBe(true);
      });

      it('returns false when cache.isFeatureAvailable() === false', () => {
        jest.mocked(cache.isFeatureAvailable).mockReturnValue(false);
        expect(isCacheFeatureAvailable()).toBe(false);
      });
    }
  );
});
