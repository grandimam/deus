# Memory System

The memory system lets you save, organize, and quickly recall frequently used commands.

## How It Works

Commands are stored in a local SQLite database with:
- Name (unique identifier)
- Command text
- Optional description
- Tags for categorization
- Usage statistics
- Timestamps

## Basic Usage

### Save a Command

```bash
qalam memory save <name> "<command>" [description]

# Examples
qalam memory save build "npm run build"
qalam memory save deploy "kubectl apply -f k8s/" "Deploy to Kubernetes"
qalam memory save logs "docker logs -f --tail 100"
```

### Retrieve Commands

```bash
# Get and display a command
qalam memory get build

# Interactive list (select to execute)
qalam memory list

# Search by name, command, or description
qalam memory search docker
```

### Manage Commands

```bash
# Edit an existing command
qalam memory edit build "npm run build:prod"

# Delete a command
qalam memory delete old-command

# View usage statistics
qalam memory stats
```

## Interactive Mode

In interactive mode, the memory system provides a menu-driven interface:

```bash
qalam memory
```

Options:
1. Save new command
2. List and execute
3. Search commands
4. Edit command
5. Delete command
6. View statistics
7. Export/Import

## Tags and Organization

Commands can include tags for better organization:

```bash
# Tags are automatically extracted from descriptions
qalam memory save test-unit "npm test" "Run unit tests #testing #ci"
```

## Export and Import

Share or backup your commands:

```bash
# Export to JSON
qalam memory export my-commands.json

# Import from JSON
qalam memory import colleague-commands.json
```

## Usage Tracking

The system tracks:
- How many times each command is used
- When it was last used
- Most frequently used commands

View statistics:
```bash
qalam memory stats
```

## Tips

1. **Use descriptive names**: `deploy-prod` instead of `dp`
2. **Add descriptions**: Helps when searching later
3. **Regular exports**: Backup your commands periodically
4. **Clean up**: Remove outdated commands to keep the list manageable