import msbuildFile from '../.github/msbuild.json';
describe('msbuild tests', () => {
  test('regular expression in msbuild.json is valid', async () => {
    const regexPattern =
      msbuildFile['problemMatcher'][0]['pattern'][0]['regexp'];
    const regexResultsMap = msbuildFile['problemMatcher'][0]['pattern'][0];

    const regex = new RegExp(regexPattern);

    const stringsToMatch = [
      "/Users/zacharyeisinger/Documents/repo/setup-dotnet/__tests__/sample-broken-csproj/sample.csproj : warning NU1904: Package 'System.Text.Encodings.Web' 4.7.0 has a known critical severity vulnerability, https://github.com/advisories/GHSA-ghhp-997w-qr28 [/Users/zacharyeisinger/Documents/repo/setup-dotnet/__tests__/sample-broken-csproj/sample.csproj]",
      "/Users/zacharyeisinger/Documents/repo/setup-dotnet/__tests__/sample-broken-csproj/sample.csproj : error NU1904: Package 'System.Text.Encodings.Web' 4.7.0 has a known critical severity vulnerability, https://github.com/advisories/GHSA-ghhp-997w-qr28 [/Users/zacharyeisinger/Documents/repo/setup-dotnet/__tests__/sample-broken-csproj/sample.csproj]"
    ];
    // Expected results are calculated according to the msbuild matcher located in msbuild.json file
    const expectedResults = [
      {
        file: '/Users/zacharyeisinger/Documents/repo/setup-dotnet/__tests__/sample-broken-csproj/sample.csproj',
        severity: 'warning',
        code: 'NU1904',
        message:
          "Package 'System.Text.Encodings.Web' 4.7.0 has a known critical severity vulnerability, https://github.com/advisories/GHSA-ghhp-997w-qr28",
        fromPath:
          '/Users/zacharyeisinger/Documents/repo/setup-dotnet/__tests__/sample-broken-csproj/sample.csproj'
      },
      {
        file: '/Users/zacharyeisinger/Documents/repo/setup-dotnet/__tests__/sample-broken-csproj/sample.csproj',
        severity: 'error',
        code: 'NU1904',
        message:
          "Package 'System.Text.Encodings.Web' 4.7.0 has a known critical severity vulnerability, https://github.com/advisories/GHSA-ghhp-997w-qr28",
        fromPath:
          '/Users/zacharyeisinger/Documents/repo/setup-dotnet/__tests__/sample-broken-csproj/sample.csproj'
      }
    ];

    stringsToMatch.map((string, index) => {
      const matchedResultsArray = string.match(regex);
      for (const propName in expectedResults[index]) {
        const propertyIndex = regexResultsMap[propName];
        const expectedPropValue = expectedResults[index][propName];
        const matchedPropValue = matchedResultsArray![propertyIndex];
        expect(matchedPropValue).toEqual(expectedPropValue);
      }
    });
  }, 10000);
});
