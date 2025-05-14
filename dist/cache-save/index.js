Tool
CodeQL
Rule ID
js/incomplete-sanitization
Query
View source
Description
Sanitizing untrusted input is a common technique for preventing injection attacks such as SQL injection or cross-site scripting. Usually, this is done by escaping meta-characters such as quotes in a domain-specific way so that they are treated as normal characters.

However, directly using the string replace method to perform escaping is notoriously error-prone. Common mistakes include only replacing the first occurrence of a meta-character, or backslash-escaping various meta-characters but not the backslash itself.

In the former case, later meta-characters are left undisturbed and can be used to subvert the sanitization. In the latter case, preceding a meta-character with a backslash leads to the backslash being escaped, but the meta-character appearing un-escaped, which again makes the sanitization ineffective.

Even if the escaped string is not used in a security-critical context, incomplete escaping may still have undesirable effects, such as badly rendered or confusing output.

Recommendation
Use a (well-tested) sanitization library if at all possible. These libraries are much more likely to handle corner cases correctly than a custom implementation.

An even safer alternative is to design the application so that sanitization is not needed, for instance by using prepared statements for SQL queries.

Otherwise, make sure to use a regular expression with the g flag to ensure that all occurrences are replaced, and remember to escape backslashes if applicable.

Example
For example, assume that we want to embed a user-controlled string accountNumber into a SQL query as part of a string literal. To avoid SQL injection, we need to ensure that the string does not contain un-escaped single-quote characters. The following function attempts to ensure this by doubling single quotes, and thereby escaping them:

function escapeQuotes(s) {
  return s.replace("'", "''");
}
As written, this sanitizer is ineffective: if the first argument to replace is a string literal (as in this case), only the first occurrence of that string is replaced.

As mentioned above, the function escapeQuotes should be replaced with a purpose-built sanitization library, such as the npm module sqlstring. Many other sanitization libraries are available from npm and other sources.

If this is not an option, escapeQuotes should be rewritten to use a regular expression with the g ("global") flag instead:

function escapeQuotes(s) {
  return s.replace(/'/g, "''");
}
Note that it is very important to include the global flag: s.replace(/'/, "''") without the global flag is equivalent to the first example above and only replaces the first quote.

References
OWASP Top 10: A1 Injection.
npm: sqlstring package.
Common Weakness Enumeration: CWE-20.
Common Weakness Enumeration: CWE-80.
Common Weakness Enumeration: CWE-116.
