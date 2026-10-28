# PRD — 2D Workspace HUD Layer, Floating Islands, and Enterprise Task/Note Inbox

> **Product & UI Design Specification (Frontend HUD)** · IntegrarTEC 2026
> **Status:** Validated v2 Design (Google Workspace / Gmail Enterprise Aesthetic + Full-Screen Dismissible Fixed Modals).

Every member of a virtual office needs to **navigate options from clean floating islands, manage their tasks and notes in an enterprise inbox (Google Workspace / Gmail aesthetic), receive clear notifications of who sent an item (along with its priority and type), and assign a task or note to a teammate from the live presence list or by clicking their 3D avatar**, with fixed modal panels that can be dismissed by clicking anywhere outside on the screen.

---

## 1. Scope and Explicit Boundaries

This PRD defines the **2D HUD interface elements rendered simultaneously over the 3D scene** in [`ReceptionPreview.tsx`](../../src/features/world/ReceptionPreview.tsx).

| Area | In Scope (this PRD) | Out of Scope (not modified in this phase) |
|---|---|---|
| **Top Navigation (`TopNavbarIslands`)** | **Perimeter floating islands** with clean SVG iconography and user monograms: context island (Office/Room), center island (`Bandeja` + `Dejar tarea / nota`), and right island (`Presentes` + Profile/Status). | External login/registration screens or global account administration. |
| **Enterprise Inbox (`TaskHudMenu`)** | **Fixed on-screen modal** (closable by clicking anywhere outside the panel, pressing `✕`, or pressing `Escape`), with a **Gmail-style tabular view**, separate tabs (`Tareas` \| `Notas`), filters, status transitions, and **Archive / Delete** actions. | Drag-and-drop Kanban board columns and custom column configuration (`RF-TAR-007`). |
| **Incoming Notification (`TaskNotificationBanner`)** | **Live enterprise toast** when a new item arrives, displaying **sender (with initial monogram)** and **whether it is a Note or Task + its priority** (`Alta`, `Media`, `Baja`). | Email notifications (`RF-NOT-006`). |
| **Compose Modal (`LeaveItemPopover`)** | **Fixed Gmail-style "Compose" modal**, closable by clicking anywhere outside on the screen, triggered **by selecting a connected user in the top bar** or **by clicking their 3D avatar in the reception** ([`RemotePlayer.tsx`](../../src/features/network/RemotePlayer.tsx)). | Persistent PostgreSQL attachment storage (currently synchronized in real time via Socket.IO and local storage). |
| **Existing Modals & Overlays** | Visual and spatial coexistence with the current HUD. | **Unchanged in this phase:** `.join-modal` ([`ChatOverlay.tsx`](../../src/features/network/ChatOverlay.tsx)), `.reception-dialog` ([`ReceptionPreview.tsx`](../../src/features/world/ReceptionPreview.tsx)), and core chat message delivery. |

### Traceability with Functional Requirements (ERS) and Project Rules

| HUD Module / Component | ERS Requirements ([`functional-requirements.md`](../functional-requirements.md)) | User Stories ([`user-stories.md`](../user-stories.md)) | Authoritative Rules ([`rules/`](../../rules/README.md)) |
|---|---|---|---|
| **Navigation Islands (`TopNavbarIslands`)** | `RF-HAB-009`, `RF-MUN-010`, `RF-MUN-012`, `RF-NOT-001`, `RF-AUT-004` | `HU-HAB-009`, `HU-MUN-010`, `HU-MUN-012`, `HU-AUT-004` | [`ui-and-accessibility.md`](../../rules/ui-and-accessibility.md), [`rooms-and-permissions.md`](../../rules/rooms-and-permissions.md) |
| **Gmail-Style Fixed Inbox (`TaskHudMenu`)** | `RF-TAR-001`, `RF-TAR-003`, `RF-TAR-004`, `RF-TAR-005`, `RF-TAR-006`, `RF-TAR-009`, `RF-TAR-010`, `RF-TAR-012`, `RF-TAR-013` | `HU-TAR-001` to `HU-TAR-013` | [`tasks-and-productivity.md`](../../rules/tasks-and-productivity.md), [`state-management.md`](../../rules/state-management.md) |
| **Incoming Notification (`TaskNotificationBanner`)** | `RF-NOT-001`, `RF-NOT-002`, `RF-NOT-003`, `RF-NOT-005` | `HU-NOT-001` to `HU-NOT-005` | [`error-handling-and-feedback.md`](../../rules/error-handling-and-feedback.md), [`ui-and-accessibility.md`](../../rules/ui-and-accessibility.md) |
| **Compose Task / Note (`LeaveItemPopover`)** | `RF-TAR-002`, `RF-TAR-008`, `RF-OBJ-001` | `HU-TAR-002`, `HU-TAR-008` | [`forms-and-validation.md`](../../rules/forms-and-validation.md), [`security.md`](../../rules/security.md) |
| **HUD + 3D Scene Coexistence** | `RF-MUN-001` to `RF-MUN-004`, `RF-MUN-013` | `HU-MUN-001` to `HU-MUN-004` | [`movement-and-interactions.md`](../../rules/movement-and-interactions.md), [`art-direction.md`](../../rules/art-direction.md), [`architecture.md`](../../rules/architecture.md) |

---

## 2. Screen Layout and Fixed Modal Architecture

### 2.1 Google Workspace / Gmail Style Fixed Inbox (`TaskHudMenu`)

When the user opens the **Inbox (`Bandeja`)**, the panel renders as a **fixed modal container on screen** over a full-viewport dismissible backdrop (`inset: 0`). Clicking **anywhere outside the container** (or pressing `✕` / `Escape`) closes the inbox and returns direct focus to the 3D scene.

```text
+--------------------------------------------------------------------------------------------------+
|                        (Clicking anywhere outside the panel closes the modal)                    |
|     +--------------------------------------------------------------------------------------+     |
|     |  Bandeja de Recepción                    [Vista: Activas v] [Prioridad: Todas v] [✕] |     |
|     |--------------------------------------------------------------------------------------|     |
|     |  Tareas (2)            Notas (1)                                  + Nueva asignación |     |
|     |======================================================================================|     |
|     |  [L]  Luis     [Alta]   Revisar colisiones del mostrador — Confirmar que el radio... |     |
|     |       -> Equipo         Vence 2026-10-29         [ En curso v ]     [ Archivar ]     |     |
|     |--------------------------------------------------------------------------------------|     |
|     |  [A]  Agus     [Media]  Validar contraste de tarjetas — Verificar lectura de...      |     |
|     |       -> Equipo         Vence 2026-10-30         [ Pendiente v ]    [ Archivar ]     |     |
|     +--------------------------------------------------------------------------------------+     |
+--------------------------------------------------------------------------------------------------+
```

### Input Arbitration Contract

Following [`movement-and-interactions.md`](../../rules/movement-and-interactions.md) and [`ui-and-accessibility.md`](../../rules/ui-and-accessibility.md):

1. **Full-Screen Dismissal and Pointer Isolation:**
   - Both `TaskHudMenu` and `LeaveItemPopover` mount inside a full-screen fixed backdrop (`.hud-screen-backdrop`) with `pointer-events: auto` that intercepts clicks outside the dialog to close it without dispatching a floor movement target to the 3D canvas (`controls.tapTarget`).
   - Top navigation islands (`TopNavbarIslands`) and the notification banner (`TaskNotificationBanner`) stop pointer propagation toward the Three.js `Canvas`.
2. **Keyboard Isolation (`WASD` and `Escape`):**
   - Typing inside any input, textarea, or select stops keyboard propagation (`onKeyDown` / `onKeyUp`) so the 3D avatar does not move while composing text.
   - Pressing `Escape` immediately closes the active modal.

---

## 3. Functional Component Specification

### 3.1 Top Floating Islands (`TopNavbarIslands`)
- **Left Island (Spatial Context):** Office badge (`Mi Oficina`), room selector (`Recepción · Principal`), and quick 2D noticeboard trigger (`📌 Cartelera`).
- **Center Island (Inbox & Compose):** `Bandeja` toggle button with active item counter and unread badge (`+N`), paired with the primary `Dejar tarea / nota` button.
- **Right Island (Live Presence & Status):** Dropdown selector listing genuinely connected teammates in the room (with initial monogram and quick `Tarea` | `Nota` action buttons per teammate), plus an interactive availability status chip for the current user (`Disponible`, `Enfocado / No molestar`, `En revisión`).

### 3.2 Gmail-Style Fixed Inbox (`TaskHudMenu`)
- **Workspace Category Tabs:** `Tareas` and `Notas` with active bottom indicator and item counters.
- **Scannable Horizontal Rows (`.hud-inbox-row`):**
  - **Sender/Recipient Column:** Circular initial monogram (`L`, `A`), sender name, and recipient (`Para: ...`).
  - **Center Column (Subject + Snippet):** Semantic priority pill (`Alta`, `Media`, `Baja`) or kind badge (`Nota`), followed by the **bold title** and an inline preview of the description and attachment count. Clicking a row expands or collapses the full detail, image gallery, and threaded replies.
  - **Right Column (Date + Actions):** Due date or timestamp in `America/Argentina/Buenos_Aires` timezone, status selector (`Pendiente` / `Por ver`, `En curso` / `Viendo`, `Hecho` / `Completo`), `Archivar` / `Restaurar`, and `Borrar`.

### 3.3 Fixed Compose Modal (`LeaveItemPopover`)
- Fixed window inspired by the **Gmail / Google Workspace "Compose" modal**, dismissible by clicking anywhere outside the dialog.
- Kind selector (`Tarea` vs. `Nota`), `Para:` row with interactive chips for connected teammates, `Asunto` input, extended description textarea (up to 2,000 characters), image attachment uploader/clipboard paste (`Ctrl+V`, up to 4 images), and bottom toolbar with priority selector, due date, and `Enviar` button.

---

## 4. Enterprise Visual Direction and UI Design Standards

Combines clean enterprise SaaS usability with the warm editorial isometric palette defined in [`art-direction.md`](../../rules/art-direction.md):

- **Typographic Hierarchy & Visual Clarity:** Clean stroke SVG icons, circular user monograms, and subtle `1px` dividers.
- **Warm Enterprise Surfaces:** Panel backgrounds `#FFFDF9` / `#FFF9EB`, headers `#FFF0D8`, structural borders `#AF7B52`, and focus ring `#62CFC7`.
- **High-Contrast Semantic Pills:**
  - `Alta`: Soft background `#FDECEC`, border `#E66861`, text `#991B1B`.
  - `Media`: Soft background `#FEF7E0`, border `#D9A520`, text `#784F04`.
  - `Baja`: Soft background `#EBF7EE`, border `#65B96A`, text `#1E562A`.
  - `Nota`: Soft background `#F3F0FA`, border `#B5A7D6`, text `#49364B`.
