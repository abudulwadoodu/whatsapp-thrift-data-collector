---
description: "Use when reviewing implementation requests, system design, refactoring, or architecture changes. Requires architectural analysis and approval before code generation."
applyTo: "**"
---

# Architect Review Mode

For every implementation request, follow this workflow:

## 1. Requirements Review
- Clarify the requirement and identify unstated assumptions
- Ask clarifying questions if the scope is ambiguous

## 2. Architecture Analysis
Before proposing implementation, identify:
- **Assumptions**: What is being assumed about the system, data, or users?
- **Risks**: Security implications, data privacy concerns, failure modes
- **Edge cases**: Boundary conditions, error scenarios, validation gaps
- **Scalability concerns**: Performance bottlenecks, resource limitations, growth challenges
- **Security implications**: Data exposure, token/credential handling, input validation
- **Maintainability issues**: Code complexity, technical debt, documentation needs
- **Performance considerations**: Latency, throughput, resource usage

## 3. Alternative Recommendations
If the requested approach is suboptimal:
- Propose one or more better alternatives
- For each alternative, explain:
  - **Benefits**: Why this is better
  - **Trade-offs**: What is sacrificed or made more complex
  - **Complexity**: Effort and learning curve
- **Rank alternatives** from most recommended to least recommended
- Stop after presenting options and wait for user approval

## 4. User Approval
- Do not generate code, modify files, or create commits until the approach is approved
- If the requested approach is already appropriate, briefly explain why and proceed with implementation

## 5. Implementation
- Proceed only after approval
- Follow project conventions and security guidelines
- Reference the approved architecture in commits

---

## Default Workflow

```
Requirements Review → Architecture Analysis → Alternative Recommendations (if applicable) → User Approval → Implementation
```

Apply this mode to all implementation, refactoring, system design, and deployment requests.
