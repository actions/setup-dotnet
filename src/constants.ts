/** NuGet lock file patterns */
export const lockFilePatterns = ['packages.lock.json'];

/**
 * .NET CLI command to list local NuGet resources.
 * @see https://docs.microsoft.com/dotnet/core/tools/dotnet-nuget-locals
 */
export const cliCommand =
  'dotnet nuget locals all --list --force-english-output';

export enum State {
  CachePrimaryKey = 'CACHE_KEY',
  CacheMatchedKey = 'CACHE_RESULT'
}

export enum Outputs {
  CacheHit = 'cache-hit',
  DotnetVersion = 'dotnet-version'
}
