import {DotnetVersionResolver} from '../src/installer';
import * as hc from '@actions/http-client';
import * as core from '@actions/core';

// Mock http-client
jest.mock('@actions/http-client');

describe('DotnetVersionResolver with latest', () => {
  let getJsonMock: jest.Mock;
  let warningSpy: jest.SpyInstance;

  beforeEach(() => {
    getJsonMock = jest.fn();
    (hc.HttpClient as any).mockImplementation(() => {
      return {
        getJson: getJsonMock
      };
    });
    warningSpy = jest.spyOn(core, 'warning').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  const mockReleases = {
    'releases-index': [
      {
        'channel-version': '10.0',
        'support-phase': 'preview',
        'release-type': 'lts'
      },
      {
        'channel-version': '9.0',
        'support-phase': 'active',
        'release-type': 'sts'
      },
      {
        'channel-version': '8.0',
        'support-phase': 'active',
        'release-type': 'lts'
      },
      {
        'channel-version': '7.0',
        'support-phase': 'eol',
        'release-type': 'sts'
      }
    ]
  };

  it('should resolve "latest" to highest stable version by default', async () => {
    getJsonMock.mockResolvedValue({result: mockReleases});

    const resolver = new DotnetVersionResolver('latest');
    const version = await resolver.createDotnetVersion();

    expect(version.value).toBe('9.0');
    expect(version.type.toLowerCase()).toContain('channel');
    expect(version.qualityFlag).toBe(true);
  });

  it('should resolve "LATEST" (uppercase) to highest stable version', async () => {
    getJsonMock.mockResolvedValue({result: mockReleases});

    const resolver = new DotnetVersionResolver('LATEST');
    const version = await resolver.createDotnetVersion();

    expect(version.value).toBe('9.0');
    expect(version.type.toLowerCase()).toContain('channel');
    expect(version.qualityFlag).toBe(true);
  });

  it('should resolve "latest" to highest preview version if quality is preview', async () => {
    getJsonMock.mockResolvedValue({result: mockReleases});

    const resolver = new DotnetVersionResolver('latest', 'preview');
    const version = await resolver.createDotnetVersion();

    expect(version.value).toBe('10.0');
  });

  it('should resolve "latest" with channel filter LTS', async () => {
    getJsonMock.mockResolvedValue({result: mockReleases});

    const resolver = new DotnetVersionResolver('latest', '', 'LTS');
    const version = await resolver.createDotnetVersion();

    expect(version.value).toBe('8.0');
  });

  it('should resolve "latest" with channel filter STS', async () => {
    getJsonMock.mockResolvedValue({result: mockReleases});

    const resolver = new DotnetVersionResolver('latest', '', 'STS');
    const version = await resolver.createDotnetVersion();

    expect(version.value).toBe('9.0');
  });

  it('should resolve "latest" with channel filter STS and preview quality', async () => {
    getJsonMock.mockResolvedValue({result: mockReleases});

    const resolver = new DotnetVersionResolver('latest', 'preview', 'STS');
    const version = await resolver.createDotnetVersion();

    // preview quality includes all support-phases; STS filter → 9.0 (active, sts)
    expect(version.value).toBe('9.0');
  });

  it('should warn if channel is provided but version is not latest', async () => {
    getJsonMock.mockResolvedValue({result: mockReleases});

    const resolver = new DotnetVersionResolver('8.0', '', 'LTS');
    await resolver.createDotnetVersion();

    expect(warningSpy).toHaveBeenCalledWith(
      `The 'dotnet-channel' input is only supported when 'dotnet-version' is set to 'latest'.`
    );
  });

  it('should throw when releases-index API returns empty active releases', async () => {
    const emptyReleases = {
      'releases-index': [
        {
          'channel-version': '7.0',
          'support-phase': 'eol',
          'release-type': 'sts'
        }
      ]
    };
    getJsonMock.mockResolvedValue({result: emptyReleases});

    const resolver = new DotnetVersionResolver('latest');

    await expect(resolver.createDotnetVersion()).rejects.toThrow(
      /Could not find any active releases/
    );
  });

  it('should throw when releases-index response has unexpected format', async () => {
    getJsonMock.mockResolvedValue({result: {}});

    const resolver = new DotnetVersionResolver('latest');

    await expect(resolver.createDotnetVersion()).rejects.toThrow(
      /Unexpected response format/
    );
  });

  it('should throw when releases-index response is null', async () => {
    getJsonMock.mockResolvedValue({result: null});

    const resolver = new DotnetVersionResolver('latest');

    await expect(resolver.createDotnetVersion()).rejects.toThrow(
      /Unexpected response format/
    );
  });

  it('should resolve "latest" with ga quality same as default (no previews)', async () => {
    getJsonMock.mockResolvedValue({result: mockReleases});

    const resolver = new DotnetVersionResolver('latest', 'ga');
    const version = await resolver.createDotnetVersion();

    // ga should behave like no quality — skip preview (10.0), pick 9.0
    expect(version.value).toBe('9.0');
  });

  it('should resolve "latest" with LTS channel and daily quality', async () => {
    getJsonMock.mockResolvedValue({result: mockReleases});

    const resolver = new DotnetVersionResolver('latest', 'daily', 'LTS');
    const version = await resolver.createDotnetVersion();

    // daily allows previews, LTS filter applies — 10.0 (preview, lts) is the highest LTS
    expect(version.value).toBe('10.0');
    expect(version.qualityFlag).toBe(true);
  });

  it('should resolve "latest" with A.B channel directly without API call', async () => {
    const resolver = new DotnetVersionResolver('latest', '', '8.0');
    const version = await resolver.createDotnetVersion();

    expect(version.value).toBe('8.0');
    expect(version.type.toLowerCase()).toContain('channel');
    expect(version.qualityFlag).toBe(true);
    // Should NOT call the API
    expect(getJsonMock).not.toHaveBeenCalled();
  });

  it('should resolve "latest" with A.B.Cxx channel directly without API call', async () => {
    const resolver = new DotnetVersionResolver('latest', '', '8.0.1xx');
    const version = await resolver.createDotnetVersion();

    expect(version.value).toBe('8.0.1xx');
    expect(version.type.toLowerCase()).toContain('channel');
    expect(version.qualityFlag).toBe(true);
    // Should NOT call the API
    expect(getJsonMock).not.toHaveBeenCalled();
  });

  it('should resolve "latest" with A.B channel for older version with qualityFlag false', async () => {
    const resolver = new DotnetVersionResolver('latest', '', '3.1');
    const version = await resolver.createDotnetVersion();

    expect(version.value).toBe('3.1');
    expect(version.type.toLowerCase()).toContain('channel');
    // major 3 < 6 → qualityFlag false
    expect(version.qualityFlag).toBe(false);
    expect(getJsonMock).not.toHaveBeenCalled();
  });

  it('should resolve "latest" with A.B.Cxx channel and quality', async () => {
    const resolver = new DotnetVersionResolver('latest', 'ga', '8.0.2xx');
    const version = await resolver.createDotnetVersion();

    expect(version.value).toBe('8.0.2xx');
    expect(version.qualityFlag).toBe(true);
    expect(getJsonMock).not.toHaveBeenCalled();
  });
});
