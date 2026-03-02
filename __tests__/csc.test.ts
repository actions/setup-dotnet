import cscFile from '../.github/csc.json';
describe('csc tests', () => {
  test('regular expression in csc.json is valid', async () => {
    const regexPattern = cscFile['problemMatcher'][0]['pattern'][0]['regexp'];
    const regexResultsMap = cscFile['problemMatcher'][0]['pattern'][0];

    const regex = new RegExp(regexPattern);

    const stringsToMatch = [
      'Program.cs(10,79): error CS1002: ; expected [/Users/zacharyeisinger/Documents/repo/setup-dotnet/__tests__/sample-broken-csproj/sample.csproj]',
      "S:\\Msbuild\\src\\Build\\Evaluation\\ExpressionShredder.cs(33,7): error CS1003: Syntax error, ',' expected [S:\\msbuild\\src\\Build\\Microsoft.Build.csproj > Properties:prop]"
    ];
    // Expected results are calculated according to the csc matcher located in csc.json file
    const expectedResults = [
      {
        file: 'Program.cs',
        line: '10',
        severity: 'error',
        code: 'CS1002',
        message: '; expected',
        fromPath:
          '/Users/zacharyeisinger/Documents/repo/setup-dotnet/__tests__/sample-broken-csproj/sample.csproj'
      },
      {
        file: 'S:\\Msbuild\\src\\Build\\Evaluation\\ExpressionShredder.cs',
        line: '33',
        severity: 'error',
        code: 'CS1003',
        message: "Syntax error, ',' expected",
        fromPath:
          'S:\\msbuild\\src\\Build\\Microsoft.Build.csproj > Properties:prop'
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
