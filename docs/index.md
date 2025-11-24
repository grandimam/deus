# Qalam CLI Documentation

> 🖋️ **The intelligent command-line memory for developers**

## The Problem We Solve

Every developer faces the same daily frustrations:

- **"What was that command?"** - Searching through history for that complex kubectl command you ran last week
- **"How did I do this before?"** - Re-googling the same solutions over and over
- **"Time to start work..."** - Running the same 10 commands every morning to get your environment ready
- **"Too many tasks..."** - Losing track of what needs to be done across multiple projects

## What is Qalam?

**Qalam is your command-line companion that remembers everything so you don't have to.**

Think of it as:

- 🧠 **A searchable brain** for all your commands
- 🤖 **An intelligent assistant** that understands what you're trying to do
- ⚡ **An automation engine** that turns repetitive tasks into single commands
- 📋 **A task manager** that lives in your terminal

## Why Qalam Exists

We built Qalam because developers spend too much time on repetitive command-line tasks:

1. **Memory Fatigue** - The average developer uses hundreds of different commands across dozens of tools
2. **Repetitive Workflows** - Running the same sequence of commands multiple times per day
3. **Context Switching** - Jumping between terminal and other tools for task management
4. **Knowledge Loss** - Valuable command knowledge gets lost when developers leave or forget

Qalam solves these problems by becoming your permanent command-line memory and automation layer.

## Essential Capabilities

### 1. 🧠 **Command Memory**

Never lose a command again. Save, search, and instantly recall any command with context.

```bash
# Save a complex command once
qalam memory save deploy "npm run build && rsync -avz dist/ server:/var/www/"

# Recall it instantly whenever needed
qalam memory get deploy

# Search through all your commands
qalam memory search rsync
```

### 2. 🔄 **Workflow Automation**

Turn multi-step processes into single commands. No more copy-pasting from README files.

```bash
# Create a morning startup workflow
qalam workflow create morning
# Interactively add commands: git pull, npm install, npm run dev

# Run your entire setup with one command
qalam workflow run morning

# Use variables for flexible workflows
qalam workflow run deploy --vars env=staging
```

### 3. 📋 **Task Management**

Keep track of what needs to be done, right in your terminal where you work.

```bash
# Add tasks with priority
qalam tasks add "Fix memory leak in API" p1
qalam tasks add "Update documentation" p3

# Get your next priority task
qalam tasks next

# Mark tasks complete
qalam tasks done
```

### 4. 🤖 **AI Assistant**

Get instant solutions without leaving your terminal. No more context switching to Google.

```bash
# Ask in plain English
qalam ask "how to find which process is using port 3000"

# Get working commands immediately
qalam ask "create a git pre-commit hook"

# Debug errors
qalam ask "fix: npm ERR! ENOENT: no such file or directory"
```

### 5. 🌐 **HTTP Client with Postman Import**

Import and run Postman collections directly from your terminal.

```bash
# Import your Postman collection
qalam http import api-collection.json

# Set variables and run requests
qalam http set baseUrl http://localhost:3000
qalam http "Create User"
qalam http "Get User Profile"
```

### 6. 🎯 **Interactive Mode**

A powerful REPL interface for managing everything in one place.

```bash
qalam  # Enter interactive mode

> memory save test "npm test"
> workflow create deploy
> tasks list
> help
```

### 7. ☸️ **Smart Shell Access** (For K8s Users)

Safe, audited access to Kubernetes pods with automatic cleanup.

```bash
# Debug with safety checks
qalam shell api-service --reason "Debug issue #123" --duration 30m

# Switch clusters safely
qalam cluster staging
qalam cluster prod  # Requires confirmation
```

## Who Should Use Qalam?

### ✅ Perfect For:

- **Any Developer** who uses the command line daily
- **Team Leads** who want to share tribal knowledge and best practices
- **DevOps Engineers** managing complex command sequences
- **New Team Members** who need to get up to speed quickly

### 💡 Core Use Cases:

- **Daily Development** - Start your entire dev environment with one command
- **Knowledge Sharing** - Export and share commands with your team
- **Task Tracking** - Keep your to-dos in the terminal where you work
- **Learning** - Get instant help without leaving your workflow

## Quick Start Example

Here's how Qalam transforms your daily workflow:

### Before Qalam (Many commands, context switching)

```bash
# Every morning you do this...
cd ~/projects/myapp
git pull origin main
npm install
npm run dev
# Wait, what was that test command?
history | grep test
# What tasks did I need to do today?
# *switches to another app*
```

### After Qalam (Simple and organized)

```bash
# Everything in one place
qalam workflow run morning  # Runs all your startup commands
qalam tasks next           # Shows your next priority task
qalam memory get test      # Instantly recalls your test command
```

## Key Differentiators

What makes Qalam different from aliases or shell scripts?

| Feature           | Aliases/Scripts       | Qalam                    |
| ----------------- | --------------------- | ------------------------ |
| **Searchable**    | ❌ Hidden in dotfiles | ✅ Full-text search      |
| **Shareable**     | ❌ Manual copying     | ✅ Import/export         |
| **Interactive**   | ❌ Static             | ✅ Prompts and menus     |
| **Task Tracking** | ❌ Not available      | ✅ Built-in task manager |
| **AI Help**       | ❌ Not available      | ✅ Instant assistance    |
| **Extensible**    | ❌ Limited            | ✅ Custom skills         |

## Installation

```bash
# Clone and install
git clone https://github.com/yourusername/qalam.git
cd qalam
npm install && npm link

# Start using immediately
qalam
```

## Documentation

### 📚 Getting Started

- [**Installation**](getting-started/installation.md) - Set up in 2 minutes
- [**Quick Reference**](quick-reference.md) - All commands at a glance

### 🛠️ Core Features

- [**Memory System**](features/memory.md) - Never forget a command
- [**Workflows**](features/workflows.md) - Automate everything
- [**Task Management**](features/tasks.md) - Stay organized
- [**HTTP Client**](features/http-client.md) - API testing with Postman collections

### 🏗️ Understanding & Extending

- [**Core Concepts**](concepts/architecture.md) - Memory, Skills, Workflows, and more
- [**Custom Skills**](development/custom-skills.md) - Extend Qalam with your own features

### ❓ Help

- [**Troubleshooting**](troubleshooting.md) - Common issues and solutions

## Start Now

Ready to never forget a command again?

1. **[Install Qalam](getting-started/installation.md)** - 2 minutes
2. **Save your first command** - `qalam memory save hello "echo 'Hello, Qalam!'"`
3. **Create your first workflow** - `qalam workflow create morning`
4. **Track your tasks** - `qalam tasks add "Learn Qalam" p1`

---

**Qalam - Write once, run forever**  
*Because your brain is for solving problems, not memorizing commands*