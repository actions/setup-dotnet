import csc from '../.github/csc.json';
import dotnetFormat from '../.github/dotnet-format.json';

// Unit tests for problem matchers
// https://github.com/actions/toolkit/blob/main/docs/problem-matchers.md

describe('/.github/csc.json tests', () => {
  const problemMatcher = csc.problemMatcher[0].pattern[0];

  it.each([
    [
      'Program.cs(10,79): error CS1002: ; expected [/Users/zacharyeisinger/Documents/repo/setup-dotnet/__tests__/sample-broken-csproj/sample.csproj]',
      {
        file: 'Program.cs',
        line: '10',
        severity: 'error',
        code: 'CS1002',
        message: '; expected',
        fromPath:
          '/Users/zacharyeisinger/Documents/repo/setup-dotnet/__tests__/sample-broken-csproj/sample.csproj'
      }
    ],
    [
      "S:\\Msbuild\\src\\Build\\Evaluation\\ExpressionShredder.cs(33,7): error CS1003: Syntax error, ',' expected [S:\\msbuild\\src\\Build\\Microsoft.Build.csproj > Properties:prop]",
      {
        file: 'S:\\Msbuild\\src\\Build\\Evaluation\\ExpressionShredder.cs',
        line: '33',
        severity: 'error',
        code: 'CS1003',
        message: "Syntax error, ',' expected",
        fromPath:
          'S:\\msbuild\\src\\Build\\Microsoft.Build.csproj > Properties:prop'
      }
    ]
  ])('log "%s" matches %o', (logOutput, expected) => {
    const regexp = new RegExp(problemMatcher.regexp);
    const res = logOutput.match(regexp);

    for (const key in expected) {
      expect(res?.[problemMatcher[key]]).toBe(expected[key]);
    }
  });
});

describe('/.github/dotnet-format.json tests', () => {
  const problemMatcher = dotnetFormat.problemMatcher[0].pattern[0];

  it.each([
    [
      "/home/runner/work/repo/Test.cs(18,6): error WHITESPACE: Fix whitespace formatting. Replace 12 characters with '\\n\\s\\s\\s\\s\\s\\s\\s\\s'. [/home/runner/work/repo/Test.csproj]",
      {
        file: '/home/runner/work/repo/Test.cs',
        line: '18',
        column: '6',
        severity: 'error',
        code: 'WHITESPACE',
        message:
          "Fix whitespace formatting. Replace 12 characters with '\\n\\s\\s\\s\\s\\s\\s\\s\\s'.",
        fromPath: '/home/runner/work/repo/Test.csproj'
      }
    ]
  ])('log "%s" matches %o', (logOutput, expected) => {
    const regexp = new RegExp(problemMatcher.regexp);
    const res = logOutput.match(regexp);

    for (const key in expected) {
      expect(res?.[problemMatcher[key]]).toBe(expected[key]);
    }
  });
});
