import io = require('@actions/io');
import fs = require('fs');
import os = require('os');
import path = require('path');
import hc = require('@actions/http-client');

const toolDir = path.join(__dirname, 'runner', 'tools');
const tempDir = path.join(__dirname, 'runner', 'temp');

process.env['RUNNER_TOOL_CACHE'] = toolDir;
process.env['RUNNER_TEMP'] = tempDir;
import * as installer from '../src/installer';

const IS_WINDOWS = process.platform === 'win32';

describe('version tests', () => {

  it('Exact normal version', async() => {
    let versInfo = new installer.DotNetVersionInfo('3.1.201');

    expect(versInfo.isExactVersion()).toBe(true);
    expect(versInfo.version()).toBe('3.1.201');
  });

  it('Exact preview version', async() => {
    let versInfo = new installer.DotNetVersionInfo('3.1.201-preview1');

    expect(versInfo.isExactVersion()).toBe(true);
    expect(versInfo.version()).toBe('3.1.201-preview1');
  });

  it('Generic x version', async() => {
    let versInfo = new installer.DotNetVersionInfo('3.1.x');

    expect(versInfo.isExactVersion()).toBe(false);
    expect(versInfo.version()).toBe('3.1');
  });

  it('Generic * version', async() => {
    let versInfo = new installer.DotNetVersionInfo('1.1.*');

    expect(versInfo.isExactVersion()).toBe(false);
    expect(versInfo.version()).toBe('1.1');
  });

  it('Generic -no patch- version', async() => {
    let versInfo = new installer.DotNetVersionInfo('2.0');

    expect(versInfo.isExactVersion()).toBe(false);
    expect(versInfo.version()).toBe('2.0');
  });

  it('Generic -no minor- version', async() => {
    expect(() => {
       new installer.DotNetVersionInfo('2');
    }).toThrow();
  });

  it('empty version', async() => {
    expect(() => {
       new installer.DotNetVersionInfo('');
    }).toThrow();
  });

  it('malformed no patch but dot version', async() => {
    expect(() => {
       new installer.DotNetVersionInfo('1.2.');
    }).toThrow();
  });

  it('malformed generic minor version', async() => {
    expect(() => {
       new installer.DotNetVersionInfo('1.*.2');
    }).toThrow();
  });

  it('malformed generic major version', async() => {
    expect(() => {
       new installer.DotNetVersionInfo('*.2.2');
    }).toThrow();
  });

  it('malformed letter version', async() => {
    expect(() => {
       new installer.DotNetVersionInfo('a.b.c');
    }).toThrow();
  });

  it('malformed letter preview version', async() => {
    expect(() => {
       new installer.DotNetVersionInfo('a.b.c-preview');
    }).toThrow();
  });

  it('malformed letter -no minor- version', async() => {
    expect(() => {
       new installer.DotNetVersionInfo('a.b');
    }).toThrow();
  });
})

describe('installer tests', () => {
  beforeAll(async () => {
    await io.rmRF(toolDir);
    await io.rmRF(tempDir);
  });

  afterAll(async () => {
    try {
      await io.rmRF(toolDir);
      await io.rmRF(tempDir);
    } catch {
      console.log('Failed to remove test directories');
    }
  }, 100000);

  it('Resolving a normal generic version works', async() => {
    const dotnetInstaller = new installer.DotnetCoreInstaller('3.1.x');
    let versInfo = await dotnetInstaller.resolveInfos(["win-x64"],new installer.DotNetVersionInfo('3.1.x'));

    expect(versInfo.resolvedVersion.startsWith('3.1.'));
  }, 100000);

  it('Resolving a nonexistent generic version fails', async() => {
    const dotnetInstaller = new installer.DotnetCoreInstaller('999.1.x');
    try{
      await dotnetInstaller.resolveInfos(["win-x64"],new installer.DotNetVersionInfo('999.1.x'));
      fail();
    } catch {
      expect(true);
    }
  }, 100000);

  it('Resolving a exact version works', async() => {
    const dotnetInstaller = new installer.DotnetCoreInstaller('3.1.201');
    let versInfo = await dotnetInstaller.resolveInfos(["win-x64"],new installer.DotNetVersionInfo('3.1.201'));

    expect(versInfo.resolvedVersion).toBe('3.1.201');
  }, 100000);

  it('Acquires version of dotnet if no matching version is installed', async () => {
    await getDotnet('2.2.205');
    const dotnetDir = path.join(toolDir, 'dncs', '2.2.205', os.arch());

    expect(fs.existsSync(`${dotnetDir}.complete`)).toBe(true);
    if (IS_WINDOWS) {
      expect(fs.existsSync(path.join(dotnetDir, 'dotnet.exe'))).toBe(true);
    } else {
      expect(fs.existsSync(path.join(dotnetDir, 'dotnet'))).toBe(true);
    }
  }, 400000);

  it('Throws if no location contains correct dotnet version', async () => {
    let thrown = false;
    try {
      await getDotnet('1000.0.0');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  }, 100000);

  it('Uses version of dotnet installed in cache', async () => {
    const dotnetDir: string = path.join(toolDir, 'dncs', '250.0.0', os.arch());
    await io.mkdirP(dotnetDir);
    fs.writeFileSync(`${dotnetDir}.complete`, 'hello');
    // This will throw if it doesn't find it in the cache (because no such version exists)
    await getDotnet('250.0.0');
    return;
  });

  it('Doesnt use version of dotnet that was only partially installed in cache', async () => {
    const dotnetDir: string = path.join(toolDir, 'dncs', '251.0.0', os.arch());
    await io.mkdirP(dotnetDir);
    let thrown = false;
    try {
      // This will throw if it doesn't find it in the cache (because no such version exists)
      await getDotnet('251.0.0');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
    return;
  });

  it('Uses an up to date bash download script', async () => {
    const httpCallbackClient = new hc.HttpClient('setup-dotnet-test', [], {
      allowRetries: true,
      maxRetries: 3
    });
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
  }, 100000);

  it('Uses an up to date powershell download script', async () => {
    var httpCallbackClient = new hc.HttpClient('setup-dotnet-test', [], {
      allowRetries: true,
      maxRetries: 3
    });
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
  }, 100000);
});

function normalizeFileContents(contents: string): string {
  return contents
    .trim()
    .replace(new RegExp('\r\n', 'g'), '\n')
    .replace(new RegExp('\r', 'g'), '\n');
}

async function getDotnet(version: string): Promise<void> {
  const dotnetInstaller = new installer.DotnetCoreInstaller(version);
  await dotnetInstaller.installDotnet();
}
