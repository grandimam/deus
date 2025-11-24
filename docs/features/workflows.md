# Workflows

Workflows allow you to combine multiple commands into automated sequences that can be run with a single command.

## Creating Workflows

### Interactive Creation

```bash
qalam workflow create morning
```

You'll be prompted to:
1. Add a description
2. Enter commands one by one
3. Choose execution mode (sequential/parallel)
4. Set error handling behavior

### Command Line Creation

```bash
qalam workflow create deploy \
  --description "Deploy to production" \
  --parallel
```

## Workflow Options

### Execution Modes

**Sequential (default)**
Commands run one after another:
```bash
qalam workflow create build
# Add: npm install
# Add: npm test
# Add: npm run build
```

**Parallel**
Commands run simultaneously:
```bash
qalam workflow create test-all --parallel
# Add: npm run test:unit
# Add: npm run test:integration
# Add: npm run lint
```

### Error Handling

**Stop on Error (default)**
Workflow stops if any command fails.

**Continue on Error**
Workflow continues even if commands fail:
```bash
qalam workflow create cleanup --continue
```

## Variables

Use variables for flexible workflows:

```bash
# Create workflow with variables
qalam workflow create deploy
# Add command: kubectl set image deployment/app app=${version}

# Run with variables
qalam workflow run deploy --vars version=v1.2.3
```

## Managing Workflows

### List Workflows

```bash
qalam workflow list
```

Shows:
- Workflow name
- Description
- Number of commands
- Execution count
- Last run time

### Show Details

```bash
qalam workflow show morning
```

Displays:
- All commands in order
- Execution settings
- Variables used
- Statistics

### Run Workflows

```bash
# Simple run
qalam workflow run morning

# With variables
qalam workflow run deploy --vars env=staging

# Dry run (preview)
qalam workflow run risky --dry-run
```

### Edit Workflows

```bash
# Duplicate and modify
qalam workflow duplicate morning evening

# Delete workflow
qalam workflow remove old-workflow
```

## Example Workflows

### Development Start

```bash
qalam workflow create dev-start
# Description: Start development environment
# Commands:
#   1. git pull origin main
#   2. npm install
#   3. docker-compose up -d
#   4. npm run dev
```

### End of Day

```bash
qalam workflow create eod --continue
# Description: End of day cleanup
# Commands:
#   1. git add -A
#   2. git commit -m "WIP: End of day"
#   3. docker-compose down
#   4. npm run clean
```

### Multi-Environment Deploy

```bash
qalam workflow create deploy
# Commands with variables:
#   1. npm run build:${env}
#   2. aws s3 sync dist/ s3://bucket-${env}/
#   3. aws cloudfront create-invalidation --distribution-id ${cf_id}

# Usage:
qalam workflow run deploy --vars env=staging,cf_id=ABC123
qalam workflow run deploy --vars env=production,cf_id=XYZ789
```

## Best Practices

1. **Name workflows clearly**: Use descriptive names like `deploy-staging` not `ds`
2. **Add descriptions**: Help others (and future you) understand the purpose
3. **Use variables**: Make workflows reusable across environments
4. **Test first**: Run commands individually before adding to workflow
5. **Handle errors**: Decide if workflow should stop or continue on failure
6. **Keep it simple**: Break complex workflows into smaller, focused ones