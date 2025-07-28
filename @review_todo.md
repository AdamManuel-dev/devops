# Code Review Todo List

## Main Review Orchestrator (commands/review)

### Critical Issues
- **Line 158, 215-222, 267-271, 325-329**: Shell script calls `claude -p "$prompt"` which may fail if claude command is not available or properly configured
- **Lines 348, 364, 370, 375**: Hardcoded notification script paths assume specific user directory structure
- **Lines 214-227**: Parallel process execution with `&` and `wait` lacks proper error handling for individual process failures
- **Line 351-360**: Hardcoded commit message format may not follow project conventions

### Improvements Needed
- Add error handling for missing claude command
- Make notification script paths configurable via environment variables
- Improve parallel process error reporting
- Add validation for git repository state before operations
- Add configurable commit message templates
- Implement proper logging instead of echo statements
- Add input validation for directory and git command parameters

## Reviewer Documentation Files

### reviewer-basic.md

#### Strengths
- Clear scope definition and execution instructions
- Good examples of common issues with before/after code samples
- Proper failure conditions and success criteria

#### Issues to Address
- **Line 20-22**: Example shows hardcoded logger import path that may not exist in all projects
- **Line 32-33**: ESLint disable comment format may vary between projects
- **Lines 86-101**: Response format template is good but could include more actionable next steps
- Missing examples for handling different file types (JSON, YAML, etc.)
- No guidance on handling legacy code vs new code differently

### reviewer-quality.md

#### Strengths
- Comprehensive TypeScript best practices with detailed examples
- Good coverage of async/await, error handling, and type safety
- Clear before/after code comparisons

#### Issues to Address
- **Lines 56-76**: Custom error class example lacks proper error chaining patterns
- **Lines 93-108**: Async function example could show better retry logic
- **Lines 180-189**: Type guard example is basic - could show more complex scenarios
- Missing guidance on performance implications of suggested patterns
- No coverage of React-specific quality patterns despite mention in global instructions
- Examples assume specific dependencies (html-escaper, express-validator) that may not be available

### reviewer-security.md

#### Strengths
- Excellent coverage of common security vulnerabilities
- Practical examples of SQL injection, XSS, and authentication issues
- Good progression from basic to advanced security concepts

#### Issues to Address
- **Lines 23-42**: Express.js specific examples may not apply to all projects
- **Lines 135-169**: JWT implementation example lacks refresh token handling
- **Lines 186-191**: CORS configuration assumes specific environment setup
- Missing guidance on handling different authentication methods (OAuth, API keys, etc.)
- No coverage of client-side security considerations
- Examples assume Node.js/Express stack - not framework agnostic

### reviewer-readability.md

#### Strengths
- Clear focus on practical readability improvements
- Good examples of naming conventions and code structure
- Appropriate balance between examples and explanations

#### Issues to Address
- **Lines 52-58**: Magic number constants example could show enum usage for related constants
- **Lines 114-122**: JSDoc example is minimal - could show more comprehensive documentation patterns
- Missing guidance on code organization at module/file level
- No coverage of README or project documentation improvements
- Examples don't address framework-specific naming conventions (React, Vue, etc.)

## Cross-File Issues

### Consistency Problems
- Different code style examples across files (some use semicolons inconsistently)
- Varying levels of TypeScript strictness in examples
- Inconsistent error handling patterns between security and quality reviewers

### Missing Integration
- No clear workflow for how the different reviewers interact
- Overlapping concerns between quality and readability reviewers
- Security reviewer doesn't reference quality patterns for secure coding

### Configuration Dependencies
- All reviewers assume specific tooling (ESLint, TypeScript, specific libraries)
- No guidance on adapting recommendations to different project setups
- Missing environment-specific considerations (dev vs prod)

## Action Items Priority

### High Priority
1. Fix shell script error handling and dependency validation
2. Make hardcoded paths configurable
3. Add framework-agnostic examples to all reviewer docs
4. Standardize code style across all examples

### Medium Priority
1. Add more comprehensive error handling examples
2. Include React/frontend specific guidance
3. Add configuration sections to each reviewer
4. Improve integration between different review stages

### Low Priority
1. Enhance JSDoc examples with more comprehensive patterns
2. Add performance considerations to quality reviewer
3. Include legacy code handling guidance
4. Add project documentation improvement guidelines