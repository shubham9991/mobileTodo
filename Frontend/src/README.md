# Frontend Architecture

This `src` directory holds the modular architecture for the Todo React Native application.

- **`core/`**: Reusable generic UI components, global hooks, type definitions, and the global store.
- **`features/`**: Feature-sliced specific sections of the app (e.g., dashboard, tasks, notes).
- **`layout/`**: Structural components such as the `TopNavbar` and `BottomNavbar`.
- **`modes/`**: Working Modes (MonkMode, StudyMode, WorkMode) logic and context.
- **`plugins/`**: Third-party marketplace plugins and integrations.
- **`themes/`**: Styling tokens and variables. Used contextually so layouts remain identical.
- **`widgets/`**: Widget registry and implementations (standalone micro-components).
