# Troubleshooting & FAQ

## Frequently Asked Questions

### General

**Q: What does "Qalam" mean?**  
A: Qalam (قلم) means "pen" in Arabic. In Islamic tradition, the Qalam was the first creation, used to write all that would happen. Similarly, Qalam CLI writes and preserves your command-line knowledge.

**Q: Is Qalam free to use?**  
A: Yes, Qalam is open-source and free to use under the MIT license.

**Q: Which platforms does Qalam support?**  
A: Qalam works on macOS, Linux, and Windows (with WSL). Native Windows support without WSL is not currently available.

**Q: Can I use Qalam without Kubernetes/AWS?**  
A: Absolutely! The memory system, workflows, tasks, and many other features work independently of cloud services.

### Installation Issues

**Q: Command 'qalam' not found after installation**  
A: The npm link command may not have added qalam to your PATH. Try:

```bash
# Check where npm installs global packages
npm bin -g

# Add to your PATH (in ~/.bashrc or ~/.zshrc)
export PATH="$(npm bin -g):$PATH"

# Reload your shell
source ~/.bashrc  # or ~/.zshrc
```

**Q: Permission denied errors during npm link**  
A: Avoid using sudo with npm. Instead, configure npm to use a different directory:

```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
npm link
```

**Q: Node version error**  
A: Qalam requires Node.js v18 or higher. Update Node:

```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Or download from nodejs.org
```

### Database Issues

**Q: Database locked error**  
A: Another process may be using the database. Try:

```bash
# Find processes using the database
lsof ~/.qalam/qalam.db

# Kill the process if stuck
kill -9 <PID>

# Or remove lock file
rm ~/.qalam/qalam.db-journal
```

**Q: Corrupted database**  
A: Reset the database (you'll lose saved data):

```bash
# Backup current database
cp ~/.qalam/qalam.db ~/.qalam/qalam.db.backup

# Remove and recreate
rm ~/.qalam/qalam.db
qalam  # Will recreate database
```

**Q: Database migration failed**  
A: Clear the database and let Qalam recreate it:

```bash
rm -rf ~/.qalam
qalam  # Will initialize fresh database
```

### Memory System

**Q: Can't save commands with quotes**  
A: Escape quotes or use different quote types:

```bash
# Use single quotes
qalam memory save cmd 'echo "Hello World"'

# Or escape double quotes
qalam memory save cmd "echo \"Hello World\""
```

**Q: Memory search not finding commands**  
A: Search looks at name, command, and description:

```bash
# Be more specific
qalam memory search docker

# Or list all and grep
qalam memory list | grep -i search-term
```

**Q: Import/Export not working**  
A: Check file permissions and JSON format:

```bash
# Export with specific path
qalam memory export ~/backup.json

# Verify JSON format
cat backup.json | jq .

# Import with full path
qalam memory import ~/backup.json
```

### Workflow Issues

**Q: Workflow commands fail but continue running**  
A: Check your continue-on-error setting:

```bash
# Stop on first error
qalam workflow create strict-workflow
# Don't add --continue flag

# Or update existing workflow
qalam workflow remove my-workflow
qalam workflow create my-workflow  # Recreate without --continue
```

**Q: Variables not being replaced**  
A: Use correct syntax and ensure variables are set:

```bash
# Correct variable syntax
${variable} or $variable

# Set variables when running
qalam workflow run deploy --vars env=staging,region=us-east-1
```

**Q: Parallel execution not working**  
A: Some commands may not support parallel execution:

```bash
# Test commands individually first
command1 & command2 & wait

# Or use sequential for dependent commands
qalam workflow create sequential-workflow
```

### Kubernetes Issues

**Q: Can't create shell/pod**  
A: Check cluster connectivity and permissions:

```bash
# Verify cluster connection
kubectl cluster-info
kubectl auth can-i create pods

# Check current context
kubectl config current-context

# Try with verbose output
qalam shell service --verbose
```

**Q: Shell creation times out**  
A: Image pull may be slow or failing:

```bash
# Check events
kubectl get events --sort-by='.lastTimestamp'

# Try with a smaller image
qalam shell service --image busybox:latest

# Check image pull secrets
kubectl get secrets
```

**Q: Production access denied**  
A: Production requires additional confirmation:

```bash
# Always provide justification
qalam shell prod-service --reason "Investigating issue #123" --duration 30m

# Check if you have production access
kubectl auth can-i '*' '*' -n production
```

### AWS Issues

**Q: SSO login fails**  
A: Check SSO configuration and browser:

```bash
# Verify SSO configuration
cat ~/.aws/config | grep sso

# Clear SSO cache
rm -rf ~/.aws/sso/cache
aws sso logout

# Try manual login
aws sso login --profile your-profile
```

**Q: aws-vault errors**  
A: Ensure aws-vault is installed and configured:

```bash
# Install aws-vault
brew install aws-vault  # macOS
# Or download from GitHub releases

# Check keychain access (macOS)
security list-keychains

# Use alternative backend
export AWS_VAULT_BACKEND=file
```

**Q: Credentials expired**  
A: Re-authenticate:

```bash
qalam logout
qalam login your-profile
```

### Docker/Service Issues

**Q: Services won't start**  
A: Check Docker daemon and compose file:

```bash
# Verify Docker is running
docker ps

# Check compose file
docker-compose config

# View service logs
docker-compose logs service-name

# Remove orphaned containers
docker-compose down --remove-orphans
```

**Q: Port already in use**  
A: Find and stop the conflicting process:

```bash
# Find process using port
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>
```

### HTTP Client Issues

**Q: Can't import Postman collection**  
A: Verify collection format:

```bash
# Check if valid JSON
cat collection.json | jq .

# Ensure it's Collection v2.1 format
# Export from Postman: Collection > Export > Collection v2.1
```

**Q: Variables not working**  
A: Set variables before executing requests:

```bash
# Set required variables
qalam http set baseUrl https://api.example.com
qalam http set authToken your-token

# View all variables
qalam http vars
```

### Configuration Issues

**Q: Settings not persisting**  
A: Check configuration file:

```bash
# View config location
ls -la ~/.qalam/config.json

# Check permissions
chmod 644 ~/.qalam/config.json

# Verify JSON syntax
cat ~/.qalam/config.json | jq .
```

**Q: Custom skills not loading**  
A: Verify skill configuration:

```bash
# Check auto-load setting
qalam config get skills.autoLoad

# Enable if disabled
qalam config set skills.autoLoad true

# Check skill file
ls -la ~/.qalam/skills/
node -c ~/.qalam/skills/myskill.js
```

### Performance Issues

**Q: Qalam is running slowly**  
A: Try these optimizations:

```bash
# Clear old data
qalam tasks clear
qalam memory stats  # Check if too many commands

# Disable animations
qalam config set theme.animations false

# Check database size
du -h ~/.qalam/qalam.db
```

**Q: High memory usage**  
A: Limit stored data:

```bash
# Reduce history limit
qalam config set memory.maxHistory 500

# Clear old sessions
sqlite3 ~/.qalam/qalam.db "DELETE FROM sessions WHERE end_time < datetime('now', '-30 days')"
```

## Error Messages

### "Cannot find module"

```bash
# Reinstall dependencies
npm install

# Clear npm cache
npm cache clean --force
```

### "EACCES: permission denied"

```bash
# Fix permissions
chmod 755 ~/.qalam
chmod 644 ~/.qalam/*
```

### "Command failed with exit code"

```bash
# Run with verbose output
qalam --verbose <command>

# Check individual command
<command> ; echo "Exit code: $?"
```

### "Unexpected token"

```bash
# Syntax error in custom skill
node -c ~/.qalam/skills/skillname.js

# Or in workflow command
qalam workflow show workflow-name
```

## Getting Help

### Debug Mode

```bash
# Enable debug output
export DEBUG=*
qalam <command>

# Or for specific skill
qalam skill-name --debug
```

### Verbose Output

```bash
# More detailed output
qalam --verbose <command>

# For specific operations
qalam shell service --verbose
qalam workflow run my-workflow --verbose
```

### System Information

```bash
# Qalam version
qalam --version

# Node version
node --version

# Check dependencies
npm list

# System info
uname -a  # Linux/macOS
```

### Reporting Issues

When reporting issues, include:

1. **Qalam version**: `qalam --version`
2. **Node version**: `node --version`
3. **Operating system**: `uname -a`
4. **Error message**: Full error output
5. **Steps to reproduce**: Exact commands run
6. **Debug output**: Run with `DEBUG=* qalam <command>`

Report issues at: https://github.com/grandimam/qalam/issues

## Community Support

- **GitHub Discussions**: Ask questions and share tips
- **Issue Tracker**: Report bugs and request features
- **Wiki**: Community-contributed guides and examples

---

If your issue isn't covered here, please:

1. Search existing GitHub issues
2. Check the specific feature documentation
3. Open a new issue with detailed information
