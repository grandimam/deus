# Examples

This directory contains example configurations, workflows, and custom skills for Qalam.

## Contents

- `workflows/` - Example workflow definitions
- `skills/` - Example custom skills
- `configs/` - Example configuration files

## Using Examples

### Workflows
```bash
# Import an example workflow
qalam workflow import examples/workflows/developer-daily.json
```

### Custom Skills
```bash
# Copy a custom skill to your local skills directory
cp examples/skills/git-helper.js ~/.qalam/skills/
```

### Configurations
```bash
# Use an example configuration
cp examples/configs/team-config.json ~/.qalam/config.json
```