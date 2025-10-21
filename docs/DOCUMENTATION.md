# Hidden Walnuts Documentation

Welcome to the Hidden Walnuts project documentation. This directory contains comprehensive documentation for the 3D multiplayer game development project.

## 📁 Documentation Structure

### **Core Project Documentation**
- **[Project Structure](PROJECT_STRUCTURE.md)** - Detailed architecture guide and file organization
- **[Game Vision](GameVision.md)** - Game design, features, and technical specifications
- **[MVP Plan](MVP_Plan_Hidden_Walnuts-2.md)** - Development roadmap and milestone planning
- **[Coding Conventions](conventions.md)** - Standards, best practices, and development guidelines
- **[AI Usage Guidelines](README_AI.md)** - AI workflow and contribution guidelines

### **Development Documentation**
- **[Repository Structure](repo_structure.txt)** - Complete file tree of the project

### **MVP-Specific Documentation**
- **[MVP 7 - Multiplayer Foundation](mvp-7/)** - Completed development phase
  - [Overview](mvp-7/README.md) - MVP 7 objectives and status
  - [Completion Summary](mvp-7/COMPLETION_SUMMARY.md) - Completed tasks and achievements
  - [Task Documentation](mvp-7/tasks/) - Individual task specifications and status
- **[MVP 8 - Animated Squirrel Players & NPC Characters](mvp-8/)** - Current development phase
  - [Overview](mvp-8/README.md) - MVP 8 objectives and status
  - [Task Documentation](mvp-8/tasks/) - Individual task specifications and status

## 🎯 Quick Navigation

### **For New Developers**
1. Start with [Game Vision](GameVision.md) to understand the project
2. Review [Project Structure](PROJECT_STRUCTURE.md) for architecture overview
3. Read [Coding Conventions](conventions.md) for development standards
4. Check [MVP Plan](MVP_Plan_Hidden_Walnuts-2.md) for current priorities

### **For Current Development**
1. Review [MVP 8 Overview](mvp-8/README.md) for current status
2. Check [Task Documentation](mvp-8/tasks/) for specific task details
3. Follow [Coding Conventions](conventions.md) for consistency
4. Use [AI Guidelines](README_AI.md) when working with AI tools

### **For Architecture Understanding**
1. [Project Structure](PROJECT_STRUCTURE.md) - Complete architecture guide
2. [Repository Structure](repo_structure.txt) - File organization
3. [MVP 7 Tasks](mvp-7/tasks/) - Implementation details

## 🔄 Documentation Maintenance

### **🚨 CRITICAL: AI Documentation Procedures**

**ALL AI CONVERSATIONS MUST FOLLOW THESE PROCEDURES:**

1. **📁 Use MVP-Based Organization**: All new documentation goes in `docs/mvp-<number>/` directories
2. **📝 Consistent File Naming**: Use `README.md`, `testing.md`, `implementation.md`, `completion.md` for each task
3. **🔄 Update Navigation**: Always update this `DOCUMENTATION.md` with new links
4. **📋 Follow Established Structure**: Never create standalone files in root or random locations
5. **🔗 Link Appropriately**: Cross-reference related documents and maintain navigation

### **When Adding New Documentation**
- **Place MVP-specific docs** in `mvp-<number>/` directories
- **Use consistent naming**: `README.md`, `testing.md`, `implementation.md`, `completion.md`
- **Update this DOCUMENTATION.md** with new links
- **Follow the established structure** and conventions
- **NEVER create documentation in project root** - use `docs/` directory only

### **Documentation Standards**
- **Use clear, descriptive headings**
- **Include code examples** where relevant
- **Maintain consistent formatting**
- **Update status indicators** (✅ COMPLETED, 📋 PENDING, 🔄 IN PROGRESS)
- **Link related documents** appropriately
- **Reference this structure** in all new documentation

## 📊 Current Status

- **Active MVP**: MVP 8 (Animated Squirrel Players & NPC Characters)
- **Current Task**: Task 1 - Animated Squirrel Model
- **Documentation**: Complete and up-to-date
- **Structure**: Organized by MVP and task hierarchy

This documentation structure provides comprehensive coverage of the Hidden Walnuts project while maintaining clear organization and easy navigation for all stakeholders.

## 🚨 CRITICAL: Build Validation & Git Commit Procedures

### **🔧 Build Validation Required**
**After making ANY batch of coding changes:**

1. **Build Client Locally**: `cd client && npm run build:preview`
2. **Build Worker Locally**: `cd workers && npm run build`
3. **Fix ALL TypeScript errors** before proceeding
4. **Only proceed after successful local builds**

### **📝 Git Commit Summary Required**
**After completing ANY batch of changes, provide:**

**Git Commit Summary Format (NO LINE BREAKS):**
```
MVP-7: [Task Number] - [Brief Description] - [Key Changes Made] - [Files Modified]
```

**Examples:**
- `MVP-7: Task 8 - Core Multiplayer Events - Implement player_join/leave events - NetworkSystem.ts, PlayerManager.ts, api.ts`
- `MVP-7: Task 9 - Client Prediction - Add position reconciliation logic - ClientPredictionSystem.ts, MovementSystem.ts`
- `MVP-7: Documentation - Reorganize docs structure - Move files to docs/ directory - docs/DOCUMENTATION.md, README.md`

**Requirements:**
- **NO LINE BREAKS** - Single line for easy copy/paste
- **Include MVP number** - MVP-7, MVP-8, etc.
- **Include task number** - Task 8, Task 9, etc.
- **Brief description** - What was accomplished
- **Key changes** - Main technical changes made
- **Files modified** - Primary files that were changed 