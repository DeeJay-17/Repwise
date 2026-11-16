# 0003. React Native with Expo for the mobile app

- Status: accepted
- Date: 2026-11-16

## Context

The app must run on Android and iPhone from one codebase. The developer is strongest in Python and prefers function-based code to class-based code.

## Decision

Use React Native with Expo (SDK 58), TypeScript in strict mode, and Expo Router for navigation. Builds go through EAS Build. v1 is tested on Android; iPhone builds follow in v2.

## Consequences

Screens are plain functions. Expo handles native configuration and over-the-air updates. Libraries with native code need an Expo development build rather than Expo Go. Flutter was the main alternative; it was set aside because Dart is new to the developer and its widgets are class-based.
