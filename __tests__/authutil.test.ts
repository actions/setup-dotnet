import io = require('@actions/io');
import fs = require('fs');
import path = require('path');

const fakeSourcesDirForTesting = path.join(
  __dirname,
  'runner',
  path.join(
    Math.random()
      .toString(36)
      .substring(7)
  ),
  's'
);

const invalidNuGetConfig: string = `<?xml version="1.0" encoding="utf-8"?>`;

const emptyNuGetConfig: string = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
</configuration>`;

const nugetorgNuGetConfig: string = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
  </packageSources>
</configuration>`;

const gprnugetorgNuGetConfig: string = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="GPR" value="https://nuget.pkg.github.com/OwnerName/index.json" protocolVersion="3" />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
  </packageSources>
</configuration>`;

const gprNuGetConfig: string = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="GPR" value="https://nuget.pkg.github.com/OwnerName/index.json" protocolVersion="3" />
  </packageSources>
</configuration>`;

const twogprNuGetConfig: string = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="GPR-GitHub" value="https://nuget.pkg.github.com/OwnerName/index.json" protocolVersion="3" />
    <add key="GPR-Actions" value="https://nuget.pkg.github.com/actions/index.json" protocolVersion="3" />
  </packageSources>
</configuration>`;

const spaceNuGetConfig: string = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="GPR GitHub" value="https://nuget.pkg.github.com/OwnerName/index.json" protocolVersion="3" />
  </packageSources>
</configuration>`;

const azureartifactsNuGetConfig: string = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="AzureArtifacts" value="https://pkgs.dev.azure.com/amullans/_packaging/GitHubBuilds/nuget/v3/index.json" protocolVersion="3" />
  </packageSources>
</configuration>`;

const azureartifactsnugetorgNuGetConfig: string = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="AzureArtifacts" value="https://pkgs.dev.azure.com/amullans/_packaging/GitHubBuilds/nuget/v3/index.json" protocolVersion="3" />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
  </packageSources>
</configuration>`;

// We want a NuGet.config one level above the sources directory, so it doesn't trample a user's NuGet.config but is still picked up by NuGet/dotnet.
const nugetConfigFile = path.join(fakeSourcesDirForTesting, '../nuget.config');

process.env['GITHUB_REPOSITORY'] = 'OwnerName/repo';
import * as auth from '../src/authutil';

describe('authutil tests', () => {
  beforeEach(async () => {
    await io.rmRF(fakeSourcesDirForTesting);
    await io.mkdirP(fakeSourcesDirForTesting);
  }, 100000);

  beforeEach(() => {
    if (fs.existsSync(nugetConfigFile)) {
      fs.unlinkSync(nugetConfigFile);
    }
    process.env['INPUT_OWNER'] = '';
    process.env['NUGET_AUTH_TOKEN'] = '';
  });

  it('No existing config, sets up a full NuGet.config with URL and user/PAT for GPR', async () => {
    process.env['NUGET_AUTH_TOKEN'] = 'TEST_FAKE_AUTH_TOKEN';
    await auth.configAuthentication(
      'https://nuget.pkg.github.com/OwnerName/index.json',
      '',
      fakeSourcesDirForTesting
    );
    expect(fs.existsSync(nugetConfigFile)).toBe(true);
    expect(
      fs.readFileSync(nugetConfigFile, {encoding: 'utf8'})
    ).toMatchSnapshot();
  });

  it('No existing config, auth token environment variable not provided, throws', async () => {
    let thrown = false;
    try {
      await auth.configAuthentication(
        'https://nuget.pkg.github.com/OwnerName/index.json',
        '',
        fakeSourcesDirForTesting
      );
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });

  it('No existing config, sets up a full NuGet.config with URL and other owner/PAT for GPR', async () => {
    process.env['NUGET_AUTH_TOKEN'] = 'TEST_FAKE_AUTH_TOKEN';
    process.env['INPUT_OWNER'] = 'otherorg';
    await auth.configAuthentication(
      'https://nuget.pkg.github.com/otherorg/index.json',
      '',
      fakeSourcesDirForTesting
    );
    expect(fs.existsSync(nugetConfigFile)).toBe(true);
    expect(
      fs.readFileSync(nugetConfigFile, {encoding: 'utf8'})
    ).toMatchSnapshot();
  });

  it('Existing config (invalid), tries to parse an invalid NuGet.config and throws', async () => {
    process.env['NUGET_AUTH_TOKEN'] = 'TEST_FAKE_AUTH_TOKEN';
    const inputNuGetConfigPath: string = path.join(
      fakeSourcesDirForTesting,
      'nuget.config'
    );
    fs.writeFileSync(inputNuGetConfigPath, invalidNuGetConfig);
    let thrown = false;
    try {
      await auth.configAuthentication(
        'https://nuget.pkg.github.com/OwnerName/index.json',
        '',
        fakeSourcesDirForTesting
      );
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });

  it('Existing config w/ no sources, sets up a full NuGet.config with URL and user/PAT for GPR', async () => {
    process.env['NUGET_AUTH_TOKEN'] = 'TEST_FAKE_AUTH_TOKEN';
    const inputNuGetConfigPath: string = path.join(
      fakeSourcesDirForTesting,
      'nuget.config'
    );
    fs.writeFileSync(inputNuGetConfigPath, emptyNuGetConfig);
    await auth.configAuthentication(
      'https://nuget.pkg.github.com/OwnerName/index.json',
      '',
      fakeSourcesDirForTesting
    );
    expect(fs.existsSync(nugetConfigFile)).toBe(true);
    expect(
      fs.readFileSync(nugetConfigFile, {encoding: 'utf8'})
    ).toMatchSnapshot();
  });

  it('Existing config w/ no GPR sources, sets up a full NuGet.config with URL and user/PAT for GPR', async () => {
    process.env['NUGET_AUTH_TOKEN'] = 'TEST_FAKE_AUTH_TOKEN';
    const inputNuGetConfigPath: string = path.join(
      fakeSourcesDirForTesting,
      'nuget.config'
    );
    fs.writeFileSync(inputNuGetConfigPath, nugetorgNuGetConfig);
    await auth.configAuthentication(
      'https://nuget.pkg.github.com/OwnerName/index.json',
      '',
      fakeSourcesDirForTesting
    );
    expect(fs.existsSync(nugetConfigFile)).toBe(true);
    expect(
      fs.readFileSync(nugetConfigFile, {encoding: 'utf8'})
    ).toMatchSnapshot();
  });

  it('Existing config w/ only GPR source, sets up a partial NuGet.config user/PAT for GPR', async () => {
    process.env['NUGET_AUTH_TOKEN'] = 'TEST_FAKE_AUTH_TOKEN';
    const inputNuGetConfigPath: string = path.join(
      fakeSourcesDirForTesting,
      'nuget.config'
    );
    fs.writeFileSync(inputNuGetConfigPath, gprNuGetConfig);
    await auth.configAuthentication(
      'https://nuget.pkg.github.com/OwnerName/index.json',
      '',
      fakeSourcesDirForTesting
    );
    expect(fs.existsSync(nugetConfigFile)).toBe(true);
    expect(
      fs.readFileSync(nugetConfigFile, {encoding: 'utf8'})
    ).toMatchSnapshot();
  });

  it('Existing config w/ GPR source and NuGet.org, sets up a partial NuGet.config user/PAT for GPR', async () => {
    process.env['NUGET_AUTH_TOKEN'] = 'TEST_FAKE_AUTH_TOKEN';
    const inputNuGetConfigPath: string = path.join(
      fakeSourcesDirForTesting,
      'nuget.config'
    );
    fs.writeFileSync(inputNuGetConfigPath, gprnugetorgNuGetConfig);
    await auth.configAuthentication(
      'https://nuget.pkg.github.com/OwnerName/index.json',
      '',
      fakeSourcesDirForTesting
    );
    expect(fs.existsSync(nugetConfigFile)).toBe(true);
    expect(
      fs.readFileSync(nugetConfigFile, {encoding: 'utf8'})
    ).toMatchSnapshot();
  });

  it('Existing config w/ two GPR sources, sets up a partial NuGet.config user/PAT for GPR', async () => {
    process.env['NUGET_AUTH_TOKEN'] = 'TEST_FAKE_AUTH_TOKEN';
    const inputNuGetConfigPath: string = path.join(
      fakeSourcesDirForTesting,
      'nuget.config'
    );
    fs.writeFileSync(inputNuGetConfigPath, twogprNuGetConfig);
    await auth.configAuthentication(
      'https://nuget.pkg.github.com',
      '',
      fakeSourcesDirForTesting
    );
    expect(fs.existsSync(nugetConfigFile)).toBe(true);
    expect(
      fs.readFileSync(nugetConfigFile, {encoding: 'utf8'})
    ).toMatchSnapshot();
  });

  it('Existing config w/ spaces in key, throws for now', async () => {
    process.env['NUGET_AUTH_TOKEN'] = 'TEST_FAKE_AUTH_TOKEN';
    const inputNuGetConfigPath: string = path.join(
      fakeSourcesDirForTesting,
      'nuget.config'
    );
    fs.writeFileSync(inputNuGetConfigPath, spaceNuGetConfig);
    let thrown = false;
    try {
      await auth.configAuthentication(
        'https://nuget.pkg.github.com/OwnerName/index.json',
        '',
        fakeSourcesDirForTesting
      );
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });

  it('Existing config not in repo root, sets up a partial NuGet.config user/PAT for GPR', async () => {
    process.env['NUGET_AUTH_TOKEN'] = 'TEST_FAKE_AUTH_TOKEN';
    const inputNuGetConfigDirectory: string = path.join(
      fakeSourcesDirForTesting,
      'subfolder'
    );
    const inputNuGetConfigPath: string = path.join(
      inputNuGetConfigDirectory,
      'nuget.config'
    );
    fs.mkdirSync(inputNuGetConfigDirectory, {recursive: true});
    fs.writeFileSync(inputNuGetConfigPath, gprNuGetConfig);
    await auth.configAuthentication(
      'https://nuget.pkg.github.com/OwnerName/index.json',
      'subfolder/nuget.config',
      fakeSourcesDirForTesting
    );
    expect(fs.existsSync(nugetConfigFile)).toBe(true);
    expect(
      fs.readFileSync(nugetConfigFile, {encoding: 'utf8'})
    ).toMatchSnapshot();
  });

  it('Existing config w/ only Azure Artifacts source, sets up a partial NuGet.config user/PAT for GPR', async () => {
    process.env['NUGET_AUTH_TOKEN'] = 'TEST_FAKE_AUTH_TOKEN';
    const inputNuGetConfigPath: string = path.join(
      fakeSourcesDirForTesting,
      'nuget.config'
    );
    fs.writeFileSync(inputNuGetConfigPath, azureartifactsNuGetConfig);
    await auth.configAuthentication(
      'https://pkgs.dev.azure.com/amullans/_packaging/GitHubBuilds/nuget/v3/index.json',
      '',
      fakeSourcesDirForTesting
    );
    expect(fs.existsSync(nugetConfigFile)).toBe(true);
    expect(
      fs.readFileSync(nugetConfigFile, {encoding: 'utf8'})
    ).toMatchSnapshot();
  });

  it('Existing config w/ Azure Artifacts source and NuGet.org, sets up a partial NuGet.config user/PAT for GPR', async () => {
    process.env['NUGET_AUTH_TOKEN'] = 'TEST_FAKE_AUTH_TOKEN';
    const inputNuGetConfigPath: string = path.join(
      fakeSourcesDirForTesting,
      'nuget.config'
    );
    fs.writeFileSync(inputNuGetConfigPath, azureartifactsnugetorgNuGetConfig);
    await auth.configAuthentication(
      'https://pkgs.dev.azure.com/amullans/_packaging/GitHubBuilds/nuget/v3/index.json',
      '',
      fakeSourcesDirForTesting
    );
    expect(fs.existsSync(nugetConfigFile)).toBe(true);
    expect(
      fs.readFileSync(nugetConfigFile, {encoding: 'utf8'})
    ).toMatchSnapshot();
  });

  it('No existing config, sets up a full NuGet.config with URL and token for other source', async () => {
    process.env['NUGET_AUTH_TOKEN'] = 'TEST_FAKE_AUTH_TOKEN';
    await auth.configAuthentication(
      'https://pkgs.dev.azure.com/amullans/_packaging/GitHubBuilds/nuget/v3/index.json',
      '',
      fakeSourcesDirForTesting
    );
    expect(fs.existsSync(nugetConfigFile)).toBe(true);
    expect(
      fs.readFileSync(nugetConfigFile, {encoding: 'utf8'})
    ).toMatchSnapshot();
  });
});
