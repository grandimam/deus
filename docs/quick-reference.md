# Quick Reference

## Essential Commands

### Memory System
```bash
qalam memory save <name> "<command>"        # Save command
qalam memory get <name>                     # Get command
qalam memory list                           # List all
qalam memory search <query>                 # Search commands
qalam memory delete <name>                  # Delete command
qalam memory stats                          # Usage statistics
```

### Workflows
```bash
qalam workflow create <name>                # Create workflow
qalam workflow run <name>                   # Run workflow
qalam workflow run <name> --vars x=y        # Run with variables
qalam workflow list                         # List workflows
qalam workflow show <name>                  # Show details
qalam workflow remove <name>                # Delete workflow
```

### Tasks
```bash
qalam tasks add "<task>" [p1|p2|p3]        # Add task
qalam tasks next                           # Get next task
qalam tasks done [task|priority]           # Complete task
qalam tasks list                           # List all tasks
qalam tasks health                         # Health check
qalam tasks clear                          # Clear completed
```

### Kubernetes
```bash
qalam cluster [env] [namespace]             # Switch cluster
qalam shell <service>                       # Create debug pod
qalam shell <service> --duration 1h         # Auto-cleanup
qalam shell status <service>                # Check status
qalam kubectl <command>                     # Run kubectl
```

### AWS
```bash
qalam login [profile]                       # AWS SSO login
qalam logout                                # Clear credentials
```

### Docker & Services
```bash
qalam docker ps                             # List containers
qalam docker logs <container>               # View logs
qalam service start <name>                  # Start service
qalam service stop <name>                   # Stop service
qalam service logs <name>                   # Service logs
qalam service list                          # List services
```

### HTTP Client
```bash
qalam http import <file.json>               # Import Postman
qalam http list                             # List requests
qalam http "<request name>"                 # Execute request
qalam http set <var> <value>                # Set variable
qalam http vars                             # Show variables
```

### Configuration
```bash
qalam config list                           # Show all config
qalam config get <key>                      # Get value
qalam config set <key> <value>              # Set value
qalam config reset                          # Reset to defaults
```

### AI & Help
```bash
qalam ask "<question>"                      # AI assistance
qalam help                                  # Show help
qalam skills                                # List skills
qalam --version                             # Show version
```

## Command Options

### Global Options
```bash
--help, -h                                  # Show help
--version, -v                               # Show version
--verbose                                   # Verbose output
```

### Shell Options
```bash
--reason "<text>"                           # Justification
--duration <time>                           # Auto-cleanup (1h, 30m)
--container <name>                          # Target container
--async                                     # Background creation
--verbose                                   # Detailed progress
```

### Workflow Options
```bash
--parallel                                  # Parallel execution
--continue                                  # Continue on error
--description "<text>"                      # Add description
--vars key=value,key2=value2               # Set variables
```

## Interactive Mode Commands

```bash
qalam                                       # Enter interactive mode

# In interactive mode:
help                                        # Show commands
skills                                      # List skills
clear                                       # Clear screen
stats                                       # Show statistics
exit/quit                                   # Exit
```

## Variable Syntax

### In Workflows
```bash
${variable}                                 # Recommended
$variable                                   # Also works
```

### In HTTP Client
```bash
{{variable}}                                # Postman style
```

## Priority Levels

```
P1 - Urgent    (🔴 Critical, immediate attention)
P2 - Important (🟡 Important but not critical)
P3 - Normal    (🟢 Regular tasks)
```

## File Locations

```bash
~/.qalam/qalam.db                          # Database
~/.qalam/config.json                       # Configuration
~/.qalam/skills/                           # Custom skills
```

## Environment Variables

```bash
# Configuration overrides
QALAM_AI_PROVIDER=openai
QALAM_THEME_COLOR=green
QALAM_INTERACTIVE_PROMPT="qalam> "

# Cluster configuration
QALAM_CLUSTER_DEV=dev-cluster
QALAM_NAMESPACE_DEV=default
QALAM_CLUSTER_STAGING=staging-cluster
QALAM_NAMESPACE_STAGING=staging
QALAM_CLUSTER_PROD=prod-cluster
QALAM_NAMESPACE_PROD=production

# Debug mode
DEBUG=* qalam <command>
```

## Common Workflows

### Morning Setup
```bash
qalam workflow create morning
# Add: git pull
# Add: docker-compose up -d
# Add: npm install
# Add: npm run dev

qalam workflow run morning
```

### Deploy Pipeline
```bash
qalam workflow create deploy --vars env
# Add: npm test
# Add: npm run build:${env}
# Add: kubectl apply -f k8s/${env}/

qalam workflow run deploy --vars env=staging
```

### API Testing
```bash
qalam http import api.json
qalam http set baseUrl http://localhost:3000
qalam http set token abc123
qalam http "Login"
qalam http "Get Users"
```

### Debug Production
```bash
qalam login prod
qalam cluster prod
qalam shell api --reason "Debug issue #123" --duration 30m
```

## Keyboard Shortcuts

### Interactive Mode
```
↑/↓         Navigate command history
Tab         Auto-complete (where supported)
Ctrl+C      Cancel current operation
Ctrl+D      Exit interactive mode
Ctrl+L      Clear screen
```

## Exit Codes

```
0   Success
1   General error
2   Misuse of shell command
126 Command cannot execute
127 Command not found
130 Terminated by Ctrl+C
```

## Tips & Tricks

### Command Chaining
```bash
# Sequential
cmd1 && cmd2 && cmd3

# Parallel
cmd1 & cmd2 & wait

# Continue on error
cmd1 ; cmd2 ; cmd3
```

### Quick Aliases
```bash
qalam memory save k "kubectl"
qalam memory save d "docker"
qalam memory save dc "docker-compose"
qalam memory save g "git"
```

### Backup Data
```bash
# Export everything
qalam memory export memory-backup.json
qalam workflow export workflow-backup.json

# Backup database
cp ~/.qalam/qalam.db ~/qalam-backup.db
```

### Clean Slate
```bash
# Reset everything
rm -rf ~/.qalam
qalam  # Reinitialize
```

## Debugging

### Verbose Output
```bash
qalam --verbose <command>
qalam shell <service> --verbose
DEBUG=* qalam <command>
```

### Check Health
```bash
qalam tasks health
qalam memory stats
qalam config list
```

### Test Commands
```bash
# Dry run
echo "Would run: $(qalam memory get <name>)"

# Test workflow
qalam workflow show <name>
```