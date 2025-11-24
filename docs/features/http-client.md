# HTTP Client

Qalam includes a powerful HTTP client with Postman collection import support, making API testing and development seamless from the command line.

## Importing Postman Collections

### Basic Import

```bash
# Import a Postman collection
qalam http import my-api-collection.json

# Import with environment variables
qalam http import collection.json --env environment.json
```

### What Gets Imported

- **Requests** - All HTTP requests with methods, URLs, headers, and bodies
- **Folders** - Preserves collection folder structure
- **Variables** - Collection and environment variables
- **Descriptions** - Request documentation and metadata

## Making Requests

### List Available Requests

```bash
qalam http list
```

Shows all imported requests with:
- Request name
- HTTP method (color-coded)
- URL endpoint
- Collection/folder structure

### Execute Requests

```bash
# Execute by name
qalam http "Get User Profile"
qalam http "Create New Post"

# With partial matching
qalam http user  # Shows all requests with "user" in name
```

## Variable Management

### Setting Variables

```bash
# Set a variable
qalam http set baseUrl https://api.example.com
qalam http set authToken abc123xyz
qalam http set userId 42
```

### Viewing Variables

```bash
# List all variables
qalam http vars
```

### Variable Substitution

Variables use Postman's `{{variable}}` syntax:

```
GET {{baseUrl}}/users/{{userId}}
Authorization: Bearer {{authToken}}
```

Variables are automatically replaced during execution.

## Request Management

### Search Requests

```bash
# Interactive search
qalam http
# Then type to filter requests
```

### Delete Requests

```bash
# Delete a specific request
qalam http delete "Old Request"

# Clear all requests
qalam http clear
```

## Request Details

### Request Structure

Imported requests maintain:

- **Method**: GET, POST, PUT, DELETE, PATCH, etc.
- **URL**: Full endpoint with variable placeholders
- **Headers**: All headers including auth
- **Body**: Request body (JSON, form-data, raw)
- **Query Parameters**: URL parameters

### Response Handling

Responses show:

- **Status Code**: Color-coded (2xx green, 4xx yellow, 5xx red)
- **Response Time**: Request duration
- **Headers**: Response headers
- **Body**: Formatted JSON or raw text

## Advanced Features

### Collection Organization

Requests are organized by collection structure:

```
MyAPI Collection/
├── Authentication/
│   ├── Login
│   └── Refresh Token
├── Users/
│   ├── Get Users
│   ├── Create User
│   └── Update User
└── Posts/
    ├── List Posts
    └── Create Post
```

### Request Execution Flow

1. **Load request** from database
2. **Substitute variables** in URL, headers, and body
3. **Execute HTTP request**
4. **Format response** based on content type
5. **Display results** with syntax highlighting

## Examples

### API Testing Workflow

```bash
# 1. Import your Postman collection
qalam http import api-tests.json

# 2. Set environment variables
qalam http set baseUrl https://staging-api.example.com
qalam http set apiKey sk_test_abc123

# 3. Run authentication
qalam http "Login"
# Response includes auth token

# 4. Set auth token from response
qalam http set authToken <token-from-response>

# 5. Test authenticated endpoints
qalam http "Get User Profile"
qalam http "Create Order"
```

### Development Workflow

```bash
# Import local development collection
qalam http import local-dev.json

# Set local environment
qalam http set baseUrl http://localhost:3000
qalam http set testUser user@example.com

# Test endpoints during development
qalam http "Health Check"
qalam http "Create Test Data"
qalam http "Run Test Suite"
```

### Multi-Environment Testing

```bash
# Development
qalam http set baseUrl https://dev-api.example.com
qalam http "Smoke Test"

# Staging
qalam http set baseUrl https://staging-api.example.com
qalam http "Smoke Test"

# Production
qalam http set baseUrl https://api.example.com
qalam http "Smoke Test"
```

## Tips and Tricks

### Quick Testing

Create a workflow for API testing:

```bash
qalam workflow create api-test
# Add: qalam http set baseUrl https://api.example.com
# Add: qalam http "Health Check"
# Add: qalam http "Authentication"
# Add: qalam http "Get Resources"
```

### Variable Templates

Save common variable sets:

```bash
qalam memory save vars-dev "qalam http set baseUrl http://localhost:3000"
qalam memory save vars-staging "qalam http set baseUrl https://staging.example.com"
qalam memory save vars-prod "qalam http set baseUrl https://api.example.com"
```

### Response Processing

Pipe responses to other tools:

```bash
# Pretty print JSON
qalam http "Get Data" | jq .

# Save response
qalam http "Get Report" > report.json

# Extract specific field
qalam http "Get User" | jq -r .email
```

## Postman Compatibility

### Supported Features

- ✅ Basic authentication
- ✅ Bearer token authentication
- ✅ Headers (including auth)
- ✅ Query parameters
- ✅ Path variables
- ✅ JSON bodies
- ✅ Form data
- ✅ Raw body
- ✅ Collection variables
- ✅ Environment variables

### Limitations

- ❌ Pre-request scripts
- ❌ Tests/assertions
- ❌ OAuth 2.0 flow
- ❌ File uploads
- ❌ GraphQL specific features
- ❌ WebSocket requests

## Troubleshooting

### Import Issues

**"Invalid collection format"**
- Ensure file is valid JSON
- Export from Postman as Collection v2.1

**"No requests found"**
- Check collection structure
- Verify requests exist in collection

### Request Failures

**"Variable not found"**
- List variables: `qalam http vars`
- Set missing variable: `qalam http set <name> <value>`

**"Connection refused"**
- Check baseUrl variable
- Verify service is running
- Check network connectivity

**"Authentication failed"**
- Update auth tokens
- Check token expiry
- Verify credentials