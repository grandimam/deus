import Conf from 'conf';
import path from 'path';
import os from 'os';

export class Config {
  constructor() {
    this.store = new Conf({
      projectName: 'qalam-cli',
      cwd: path.join(os.homedir(), '.qalam'),
      defaults: {
        'ai.provider': 'claude-code',
        'theme.color': 'blue',
        'memory.maxHistory': 1000,
        'interactive.prompt': '> ',
        'skills.autoLoad': true
      }
    });
  }

  get(key) {
    return this.store.get(key);
  }

  set(key, value) {
    this.store.set(key, value);
  }

  delete(key) {
    this.store.delete(key);
  }

  has(key) {
    return this.store.has(key);
  }

  getAll() {
    return this.store.store;
  }

  clear() {
    this.store.clear();
  }

  reset() {
    this.store.clear();
    Object.entries(this.store._defaultValues).forEach(([key, value]) => {
      this.store.set(key, value);
    });
  }

  getPath() {
    return this.store.path;
  }

  migrate(migrations) {
    const currentVersion = this.get('version') || '1.0.0';
    
    Object.entries(migrations).forEach(([version, migration]) => {
      if (this.compareVersions(currentVersion, version) < 0) {
        migration(this);
        this.set('version', version);
      }
    });
  }

  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }
    
    return 0;
  }

  validate(schema) {
    const config = this.getAll();
    const errors = [];
    
    Object.entries(schema).forEach(([key, validator]) => {
      const value = this.get(key);
      
      if (validator.required && value === undefined) {
        errors.push(`Missing required config: ${key}`);
      }
      
      if (value !== undefined) {
        if (validator.type && typeof value !== validator.type) {
          errors.push(`Invalid type for ${key}: expected ${validator.type}, got ${typeof value}`);
        }
        
        if (validator.enum && !validator.enum.includes(value)) {
          errors.push(`Invalid value for ${key}: must be one of ${validator.enum.join(', ')}`);
        }
        
        if (validator.pattern && !validator.pattern.test(value)) {
          errors.push(`Invalid format for ${key}`);
        }
        
        if (validator.custom && !validator.custom(value)) {
          errors.push(`Invalid value for ${key}`);
        }
      }
    });
    
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }

  export() {
    return JSON.stringify(this.getAll(), null, 2);
  }

  import(configString) {
    try {
      const config = JSON.parse(configString);
      Object.entries(config).forEach(([key, value]) => {
        this.set(key, value);
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}