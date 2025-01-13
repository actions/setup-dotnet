import dotnetFormat from '../.github/dotnet-format.json';

describe('/.github/dotnet-format.json tests', () => {
  const problemMatcher = dotnetFormat.problemMatcher[0].pattern[0];

  it.each([
    [
      "/home/runner/work/repo/Test.cs(18,6): error WHITESPACE: Fix whitespace formatting. Replace 12 characters with '\\n\\s\\s\\s\\s\\s\\s\\s\\s'. [/home/runner/work/repo/Test.csproj]",
      '/home/runner/work/repo/Test.cs',
      '18',
      '6',
      'error',
      'WHITESPACE',
      "Fix whitespace formatting. Replace 12 characters with '\\n\\s\\s\\s\\s\\s\\s\\s\\s'.",
      '/home/runner/work/repo/Test.csproj'
    ]
  ])(
    '"%s" returns {file: "%s", line: "%s", column: "%s", severity: "%s", code: "%s", message: "%s", fromPath: "%s"}',
    (logOutput, file, line, column, severity, code, message, fromPath) => {
      const regexp = new RegExp(problemMatcher.regexp);
      const res = logOutput.match(regexp);

      expect(res?.[problemMatcher.file]).toBe(file);
      expect(res?.[problemMatcher.line]).toBe(line);
      expect(res?.[problemMatcher.column]).toBe(column);
      expect(res?.[problemMatcher.severity]).toBe(severity);
      expect(res?.[problemMatcher.code]).toBe(code);
      expect(res?.[problemMatcher.message]).toBe(message);
      expect(res?.[problemMatcher.fromPath]).toBe(fromPath);
    }
  );
});
