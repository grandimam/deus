# Command Reference

## Overview

Qalam commands follow this pattern:
```bash
qalam [command] [subcommand] [options]
```

## Interactive Mode

```bash
qalam              # Start interactive mode
qalam interactive  # Explicitly start interactive mode
qalam i           # Short form
```

In interactive mode:
- Type `help` to see available commands
- Use arrow keys to navigate history
- Tab completion for commands (where supported)
- Type `exit` or `quit` to leave

## Memory Commands

Save and manage frequently used commands.

```bash
# Save a command
qalam memory save <name> "<command>" [description]

# Example
qalam memory save deploy "kubectl apply -f deployment.yaml" "Deploy to k8s"

# Get a saved command
qalam memory get <name>

# List all saved commands
qalam memory list

# Search commands
qalam memory search <query>

# Edit a command
qalam memory edit <name> "<new-command>"

# Delete a command
qalam memory delete <name>

# View statistics
qalam memory stats

# Export/Import
qalam memory export [filename]
qalam memory import <filename>
```

## Workflow Commands

Create and run sequences of commands.

```bash
# Create a workflow
qalam workflow create <name> [commands...]

# Options:
#   --parallel         Run commands in parallel
#   --continue        Continue on error
#   --description     Add description
#   --vars           Set variables

# Example
qalam workflow create morning --description "Start dev environment"
# Then interactively add commands

# Run a workflow
qalam workflow run <name>

# List all workflows
qalam workflow list

# Show workflow details
qalam workflow show <name>

# Delete a workflow
qalam workflow remove <name>

# Search workflows
qalam workflow search <query>

# Duplicate a workflow
qalam workflow duplicate <source> <target>
```

## Task Management

Priority-based task tracking system.

```bash
# Add a task
qalam tasks add "<task>" [p1|p2|p3]
# p1 = Urgent, p2 = Important, p3 = Normal

# Examples
qalam tasks add "Fix critical bug" p1
qalam tasks add "Review PR #123" p2
qalam tasks add "Update documentation"  # Auto-detects priority

# View next priority task
qalam tasks next

# Mark task as done
qalam tasks done [name|priority]

# List all tasks
qalam tasks list

# Get AI suggestions for workload
qalam tasks suggest

# View task health score
qalam tasks health

# Clear completed tasks
qalam tasks clear
```

## Kubernetes Commands

### Shell Access

```bash
# Create a shell into a Kubernetes pod
qalam shell <service>

# Options:
#   --async           Create shell in background
#   --duration <time> Auto-cleanup (e.g., "2h", "30m")
#   --reason "<text>" Justification for access
#   --container       Specify container name
#   --verbose        Show detailed progress

# Example
qalam shell api-service --duration 1h --reason "Debug memory leak"

# Check shell status
qalam shell status <service>

# List active shells
qalam shell
```

### Cluster Management

```bash
# Switch cluster
qalam cluster [name] [namespace]

# Examples
qalam cluster dev default
qalam cluster staging api-namespace
qalam cluster prod

# Show current cluster
qalam cluster
```

## AWS Authentication

```bash
# Login with AWS SSO
qalam login [profile]

# Examples
qalam login dev-account
qalam login  # Uses default profile

# Logout and clear credentials
qalam logout
```

## Service Management

Docker Compose service control.

```bash
# Start a service
qalam service start <name>

# Stop a service
qalam service stop <name>

# Restart a service
qalam service restart <name>

# Check status
qalam service status <name>

# View logs
qalam service logs <name>

# List all services
qalam service list
qalam service ps
```

## HTTP Client

Import and run Postman collections.

```bash
# Import a Postman collection
qalam http import <collection.json>

# List available requests
qalam http list

# Execute a request
qalam http "<request name>"

# Set variables for requests
qalam http set <key> <value>

# View all variables
qalam http vars

# Delete a request
qalam http delete <name>

# Clear all requests
qalam http clear
```

## Configuration

```bash
# View all configuration
qalam config list

# Get a specific value
qalam config get <key>

# Set a configuration value
qalam config set <key> <value>

# Examples
qalam config set ai.provider claude-code
qalam config set theme.color blue
```

## AI Assistant

```bash
# Ask for help
qalam ask "<question>"

# Examples
qalam ask "how to find files modified today"
qalam ask "explain git rebase"
qalam ask "debug: command not found error"
```

## Utility Commands

```bash
# List all available skills
qalam skills

# Show help
qalam help

# Show version
qalam --version
```

## Global Options

Available for all commands:

- `--help` or `-h` - Show help for command
- `--version` or `-v` - Show version
- `--verbose` - Enable verbose output