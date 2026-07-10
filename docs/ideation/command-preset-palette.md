# 커맨드 프리셋 팔레트 (Command Preset Palette) — 기획 · 스펙 · Goal

> 작성: 2026-07-10 · 브랜치: `feature/command-preset-palette-spec` · 상태: 스펙 확정, 구현 대기
> 관련: `spec/PRD.md` (F8 후보), `spec/UI-SPEC.md` §13 (테마 토큰), `spec/TRD.md` (IPC 계약)

---

## 1. 요약 (Executive Summary)

터미널 탭을 열 때 미리 등록한 명령어(`lazygit`, `npm run dev`, `htop` 등)를 즉시 실행하며
여는 기능. VSCode 명령 팔레트와 유사한 **⌘P 오버레이**로 프리셋을 검색·실행한다.

- 기존 spawn 파이프라인(`window.aide.terminal.spawn → addTab → addTabToPane`)을 그대로 재사용
- **신규 IPC 채널 0개** — `TerminalSpawnOptions` 확장 + `app-settings` 채널 재사용
- 프리셋은 electron-store 글로벌 저장, 워크스페이스 스코프는 P2
- 세션 복원 시 프리셋 탭은 동일 명령을 재실행

---

## 2. 배경과 문제

- smalti는 터미널 중심 IDE지만, 반복 사용하는 보조 도구(lazygit, htop, dev 서버)를
  열려면 매번 `⌘T → 명령 타이핑`이 필요하다.
- 에이전트(Claude/Gemini/Codex)는 `⌘1/2/3` 단축키와 AgentDropdown으로 원터치 실행이
  가능한데, 사용자 정의 명령에는 대응 수단이 없다 — 기능 비대칭.
- `App.tsx`의 `AGENT_SHORTCUTS` 흐름(`spawn({ shell: command }) → addTab`)이 이미
  "명령어로 탭 열기"의 선례. 이를 일반화·사용자 정의 가능하게 만드는 것이 이 기능이다.

## 3. 기능 정의 (뼈대)

### 3.1 사용자 스토리

1. 사용자가 `⌘P`를 누르면 화면 중앙 상단에 팔레트 오버레이가 열린다.
2. `laz` 타이핑 → 프리셋 "LazyGit"이 필터링되어 최상단 선택.
3. `Enter` → 포커스된 pane에 새 탭이 열리고 lazygit이 워크스페이스 루트에서 즉시 실행.
4. 팔레트의 "프리셋 관리…"에서 이름/명령/작업 디렉토리를 추가·편집·삭제.

### 3.2 MVP 스코프

| # | 항목 | 내용 |
|---|------|------|
| 1 | 데이터 모델 | `CommandPreset { id, name, command, cwd? }` |
| 2 | 저장 | `AppSettings.commandPresets` (electron-store, 글로벌) |
| 3 | spawn 확장 | `TerminalSpawnOptions.command` — 로그인 셸 래핑 실행 |
| 4 | 팔레트 UI | `⌘P` 오버레이: 검색 + 프리셋 + 빌트인(에이전트 3종/셸) + 액션 |
| 5 | 프리셋 관리 | 팔레트 진입 다이얼로그에서 CRUD |
| 6 | 세션 복원 | `SavedTab.presetId` — 복원 시 프리셋 명령 재실행 |

### 3.3 비스코프 (P2 이후)

- 프리셋별 사용자 단축키 (`⌘4~9`)
- AgentDropdown(⌘T) 내 프리셋 섹션 노출
- 워크스페이스 스코프 프리셋 (`.smalti/presets.json`)
- 프리셋 아이콘 선택, `closeOnExit`(명령 종료 시 탭 자동 닫기) 옵션
- 팔레트의 IDE 액션 확장 (탭 전환, split 등 — 진짜 "명령 팔레트"화)

## 4. 아키텍처 설계

### 4.1 데이터 모델 (`src/types/ipc.ts`)

```ts
export interface CommandPreset {
  id: string;        // crypto.randomUUID()
  name: string;      // 팔레트 표시명, 탭 타이틀로 사용. e.g. "LazyGit"
  command: string;   // 셸에서 실행할 명령. e.g. "lazygit", "npm run dev"
  cwd?: string;      // 워크스페이스 루트 기준 상대 경로 (선택)
}
```

- `icon`, `keybinding` 등은 넣지 않는다 (YAGNI, P2에서 논의).
- 이름 중복 허용 — 식별은 `id`.

### 4.2 저장 — AppSettings 확장

`src/main/ipc/app-settings-handlers.ts`:

```ts
export interface AppSettings {
  theme: 'dark' | 'light';
  windowBounds: ... | null;
  commandPresets: CommandPreset[];   // 추가, defaults: []
}
```

- 기존 `APP_SETTINGS_GET` / `APP_SETTINGS_SET` 채널 재사용 → **신규 채널 불필요**.
- 렌더러 `preset-store`(Zustand)가 시작 시 로드, CRUD 시 배열 전체를 set.
- 단일 윈도우 앱이므로 동시 쓰기 경합 없음.

### 4.3 spawn 확장 — 셸 래핑 실행

현재 `spawnPty(shell, args, ...)`는 `options.shell`을 **바이너리로 직접 exec**한다
(셸 미경유). 프리셋 명령은 `npm run dev`, `git log | less` 같은 복합 명령을 지원해야
하므로 **로그인 셸 래핑**으로 실행한다.

`src/types/ipc.ts`:

```ts
export interface TerminalSpawnOptions {
  shell?: string;
  cwd?: string;
  agentType?: 'claude' | 'gemini' | 'codex' | 'shell';
  resumeSessionId?: string;
  continueSession?: boolean;
  command?: string;   // 추가 — 기본 셸이 -ilc로 실행할 명령 문자열
}
```

`src/main/ipc/terminal-handlers.ts` 분기 (기존 `shell` 결정부 바로 다음):

```ts
// options.command가 있으면 로그인 셸로 래핑 (rc/PATH/alias 로드)
// macOS/Linux: zsh|bash -ilc "<command>"
// Windows:     powershell -NoLogo -Command "<command>"
if (options?.command) {
  shell = defaultShell;
  spawnArgs = process.platform === 'win32'
    ? ['-NoLogo', '-Command', options.command]
    : ['-ilc', options.command];
}
```

- `-i`(interactive) + `-l`(login)로 `.zshrc`/`.zprofile`이 로드되어 사용자 PATH·alias가
  적용된다. Homebrew 설치 도구(`/opt/homebrew/bin/lazygit`)가 그대로 잡힌다.
- 우선순위: `agentType` > `command` > `shell` (agentType과 command 동시 지정은 무시,
  command 우선 아님 — 프리셋은 항상 `agentType` 없이 호출).
- 명령 종료 시 pty가 종료된다. 렌더러의 기존 셸 탭 동작과 동일하게 처리 (별도 이벤트
  없음 — MVP). 탭 자동 닫기는 P2 `closeOnExit`.

### 4.4 Renderer 구조

```
src/renderer/stores/preset-store.ts               # Zustand: presets[], paletteOpen, CRUD 액션
src/renderer/components/palette/CommandPalette.tsx      # ⌘P 오버레이
src/renderer/components/palette/PresetManagerDialog.tsx # 관리 다이얼로그 (CRUD)
```

- **preset-store**: `loadPresets()`(앱 시작 시), `addPreset/updatePreset/removePreset`
  (모두 `set()` 액션 — 스냅샷 변이 금지), `openPalette/closePalette`.
- **⌘P 핸들러**: `App.tsx` 기존 keydown 핸들러에 추가. `activeWorkspaceId` 없으면
  no-op (⌘1/2/3과 동일 가드). `⌘K`는 터미널 clear 관습과 충돌하므로 사용하지 않는다.
- **실행 흐름** (기존 패턴 그대로 — 탭 생성 전에 spawn 먼저):

```ts
const result = await window.aide.terminal.spawn({ command: preset.command, cwd: resolvedCwd });
// result.ok 확인 후
const tab = { id: crypto.randomUUID(), type: 'shell' as const, presetId: preset.id,
              sessionId, title: preset.name };
useTerminalStore.getState().addTab(tab);
useLayoutStore.getState().addTabToPane(focusedPane.id, tab);
```

- `TerminalTab`에 `presetId?: string` 추가. `type`은 `'shell'` 유지 — 새 타입 추가 시
  PaneView/TabBar 분기 리플이 크므로 최소 변경.
- `resolvedCwd` = `preset.cwd`가 있으면 `ws.path + '/' + preset.cwd`, 없으면 `ws.path`.
  main의 기존 `fs.existsSync` 폴백이 잘못된 경로를 흡수한다.
- **fuzzy 매칭**: 대소문자 무시 subsequence 매칭 (`name` + `command` 대상).
  `src/renderer/utils/file-search.ts`의 기존 매처 재사용 가능 여부 우선 검토, 불가하면
  `utils/fuzzy-match.ts` 신설 (외부 의존성 추가 금지).

### 4.5 세션 복원

- `SavedTab`에 `presetId?: string` 저장 (session-handlers 직렬화 경로).
- `layout-store`의 `restoreSession`: `presetId`가 있으면 현재 `commandPresets`에서
  조회 → 존재 시 `spawn({ command, cwd })`로 재실행, 삭제된 프리셋이면 일반 셸 탭으로
  폴백 (타이틀은 저장된 값 유지).

### 4.6 변경 파일 요약

| 레이어 | 파일 | 변경 |
|--------|------|------|
| types | `src/types/ipc.ts` | `CommandPreset`, `TerminalSpawnOptions.command`, `TerminalTab.presetId`, `SavedTab.presetId` |
| main | `src/main/ipc/app-settings-handlers.ts` | `commandPresets` 키 + defaults |
| main | `src/main/ipc/terminal-handlers.ts` | `command` 셸 래핑 분기 |
| main | `src/main/ipc/session-handlers.ts` | `presetId` 직렬화 (필드 통과 확인) |
| preload | `src/preload/index.ts` | 변경 없음 (옵션 객체 passthrough) |
| renderer | `preset-store.ts` (신규), `CommandPalette.tsx` (신규), `PresetManagerDialog.tsx` (신규), `App.tsx` (⌘P), `layout-store.ts` (복원) | 위 참조 |

## 5. UI/UX 스펙 (디자인 브리프)

> 토큰은 UI-SPEC **§13 (Palette C — Hacker-Byzantine Hybrid)** 기준. §6의 emerald 값은
> 리브랜드 이전 레거시이므로 사용 금지.
>
> **목업 완료** (2026-07-10, `docs/design/design.pen`): `smalti — Command Palette (Hybrid)`
> `iPz7H` / `(Hybrid · Light)` `b0EBR` / `Preset Manager (Hybrid)` `RBXhj` /
> `Preset Edit (Hybrid)` `e94iKi`. 구현 시 이 프레임들을 기준으로 한다.
> ↵ 기호는 폰트 글리프 부재로 lucide `corner-down-left` 아이콘 사용.

### 5.1 커맨드 팔레트 오버레이 (⌘P)

```
┌─ Backdrop: #000000 40%, 클릭 시 닫힘 ─────────────────────┐
│        ┌─ Palette: w 560, 상단에서 12% 지점 ──────────┐   │
│        │ 🔍  프리셋 검색…                        esc │   │  ← 검색줄 h44
│        │─────────────────────────────────────────────│   │
│        │ PRESETS                                     │   │  ← 섹션 라벨 11px
│        │ ▎⚡ LazyGit              lazygit          ↵ │   │  ← 선택 행 (3-layer)
│        │   ⚡ Dev Server           npm run dev       │   │
│        │ NEW TAB                                     │   │
│        │   ● Claude   ● Gemini   ● Codex   ○ Shell  │   │  ← 빌트인 행 (agent color dot)
│        │ ACTIONS                                     │   │
│        │   ＋ 프리셋 추가…      ⚙ 프리셋 관리…      │   │
│        │─────────────────────────────────────────────│   │
│        │ ↑↓ 이동 · ↵ 열기 · esc 닫기                │   │  ← 힌트 바 h28
│        └─────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

| 요소 | 스펙 |
|------|------|
| 컨테이너 | w 560 / max-h 420, bg Raised `#1B1E2A`, border 1px `#2A2E3D`, radius 10, shadow `0 8 28 #00000040` |
| 검색줄 | h 44, padding 0 16, search 아이콘 16px muted, input JetBrains Mono 14 `#E6E7ED`, placeholder muted `#9BA0B0`, 우측 `esc` 뱃지 |
| 섹션 라벨 | 11px uppercase letter-spacing 0.08em, `#9BA0B0` — `PRESETS` / `NEW TAB` / `ACTIONS` |
| 항목 행 | h 36, padding 0 12. 좌: 아이콘 16px (프리셋 = terminal 아이콘 Cyan `#4FB3BF`, 에이전트 = 기존 agent color dot). 이름 13px `#E6E7ED`. 우: command 미리보기 12px mono `#9BA0B0` truncate |
| 선택 행 | **3-layer 표준** (§13.2): 좌측 3px Cyan bar + Cyan 10% tint 배경 (`bg-smalti-cyan/10`) |
| 힌트 바 | h 28, border-top 1px, 11px `#9BA0B0` |
| 결과 없음 | "일치하는 항목이 없습니다" + "＋ 프리셋 추가…" 행은 항상 유지 |
| 라이트 모드 | §13.1 라이트 컬럼 대응값 사용 |

### 5.2 프리셋 관리 다이얼로그

- `BaseDialog`(plugin/registry/dialogs) 패턴 재사용, w 480.
- **목록 모드**: 행 = 이름(13px mono) + 명령(12px muted) + 편집/삭제 아이콘 버튼.
  하단 `＋ 새 프리셋` 버튼 (Cyan primary — §13.2 Glass Cyan은 primary action 전용).
- **편집 모드**: 필드 `Name*`, `Command*`, `Working Directory`(워크스페이스 상대, 선택)
  + Cancel / 저장. name·command 공백이면 저장 비활성.
- 삭제는 즉시 실행 (undo 없음, MVP). 위험 액션 색은 Crimson `#F10C45` 아이콘만.

### 5.3 키보드 인터랙션

| 키 | 동작 |
|----|------|
| `⌘P` / `Ctrl+P` | 팔레트 토글 (Terminal Page + 활성 워크스페이스 필수) |
| `↑` `↓` | 항목 이동 (섹션 경계 넘어 순환) |
| `Enter` | 선택 항목 실행 → 포커스된 pane에 새 탭, 팔레트 닫힘 |
| `Esc` / 백드롭 클릭 | 닫기 |
| 타이핑 | 즉시 필터 (검색 인풋 자동 포커스, 포커스 트랩) |

## 6. 엣지 케이스 및 결정 사항

| 케이스 | 결정 |
|--------|------|
| 명령 즉시 종료 (`git status` 등 oneshot) | pty 종료, 탭은 기존 셸 탭과 동일하게 잔류 (MVP). P2 `closeOnExit` |
| 명령 미설치 (`lazygit` 없음) | 셸이 `command not found`를 터미널에 출력 — 자연스러운 피드백, 에러 다이얼로그 불필요 |
| `preset.cwd` 경로 미존재 | main의 기존 `existsSync` 폴백 (home) 적용. 렌더러는 ws.path 기준 결합만 담당 |
| 프리셋 0개 | 팔레트에 빌트인 + `＋ 프리셋 추가…` 유도 |
| Welcome Page에서 ⌘P | no-op (활성 워크스페이스 가드) |
| 세션 복원 시 프리셋 삭제됨 | 일반 셸 탭 폴백, 저장된 타이틀 유지 |
| xterm 키 충돌 | 팔레트는 window-level keydown (기존 App.tsx 핸들러와 동일 레벨), 열림 중 input 포커스 트랩 |

## 7. 보안 검토

- 렌더러는 이미 `spawn({ shell })`로 임의 바이너리 실행이 가능하다 — `command` 옵션은
  **동일 신뢰 경계 내 확장**이며 새로운 공격 표면을 만들지 않는다.
- 프리셋은 사용자가 로컬에서 직접 등록한 문자열만 실행된다. 원격 소스 없음.
- `contextIsolation`/preload 경계 변경 없음.

## 8. 테스트 전략 (TDD — 테스트 먼저)

| 대상 | 파일 (신규) | 검증 |
|------|------------|------|
| AppSettings 확장 | `tests/unit/app-settings.test.ts` (기존 확장) | `commandPresets` defaults `[]`, get/set 왕복 |
| spawn 래핑 | `tests/unit/terminal-spawn-command.test.ts` | `command` 옵션 → `[-ilc, cmd]` / win32 `[-NoLogo, -Command, cmd]` args, agentType 우선순위 |
| fuzzy 매칭 | `tests/unit/fuzzy-match.test.ts` | subsequence 대소문자 무시, name+command 매칭, 스코어 순 |
| preset-store | `tests/unit/preset-store.test.ts` | CRUD가 `set()` 경유, IPC mock 왕복 |
| 팔레트 컴포넌트 | `tests/unit/command-palette.test.tsx` | 렌더/필터/↑↓/Enter → spawn 호출 (기존 `fork-dialog.test.tsx` 패턴) |
| 세션 복원 | `tests/unit/session-preset-restore.test.ts` | presetId 재실행 / 삭제 시 폴백 |

## 9. 구현 단계

| Phase | 내용 | verify |
|-------|------|--------|
| 0 | ~~design.pen 목업~~ — **완료** (§5 참조, 프레임 4개) | 스크린샷 검증 완료 |
| 1 | 타입 + AppSettings + spawn `command` 래핑 (main) | Phase 1 테스트 green |
| 2 | preset-store + CommandPalette + ⌘P + spawn 연동 | 테스트 green + 수동: ⌘P→lazygit 탭 |
| 3 | PresetManagerDialog CRUD | 테스트 green + 수동: 추가→실행→삭제 |
| 4 | 세션 복원 presetId | 테스트 green + 수동: 재시작 후 재실행 |
| 5 | `pnpm lint && pnpm test` 전체 green, UI-SPEC 추가 섹션 초안 | CI 통과 |

## 10. Goal 프롬프트 (구현 세션용)

아래 프롬프트를 구현 세션에 그대로 입력한다.

```
smalti에 "커맨드 프리셋 팔레트" 기능을 구현해줘.
스펙: docs/ideation/command-preset-palette.md (이 문서가 유일한 요구사항 소스, 스코프 §3.2 준수 — §3.3 비스코프 절대 구현 금지)

Goal (각 단계는 완료 조건이 검증되어야 다음으로 진행):

1. [타입/저장/spawn — main]
   - src/types/ipc.ts에 CommandPreset, TerminalSpawnOptions.command,
     TerminalTab.presetId, SavedTab.presetId 추가
   - AppSettings에 commandPresets (defaults []) 추가
   - terminal-handlers.ts에 command 셸 래핑 분기 (스펙 §4.3 코드 그대로,
     우선순위 agentType > command > shell)
   → verify: 테스트 먼저 작성(스펙 §8 표의 Phase 1 항목) 후 실패 확인 → 구현 → green

2. [팔레트 UI — renderer]
   - preset-store.ts (Zustand — 스냅샷 변이 금지, 모든 변경 set() 액션),
     CommandPalette.tsx (스펙 §5.1 토큰·치수), App.tsx ⌘P 핸들러
     (activeWorkspaceId 가드, 기존 keydown 핸들러에 추가)
   - 실행 흐름: spawn 먼저 → sessionId 확보 → addTab → addTabToPane
     (CLAUDE.md "Spawn pty BEFORE creating the tab" 함정 준수)
   → verify: fuzzy-match·preset-store·command-palette 테스트 green
   → verify: 수동 — 프리셋 "LazyGit"/"lazygit" 등록 후 ⌘P → Enter → lazygit 탭 열림

3. [프리셋 관리 — renderer]
   - PresetManagerDialog.tsx (BaseDialog 패턴, 스펙 §5.2)
   → verify: 팔레트에서 추가→목록 반영→편집→삭제 전체 수동 확인

4. [세션 복원]
   - session-handlers/layout-store에 presetId 통과, 복원 시 재실행/폴백 (스펙 §4.5)
   → verify: 복원 테스트 green + 앱 재시작 수동 확인

5. [마감]
   → verify: pnpm lint && pnpm test 전체 통과 (PR 전 test 필수)
   → PR 제목/본문 영어, base는 develop

주의사항:
- 신규 IPC 채널 금지 — 기존 채널 재사용이 이 설계의 핵심
- 신규 외부 의존성 금지 (fuzzy 매칭은 file-search.ts 재사용 검토 후 자체 구현)
- Zustand 셀렉터에서 새 배열/객체 반환 금지 (CLAUDE.md pitfall)
- UI 색상은 UI-SPEC §13 토큰만 사용 (§6 emerald 값 금지)
```

---

*P2 백로그와 팔레트의 IDE 액션 확장(진짜 명령 팔레트화)은 MVP 검증 후 별도 이터레이션에서 재논의.*
