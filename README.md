# 🖋️ Qalam CLI - The Pen That Never Forgets

> Write once, run forever. Your intelligent CLI assistant for developers.

Qalam (قلم - "The Pen") is an intelligent CLI assistant that remembers your commands, automates repetitive workflows, and uses AI to solve complex development problems. Like a faithful scribe, it preserves and recalls your development wisdom, letting you focus on writing code, not memorizing commands.

## ✨ Why Qalam?

**The Problem:** Your daily development flow is constantly interrupted:

- 🔍 Searching for that command you ran last month
- 📝 Re-typing the same command sequences every morning
- 🤯 Context-switching between different tools and services
- 😤 Forgetting project-specific commands and setups

**The Solution:** Qalam becomes your command-line memory:

- 🧠 **AI-Powered**: Ask in plain English, get working solutions
- 🔄 **Smart Workflows**: Automate your daily routines
- 💾 **Perfect Memory**: Every useful command, instantly recalled
- ⚡ **One Interface**: All your tools, one intelligent companion

## 🎯 Key Features

### 1. AI That Understands Your Problems

```bash
# Instead of endless googling...
qalam ask "how to find and kill process using port 3000"

# Get instant, working solutions
qalam ask "setup git hooks for auto-formatting"
```

### 2. Workflows - Automate Your Daily Rituals

```bash
# Create your morning startup routine
qalam workflow create morning
# Interactively add: git pull, npm install, docker-compose up, npm run dev

# Start your day with one command
qalam workflow run morning

# Different projects? Use variables
qalam workflow run setup --vars project=client-app
```

### 3. Never Lose a Command Again

```bash
# Save that complex command you finally got working
qalam memory save test-e2e "npm run test:e2e -- --browser=chrome --headed"

# Recall instantly
qalam memory get test-e2e
```

### 4. Interactive Mode - Your Command Center

```bash
qalam  # Just type this

> workflow create   # Build workflows interactively
> ask how to squash commits
> docker ps        # Direct tool access
> memory search npm
```

## 🚀 Quick Start

### Install in 30 Seconds

```bash
git clone https://github.com/grandimam/qalam.git
cd qalam
npm install
npm link  # Makes 'qalam' available globally
```

### Your First Day with Qalam

```bash
# Start interactive mode
qalam

# Set up your daily workflow
> workflow create daily-setup
  Command 1: git pull
  Command 2: npm install
  Command 3: npm run dev

# Save useful commands
> memory save lint-fix "npm run lint -- --fix"

# Get help when stuck
> ask "how to rebase without conflicts"
```

## 💪 Real Developer Scenarios

### Morning Routine

```bash
# One command to start your entire dev environment
qalam workflow create start-dev
# Add: docker-compose up -d
# Add: npm run dev
# Add: code .

qalam workflow run start-dev  # Ready to code in seconds
```

### Project Switching

```bash
# Save project-specific commands
qalam memory save client-deploy "npm run build && scp -r dist/* user@client-server:/var/www"
qalam memory save api-test "npm test -- --coverage --watch"

# Instant context switching
qalam memory get client-deploy
```

### Debugging Sessions

```bash
# When things go wrong
qalam ask "app crashes with heap out of memory error"
qalam ask "how to profile node.js memory usage"
qalam ask "find memory leaks in react app"
```

### End of Day Cleanup

```bash
qalam workflow create shutdown
# Add: git add . && git commit -m "WIP"
# Add: docker-compose down
# Add: npm run clean

qalam workflow run shutdown  # Clean exit every time
```

## 🎨 Built for Modern Development

- **Framework Agnostic**: Works with any stack or tooling
- **Zero Config**: Intelligent defaults, works immediately
- **Fast**: Instant command execution and recall
- **Extensible**: Add custom skills for your tools
- **Learning**: Gets smarter with your usage patterns

## 📊 See the Difference

**Before Qalam:**

```bash
# Where was that test command...
history | grep test
# Scrolling through 500 lines...
# Finally found it but it's truncated...
npm run test:integration -- --grep "user auth" --timeout 5000 --bail
```

**After Qalam:**

```bash
qalam memory get test-auth  # Done instantly
```

## 🔧 Core Commands

| Command          | Purpose            | Example                                      |
| ---------------- | ------------------ | -------------------------------------------- |
| `qalam`          | Interactive mode   | `qalam`                                      |
| `qalam ask`      | AI assistance      | `qalam ask "how to mock API calls in tests"` |
| `qalam workflow` | Automation chains  | `qalam workflow create build-deploy`         |
| `qalam memory`   | Command storage    | `qalam memory save dev "npm run dev"`        |
| `qalam docker`   | Docker shortcuts   | `qalam docker ps`                            |
| `qalam service`  | Service management | `qalam service start redis`                  |

## 🛠 Power Features

### Workflow Variables

```bash
# Create flexible workflows
qalam workflow create deploy
# Add: npm run build:${env}
# Add: deploy-to-${env}.sh

# Deploy to different environments
qalam workflow run deploy --vars env=staging
qalam workflow run deploy --vars env=production
```

### Parallel Execution

```bash
# Run multiple tasks simultaneously
qalam workflow create test-all --parallel
# Add: npm run test:unit
# Add: npm run test:integration
# Add: npm run lint
```

### Smart Command Chains

```bash
# Continue even if something fails
qalam workflow create safe-update --continue
# Add: git stash
# Add: git pull --rebase
# Add: npm install
# Add: git stash pop
```

## 🎯 Perfect For

- **Full-Stack Developers** juggling multiple projects
- **Frontend Engineers** with complex build processes
- **Backend Developers** managing services and databases
- **Anyone** tired of re-googling the same commands

## 🔌 Extend with Custom Skills

```javascript
// ~/.qalam/skills/custom.js
export default class GitFlowSkill extends Skill {
  constructor() {
    super("gitflow", "Automated git workflows");
  }

  async execute(args) {
    // Your custom automation
  }
}
```

## 📚 The Name "Qalam"

In Islamic tradition, the Qalam (pen) was the first creation, used to write all that would happen. Similarly, Qalam CLI writes and preserves your command-line knowledge, creating a permanent record of your development wisdom that you can recall instantly.

## 🤝 Contributing

We love contributions:

- 🐛 Bug fixes
- ✨ New features
- 📚 Better docs
- 💡 New skill ideas

## 📈 Coming Soon

- [ ] Task management system
- [ ] Team workflow sharing
- [ ] Cloud command sync
- [ ] IDE integrations
- [ ] Command analytics dashboard
- [ ] AI pair programming mode

## 📝 License

MIT - Use it, love it, contribute to it!

---

<p align="center">
  <b>Qalam - The pen that preserves your command-line wisdom</b>
</p>

<p align="center">
  <em>"Write once, run forever"</em>
</p>

<p align="center">
  Built with ❤️ for developers who'd rather be coding
</p>
