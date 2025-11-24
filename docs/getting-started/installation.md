# Installation

## Prerequisites

- Node.js v18.0.0 or higher
- npm (comes with Node.js)

## Install Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd qalam
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Link globally**
   ```bash
   npm link
   ```

4. **Verify installation**
   ```bash
   qalam --version
   ```

## First Run

Start Qalam in interactive mode:

```bash
qalam
```

You'll see:
```
Welcome to Qalam CLI - The pen that never forgets
Type 'help' for available commands or 'exit' to quit

qalam>
```

## Data Storage

Qalam stores its data in `~/.qalam/`:
- `qalam.db` - SQLite database for commands, workflows, and tasks
- `config.json` - Configuration settings
- `skills/` - Custom skills directory

## Uninstall

```bash
npm unlink qalam-cli
rm -rf ~/.qalam  # Remove data (optional)