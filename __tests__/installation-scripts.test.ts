import path from 'path';
import fs from 'fs';
import * as hc from '@actions/http-client';

const HTTP_CLIENT_OPTIONS = {allowRetries: true, maxRetries: 10} as const;
const TEST_TIMEOUT = 30000;

describe('Dotnet installation scripts tests', () => {
  it(
    'Uses an up to date bash download script',
    async () => {
      const httpCallbackClient = new hc.HttpClient(
        'setup-dotnet-test',
        [],
        HTTP_CLIENT_OPTIONS
      );
      const response: hc.HttpClientResponse = await httpCallbackClient.get(
        'https://dot.net/v1/dotnet-install.sh'
      );
      expect(response.message.statusCode).toBe(200);
      const upToDateContents: string = await response.readBody();
      const currentContents: string = fs
        .readFileSync(
          path.join(__dirname, '..', 'externals', 'install-dotnet.sh')
        )
        .toString();
      expect(normalizeFileContents(currentContents)).toBe(
        normalizeFileContents(upToDateContents)
      );
    },
    TEST_TIMEOUT
  );

  it(
    'Uses an up to date powershell download script',
    async () => {
      const httpCallbackClient = new hc.HttpClient(
        'setup-dotnet-test',
        [],
        HTTP_CLIENT_OPTIONS
      );
      const response: hc.HttpClientResponse = await httpCallbackClient.get(
        'https://dot.net/v1/dotnet-install.ps1'
      );
      expect(response.message.statusCode).toBe(200);
      const upToDateContents: string = await response.readBody();
      const currentContents: string = fs
        .readFileSync(
          path.join(__dirname, '..', 'externals', 'install-dotnet.ps1')
        )
        .toString();
      expect(normalizeFileContents(currentContents)).toBe(
        normalizeFileContents(upToDateContents)
      );
    },
    TEST_TIMEOUT
  );
});

function normalizeFileContents(contents: string): string {
  return contents
    .trim()
    .replace(new RegExp('\r\n', 'g'), '\n')
    .replace(new RegExp('\r', 'g'), '\n');
}
