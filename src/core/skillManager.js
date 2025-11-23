import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SkillManager {
  constructor() {
    this.skills = new Map();
    this.initialized = this.init();
  }

  async init() {
    await this.loadBuiltinSkills();
    await this.loadCustomSkills();
  }

  async loadBuiltinSkills() {
    const skillsDir = path.join(__dirname, '../skills');
    try {
      const files = await fs.readdir(skillsDir);
      for (const file of files) {
        if (file.endsWith('.js')) {
          try {
            const skillModule = await import(path.join(skillsDir, file));
            if (skillModule.default) {
              const skill = new skillModule.default();
              this.registerSkill(skill);
            }
          } catch (error) {
            console.error(`Failed to load skill ${file}:`, error.message);
            // Continue loading other skills
          }
        }
      }
    } catch (error) {
      console.error('Skills directory error:', error.message);
    }
  }

  async loadCustomSkills() {
    const customSkillsDir = path.join(process.env.HOME || process.env.USERPROFILE, '.qalam', 'skills');
    try {
      await fs.access(customSkillsDir);
      const files = await fs.readdir(customSkillsDir);
      for (const file of files) {
        if (file.endsWith('.js')) {
          const skillModule = await import(path.join(customSkillsDir, file));
          if (skillModule.default) {
            const skill = new skillModule.default();
            this.registerSkill(skill);
          }
        }
      }
    } catch (error) {
      // Custom skills directory doesn't exist
    }
  }

  registerSkill(skill) {
    if (!skill.name || !skill.execute) {
      throw new Error('Skill must have a name and execute method');
    }
    this.skills.set(skill.name, skill);
  }

  getSkill(name) {
    return this.skills.get(name);
  }

  getAllSkills() {
    return Array.from(this.skills.values());
  }

  hasSkill(name) {
    return this.skills.has(name);
  }
}

export class Skill {
  constructor(name, description = '') {
    this.name = name;
    this.description = description;
  }

  async execute(args) {
    throw new Error('Skill must implement execute method');
  }

  help() {
    return 'No help available for this skill';
  }
}