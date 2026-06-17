# <Endpoint Title>
<METHOD> <PATH>
Description: <what endpoint does, who uses it, important side effect>
Auth: <no auth | Bearer token | API key>
DependsOn: <optional endpoint title/path>
Flow: <where this endpoint appears in the API workflow>
Condition:
- <validation/business rule>
- <permission/state rule>

PathParams:
id string required - Resource ID from URL path.

Query:
page integer optional minimum=1 - Page number.
limit integer optional minimum=1 maximum=100 - Items per page.

Headers:
Authorization string required - Bearer access token.

Body:
name string required minLength=3 maxLength=80 - Human readable name.

FormData:
file file required maxSize=2MB contentType=image/* - Uploaded file.

Success 200:
id string required - Resource ID.
message string required - Success message.

Error 400:
message string required - Invalid request message.

Error 401:
message string required - Authentication failed message.
