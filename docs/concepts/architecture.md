# Core Concepts

Understanding these fundamental concepts will help you get the most out of Qalam.

## Memory

**Memory is how Qalam remembers your commands.**

Think of it as your personal command database:
- **Save** any command with a memorable name
- **Search** through all your saved commands
- **Recall** instantly when you need them
- **Share** by exporting and importing command collections

```bash
# The concept is simple
qalam memory save deploy "complex-deployment-command"
qalam memory get deploy  # Retrieves it instantly
```

Memory is persistent - your commands are saved in a local database and survive system restarts.

## Skills

**Skills are modules that add functionality to Qalam.**

Each skill is like a mini-program that handles specific tasks:
- `memory` - Manages saved commands
- `workflow` - Handles automation sequences
- `tasks` - Tracks your to-dos
- `http` - Makes API requests
- `shell` - Creates Kubernetes debug pods

```bash
# Skills are invoked by name
qalam memory save ...    # Uses the memory skill
qalam workflow create ... # Uses the workflow skill
qalam http import ...    # Uses the http skill
```

### Built-in vs Custom Skills

- **Built-in skills** come with Qalam (memory, workflow, tasks, etc.)
- **Custom skills** can be added by you or your team
- Skills are just JavaScript files that follow a simple pattern

## Workflows

**Workflows are sequences of commands that run together.**

Instead of typing 10 commands every morning, create a workflow:
```bash
# Define once
qalam workflow create morning
# Add: git pull
# Add: npm install  
# Add: npm run dev

# Run anytime
qalam workflow run morning
```

Workflows support:
- **Sequential execution** - Commands run one after another
- **Parallel execution** - Commands run simultaneously  
- **Variables** - Make workflows flexible with `${variable}` substitution
- **Error handling** - Choose to stop or continue on errors

## Interactive Mode

**Interactive mode is Qalam's REPL (Read-Eval-Print-Loop) interface.**

```bash
qalam  # Enter interactive mode

> memory save test "npm test"
> workflow list
> help
```

In interactive mode:
- Commands are highlighted as you type
- History is saved between sessions
- Tab completion helps discover commands
- Direct access to all skills

## Database

**The database is where everything is stored.**

Location: `~/.qalam/qalam.db`

Stores:
- Saved commands with metadata
- Workflows and their steps
- Tasks and priorities
- Usage statistics
- Configuration

The database is:
- **Local** - Your data stays on your machine
- **Portable** - Can be backed up or moved
- **SQLite** - Simple, fast, reliable

## Sessions

**Sessions track your Qalam usage.**

Every time you use Qalam, it tracks:
- When you started and stopped
- Commands you ran
- Workflows you executed

This helps with:
- Understanding your most-used commands
- Optimizing your workflows
- Tracking productivity

## Variables

**Variables make commands and workflows flexible.**

In workflows:
```bash
# Define with variables
qalam workflow create deploy
# Add: npm run build:${env}
# Add: deploy-to-${env}.sh

# Use with different values
qalam workflow run deploy --vars env=staging
qalam workflow run deploy --vars env=production
```

In HTTP requests:
```bash
qalam http set baseUrl https://api.example.com
qalam http "Get Users"  # Uses {{baseUrl}}/users
```

## Priority System

**Tasks use a simple three-level priority system.**

- **P1 (Urgent)** 🔴 - Needs immediate attention
- **P2 (Important)** 🟡 - Important but not urgent
- **P3 (Normal)** 🟢 - Regular tasks

```bash
qalam tasks add "Critical bug fix" p1
qalam tasks add "Code review" p2
qalam tasks add "Update docs" p3

qalam tasks next  # Always shows highest priority first
```

## File Organization

**Qalam keeps everything in one place.**

```
~/.qalam/
├── qalam.db      # Your database
├── config.json   # Settings
└── skills/       # Custom skills directory
```

Simple, clean, predictable.

## Command Pattern

**All Qalam commands follow the same pattern.**

```
qalam [skill] [action] [arguments] [options]
```

Examples:
```bash
qalam memory save name "command"     # skill=memory, action=save
qalam workflow run morning           # skill=workflow, action=run
qalam tasks add "Do something" p1    # skill=tasks, action=add
```

## Export/Import

**Share your knowledge with others.**

Commands and workflows can be exported and imported:
```bash
# Export your commands
qalam memory export my-commands.json

# Share with team
# Team member imports
qalam memory import my-commands.json
```

This enables:
- Team knowledge sharing
- Onboarding new developers
- Backing up your commands
- Moving between machines

## Key Principles

### 1. **Simplicity First**
Every feature should be obvious and easy to use.

### 2. **Memory Over Documentation**
Save commands as you discover them, don't document them elsewhere.

### 3. **Automation Through Composition**
Complex automation is just simple commands combined.

### 4. **Local First**
Your data stays on your machine, under your control.

### 5. **Extensible by Design**
If Qalam doesn't do something, add a skill that does.

---

That's it! These core concepts are all you need to understand Qalam. Everything else builds on these fundamentals.