# Wiki Log

2026-04-14 [ingest] Created [[eperm-uv-cwd-bugfix]] — pty 스폰 및 plugin:list EPERM, process.cwd() 검증 수정
2026-04-14 [ingest] Created [[xterm-font-nerd-font]] — Nerd Font 글리프 박스 표시 수정, Symbols NFM 번들링
2026-04-14 [ingest] Created [[workspace-context-menu]] — 우클릭 컨텍스트 메뉴, 인라인 rename, 경로 표시, Show in Finder (PR #38)
2026-04-15 [ingest] Created [[watcher-performance]] — chokidar watcher exclusion Stage 1 도입, Stage 2/3/Phase 2 로드맵
2026-04-15 [ingest] Created [[main-process-cpu-home-watcher-bugfix]] — DMG idle CPU 127% 근본 원인(HOME watcher) 진단 및 workspace-scoped watcher로 해결
2026-04-15 [update] Updated [[watcher-performance]] — HOME 감시 제거 섹션 추가, roadmap 표에 workspace-scoped watcher 완료 항목 반영
2026-04-16 [ingest] Plugin theme auto-inject — protocol.ts AIDE_STYLE_SHIM 주입 + CREATE_PLUGIN_DESC Theme Support 섹션
2026-04-16 [ingest] Plugin on/off state persistence — plugin-store 즉시 saveSession, restoreSession/loadPlugins await
2026-04-16 [update] Partide 리브랜드 아이데이션 기록 [[rebrand-partide]] 작성 (PR #49)
2026-04-17 [ingest] Created [[plugin-scope-local-only]] — 글로벌 플러그인 스코프 완전 제거, .mcp.json 프로젝트 루트 쓰기 제거, 기존 파일 자동 마이그레이션 (PR #53)
2026-04-17 [ingest] Created [[app-settings-persistence]] — 테마 + 윈도우 해상도 저장/복원, aide-app-settings electron-store 추가 (PR #54)
2026-04-22 [ingest] Created [[rust-core-migration]] — promoted from ideation after PRs #90/#91/#92/#93/#94 merged (Phase 0 spike + Phase 1 readTree/fsops/watcher swap)
2026-04-24 [update] Cross-ref cleanup: [[rebrand-partide]] and [[rebrand-wnide]] marked as historical (SUPERSEDED), [[rebrand-smalti]] elevated as current candidate. Bidirectional `related` frontmatter links restored. `rust-core-migration` crate naming discussion updated to reference smalti.
2026-05-02 [ingest] Created [[mcp-server-sandbox-duplication]] — v0.2.2 alias가 sandbox.ts에만 적용되고 server.js에는 빠져 칸반 데이터 안 보인 P0 버그, v0.3.1에서 alias inline 복제 + 동등성 속성 테스트로 회귀 가드 (PR #143, release v0.3.1)
2026-04-24 [update] E4: docs/wiki brand sweep — formerly AIDE brand references migrated to smalti, code identifiers preserved.
2026-04-25 [update] D6 follow-up: renderer-side user-visible strings (Welcome/EmptyState hero `> aide_` → `> smalti_`, TitleBar label, PermissionBanner EPERM message) migrated to smalti. Guard test [[../../tests/unit/brand-renderer-strings.test.ts]] added.
2026-04-25 [update] Live theme application: re-aliased legacy `--background`/`--surface`/`--accent` CSS variables in `global.css` to smalti palette C values for both dark and light. All existing `aide-*` Tailwind classes now render with the new palette without component churn.
2026-04-25 [ingest] Created [[smalti-palette-c-theme]] — token system architecture, `aide-*` ↔ `smalti-*` two-layer mapping, design.pen-based component audit reference.
2026-04-25 [update] Renderer component audit against design.pen — corrected StatusBar (cyan→raised+gold), TitleBar (raised→surface), TabBar active border (cyan→gold), PluginPanel ON button (filled→ghost), WelcomePage (13 inline var() → Tailwind aide-* tokens). Plugin count indicator now always visible.
2026-05-28 [ingest] Created [[pnpm11-settings-location]] — pnpm 11이 nodeLinker/allowBuilds를 pnpm-workspace.yaml에서 읽고 .npmrc는 무시; 절반만 된 v11 마이그레이션이 hoisted 링크를 조용히 깨뜨려 electron-forge를 망가뜨릴 뻔한 환경 함정 진단
2026-05-28 [update] Terminal spawn 옵티미스틱 탭 리팩토링 DA 리뷰 + P1/P2 수정 (미커밋 working tree): buildSavedSession이 spawning/failed 탭 직렬화 제외, spawn 실패 롤백을 removeTabFromPane(pane 파괴)→markTabSpawnFailed로 교체(기존 PaneView 'failed' UI 연결), [spawn-perf] 로깅 SMALTI_SPAWN_PERF env로 debug-gate
