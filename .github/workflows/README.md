# Workflows

## ci.yml

Runs on push/PR to `dev`, `stage`, `main`. Checks: lint, typecheck, build, tests. All four jobs run in parallel.

## release.yml

Manual trigger. Builds the package with `tsup`, publishes to npm as `@utexo/rgb-sdk-core`, and creates a GitHub Release. Input: version (e.g. `0.2.0`). Use from `main` branch for production releases.

## release-dev.yml

Manual trigger. Same build process but publishes with a custom npm tag and version suffix for testing. Inputs: base version + suffix (e.g. `0.2.0` + `test1` → npm version `0.2.0-test1`, npm tag `test1`). Can be triggered from any branch.
