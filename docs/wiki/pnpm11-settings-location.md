---
title: "pnpm 11 설정 위치: pnpm-workspace.yaml이 .npmrc보다 우선"
category: environment
tags: [pnpm, build, electron-forge, node-linker, allowBuilds, gotcha]
created: 2026-05-28
updated: 2026-05-28
related: [[plugin-scope-local-only]]
---

# pnpm 11 설정 위치: pnpm-workspace.yaml이 .npmrc보다 우선

## 핵심 사실

pnpm 11은 `nodeLinker`와 빌드 승인 목록을 **`pnpm-workspace.yaml`에서 읽으며, `.npmrc`의 동등 설정은 무시한다.** 두 가지가 v10→v11에서 바뀌었다:

| 설정 | pnpm ≤10 (legacy) | pnpm 11 (현재) |
|------|-------------------|----------------|
| node linker | `.npmrc` → `node-linker=hoisted` | `pnpm-workspace.yaml` → `nodeLinker: hoisted` |
| 빌드 스크립트 승인 | `package.json` → `pnpm.onlyBuiltDependencies: [...]` (array) | `pnpm-workspace.yaml` → `allowBuilds: {pkg: true}` (map) |

`onlyBuiltDependencies` / `neverBuiltDependencies` / `ignoredBuiltDependencies`는 v11에서 **제거**되고 `allowBuilds`(map of `pkg → boolean`)로 통합됐다. `pnpm approve-builds`는 이제 `pnpm-workspace.yaml`의 `allowBuilds`에 기록한다.

## 어떻게 드러났나 (증상)

`pnpm-workspace.yaml`에서 `nodeLinker: hoisted` 한 줄을 지웠더니 — `.npmrc`에 `node-linker=hoisted`가 그대로 있는데도 —

```bash
pnpm config get node-linker   # → undefined  (지우기 전엔 hoisted)
```

즉 지우기 전 `hoisted`는 **`.npmrc`가 아니라 yaml의 `nodeLinker`에서 온 값**이었다. 게다가 pnpm 11은 `verifyDepsBeforeRun`로 인해 `pnpm lint` 같은 스크립트 실행 시에도 package.json 변경을 감지하면 **자동 재설치**하는데, `nodeLinker`가 빠진 상태로 재설치되면 node_modules가 **isolated(symlink) 레이아웃으로 재링크**된다. electron-forge는 hoisted를 요구하므로 빌드/패키징이 깨진다.

`pnpm config get`은 인식하는 키만 값을 반환한다 — 진단에 유용:
```bash
pnpm config get node-linker      # hoisted   (yaml nodeLinker에서)
pnpm config get allowBuilds      # {electron: true, ...}  (yaml에서)
pnpm config get onlyBuiltDependencies  # undefined  (v11에서 죽은 키)
```

## 권장 구성 (이 repo)

- **`pnpm-workspace.yaml`** = authoritative. `nodeLinker: hoisted` + `allowBuilds` map. macOS 빌드용 `fs-xattr`/`macos-alias`도 여기 포함해야 한다(누락 시 DMG 빌드에서 네이티브 빌드가 조용히 무시됨).
- **`.npmrc`** = `node-linker=hoisted` 유지. pnpm 11은 무시하지만 pnpm <11 / 타 툴 호환 + 문서 일관성 위해 남긴다(harmless 중복).

## 함정 요약

1. pnpm 11에서 빌드/링크 설정을 바꿀 땐 **`pnpm-workspace.yaml`을 먼저 보라.** `.npmrc`만 고치면 효과 없다.
2. `package.json`의 `pnpm.onlyBuiltDependencies`는 v11에서 **dead config**다 — 거기에 패키지를 추가해도 무시된다.
3. 설정 변경 후 `pnpm config get <key>`로 실제 해석값을 확인하고, `pnpm install`로 레이아웃을 reconcile하라.
