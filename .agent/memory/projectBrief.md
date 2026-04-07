---
name: project-brief
description: Core identity, scope, and constraints for settle
type: project
---

# settle — Project Brief

## Identity
- **Package name**: `settle`
- **Version**: 0.0.1 (pre-release)
- **Author**: Quinn Keaveney / Liiift Studio

## What It Is
On mount, each line is assigned a random letter-spacing offset (±0.04em). Over ~800ms, every line eases toward its optically optimal tracking value. The paragraph looks like a compositor fine-tuning it in real time. Stops when settled. Can combine with gray-value as the target state.

## What It Is Not
- Not a general animation library
- Not a CSS preprocessor
- Not a font loading utility

## API Surface (target)
Options: spread, duration, easing, target, stagger

## Constraints
- Framework-agnostic core (vanilla JS)
- Optional React bindings (peer deps)
- SSR safe (guard typeof window)
- Zero required dependencies (opentype.js optional)
- TypeScript strict mode

## Status
Bootstrap complete. Algorithm not yet implemented.
See PROCESS.md for the build guide.
