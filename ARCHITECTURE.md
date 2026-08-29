# ARCHITECTURE.md — PQE_AI_Assistant

## Technology Stack

| Layer          | Choice                          |
|----------------|---------------------------------|
| Framework      | Next.js 14+ (App Router)        |
| Language       | TypeScript                      |
| Styling        | Tailwind CSS                    |
| State          | React useState                  |
| Deployment     | Vercel                          |
| Database       | None (MVP)                      |
| Authentication | None (MVP)                      |

## Folder Structure

```
/
├── app/
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # Reusable UI components
├── lib/                   # Utility functions and data
├── types/
│   └── project.ts         # Shared TypeScript types
└── public/                # Static assets
```

## Data Flow

1. User fills form on home page.
2. Form validates input and calls onSubmit.
3. Template functions generate document strings from input.
4. Output components display and allow copying of documents.

## State Management

- Local React state (useState) for UI interactions.
- No global state library needed for MVP.
- localStorage used only for progress tracking.

## Security

- No API keys required for MVP.
- No user data is sent to any server.
- .env.local is gitignored.
- .env.example committed with placeholder values only.

## Future Architecture

When AI generation is added:
- Add app/api/generate/route.ts as a server-side API route.
- Store ANTHROPIC_API_KEY in .env.local only.
- Never expose the key in frontend code.
- Add loading state and error handling for API calls.

